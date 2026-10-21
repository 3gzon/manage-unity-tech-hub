import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MaterialCommentItem,
  MaterialDetail,
  MaterialListResponse,
  MaterialProgress,
  MaterialReviewItem,
  MaterialStatus,
  MaterialSummary,
  MaterialTopicOption,
} from '@unity/types';
import { MaterialDecision, MaterialStatus as PrismaMaterialStatus, Prisma } from '@prisma/client';
import { currentBranchId } from '../../common/branch/branch-context';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type {
  CreateMaterialDto,
  CreateMaterialCommentDto,
  ListMaterialsQueryDto,
  MaterialDecisionDto,
  UpdateMaterialDto,
} from './dto/material.dto';

const INSTRUCTOR_TARGET = 2;

const materialInclude = {
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      roles: { include: { role: { select: { name: true } } } },
    },
  },
  reviews: {
    include: {
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  comments: {
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  topic: {
    include: {
      course: { select: { id: true, name: true } },
      materials: {
        where: { deletedAt: null },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              roles: { include: { role: { select: { name: true } } } },
            },
          },
          reviews: true,
        },
        orderBy: { updatedAt: 'desc' as const },
      },
    },
  },
} satisfies Prisma.CourseMaterialInclude;

type MaterialRecord = Prisma.CourseMaterialGetPayload<{ include: typeof materialInclude }>;
type ReviewRecord = MaterialRecord['reviews'][number];

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListMaterialsQueryDto): Promise<MaterialListResponse> {
    const statusFilter: Prisma.CourseMaterialWhereInput =
      query.status === 'APPROVED'
        ? { status: 'APPROVED' }
        : query.status === 'PENDING'
          ? { status: { in: ['PENDING', 'CHANGES_REQUESTED'] } }
          : {};

    const topics = await this.prisma.courseMaterialTopic.findMany({
      where: {
        deletedAt: null,
        ...(query.courseId ? { courseId: query.courseId } : {}),
        materials: { some: { deletedAt: null, ...statusFilter } },
      },
      include: {
        course: { select: { id: true, name: true } },
        materials: {
          where: { deletedAt: null, ...statusFilter },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roles: { include: { role: { select: { name: true } } } },
              },
            },
            reviews: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: [{ course: { name: 'asc' } }, { title: 'asc' }],
    });

    return {
      topics: topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        courseId: topic.course.id,
        courseName: topic.course.name,
        materials: topic.materials.map((material) => this.toSummary(material)),
      })),
    };
  }

  async topicOptions(courseId: string): Promise<MaterialTopicOption[]> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const topics = await this.prisma.courseMaterialTopic.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, courseId: true },
    });
    return topics;
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<MaterialDetail> {
    const material = await this.requireMaterial(id);
    return this.toDetail(actor, material);
  }

  async create(actor: AuthenticatedUser, dto: CreateMaterialDto): Promise<MaterialDetail> {
    const branchId = this.requireBranchId();
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const body = dto.body.trim();
    const title = dto.title.trim();
    if (!body) throw new BadRequestException('Write the lesson in Markdown before submitting');

    const topic = await this.resolveTopic(actor, branchId, course.id, dto.topicId, dto.topicTitle);
    const created = await this.prisma.courseMaterial.create({
      data: {
        branchId,
        topicId: topic.id,
        title,
        body,
        status: 'PENDING',
        authorUserId: actor.id,
      },
      include: materialInclude,
    });

    await this.audit.record({
      userId: actor.id,
      action: 'CREATE',
      entity: 'CourseMaterial',
      entityId: created.id,
      newValue: { title, topic: topic.title, course: course.name },
    });
    await this.notifyReviewers(actor, created, course.name, topic.title);
    return this.toDetail(actor, created);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateMaterialDto): Promise<MaterialDetail> {
    const current = await this.requireMaterial(id);
    if (!this.canEdit(actor, current.authorUserId)) {
      throw new ForbiddenException('You can edit materials you contributed');
    }
    if (dto.title === undefined && dto.body === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const body = dto.body?.trim();
    if (dto.body !== undefined && !body) {
      throw new BadRequestException('Write the lesson in Markdown before submitting');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.courseMaterialReview.deleteMany({ where: { materialId: id } });
      return tx.courseMaterial.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(body !== undefined ? { body } : {}),
          status: 'PENDING',
        },
        include: materialInclude,
      });
    });

    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'CourseMaterial',
      entityId: id,
      newValue: { title: updated.title, status: 'PENDING' },
    });
    await this.notifyReviewers(actor, updated, updated.topic.course.name, updated.topic.title);
    return this.toDetail(actor, updated);
  }

  async decide(actor: AuthenticatedUser, id: string, dto: MaterialDecisionDto): Promise<MaterialDetail> {
    const material = await this.requireMaterial(id);
    if (material.authorUserId === actor.id) {
      throw new BadRequestException('You cannot review your own material');
    }
    if (material.status !== 'PENDING') {
      throw new BadRequestException('This material is not waiting for approval');
    }

    const reviewerRole = actor.roles.includes('SUPER_ADMIN')
      ? 'SUPER_ADMIN'
      : actor.roles.includes('INSTRUCTOR')
        ? 'INSTRUCTOR'
        : null;
    if (!reviewerRole) {
      throw new ForbiddenException('Approvals come from two other instructors and a Super Admin');
    }
    if (dto.decision === 'REJECTED' && !dto.comment?.trim()) {
      throw new BadRequestException('Add a comment so the author knows what to change');
    }

    const branchId = this.requireBranchId();
    const existing = await this.prisma.courseMaterialReview.findFirst({
      where: { materialId: id, reviewerUserId: actor.id },
    });
    if (existing) {
      await this.prisma.courseMaterialReview.update({
        where: { id: existing.id },
        data: {
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
          reviewerRole,
        },
      });
    } else {
      await this.prisma.courseMaterialReview.create({
        data: {
          branchId,
          materialId: id,
          reviewerUserId: actor.id,
          reviewerRole,
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
        },
      });
    }

    const refreshed = await this.syncStatus(id);
    await this.audit.record({
      userId: actor.id,
      action: dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
      entity: 'CourseMaterial',
      entityId: id,
      newValue: { decision: dto.decision, status: refreshed.status },
    });
    if (refreshed.status === 'APPROVED') {
      await this.notifyAuthor(refreshed);
    }
    return this.toDetail(actor, refreshed);
  }

  async addComment(actor: AuthenticatedUser, id: string, dto: CreateMaterialCommentDto): Promise<MaterialDetail> {
    const material = await this.requireMaterial(id);
    const body = dto.body.trim();
    if (body.length < 2) throw new BadRequestException('Write a comment first');
    const kind = dto.kind === 'CHANGE' ? 'CHANGE' : 'NOTE';
    const branchId = this.requireBranchId();

    await this.prisma.courseMaterialComment.create({
      data: {
        branchId,
        materialId: id,
        authorUserId: actor.id,
        kind,
        body,
      },
    });

    const canSendBack =
      kind === 'CHANGE' &&
      material.status === 'PENDING' &&
      actor.id !== material.authorUserId &&
      (actor.roles.includes('INSTRUCTOR') || actor.roles.includes('SUPER_ADMIN'));

    if (canSendBack) {
      const reviewerRole = actor.roles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'INSTRUCTOR';
      const existing = await this.prisma.courseMaterialReview.findFirst({
        where: { materialId: id, reviewerUserId: actor.id },
      });
      if (existing) {
        await this.prisma.courseMaterialReview.update({
          where: { id: existing.id },
          data: { decision: 'REJECTED', comment: body, reviewerRole },
        });
      } else {
        await this.prisma.courseMaterialReview.create({
          data: {
            branchId,
            materialId: id,
            reviewerUserId: actor.id,
            reviewerRole,
            decision: 'REJECTED',
            comment: body,
          },
        });
      }
      const refreshed = await this.syncStatus(id);
      await this.audit.record({
        userId: actor.id,
        action: 'REJECT',
        entity: 'CourseMaterial',
        entityId: id,
        newValue: { status: refreshed.status, comment: body },
      });
      await this.notifyAuthorOfComment(actor, refreshed, kind);
      return this.toDetail(actor, refreshed);
    }

    await this.audit.record({
      userId: actor.id,
      action: 'COMMENT',
      entity: 'CourseMaterial',
      entityId: id,
      newValue: { kind },
    });
    const updated = await this.requireMaterial(id);
    await this.notifyAuthorOfComment(actor, updated, kind);
    return this.toDetail(actor, updated);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const material = await this.requireMaterial(id);
    if (!this.canEdit(actor, material.authorUserId)) {
      throw new ForbiddenException('You can remove materials you contributed');
    }
    await this.prisma.courseMaterial.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    const remaining = await this.prisma.courseMaterial.count({
      where: { topicId: material.topicId, deletedAt: null },
    });
    if (remaining === 0) {
      await this.prisma.courseMaterialTopic.update({
        where: { id: material.topicId },
        data: { deletedAt: new Date() },
      });
    }
    await this.audit.record({
      userId: actor.id,
      action: 'DELETE',
      entity: 'CourseMaterial',
      entityId: id,
    });
  }

  private async resolveTopic(
    actor: AuthenticatedUser,
    branchId: string,
    courseId: string,
    topicId?: string,
    topicTitle?: string,
  ) {
    if (topicId) {
      const topic = await this.prisma.courseMaterialTopic.findFirst({
        where: { id: topicId, courseId, deletedAt: null },
      });
      if (!topic) throw new NotFoundException('Topic not found');
      return topic;
    }

    const title = topicTitle?.trim();
    if (!title) throw new BadRequestException('Name the topic, for example React JS');

    const existing = await this.prisma.courseMaterialTopic.findFirst({
      where: { courseId, deletedAt: null, title: { equals: title, mode: 'insensitive' } },
    });
    if (existing) return existing;

    return this.prisma.courseMaterialTopic.create({
      data: {
        branchId,
        courseId,
        title,
        authorUserId: actor.id,
      },
    });
  }

  private async syncStatus(id: string): Promise<MaterialRecord> {
    const material = await this.requireMaterial(id);
    const approved = material.reviews.filter((review) => review.decision === 'APPROVED');
    const rejected = material.reviews.some((review) => review.decision === 'REJECTED');
    const instructors = approved.filter((review) => review.reviewerRole === 'INSTRUCTOR').length;
    const superAdmin = approved.some((review) => review.reviewerRole === 'SUPER_ADMIN');
    const authorIsSuperAdmin = this.authorIsSuperAdmin(material);
    const ready = instructors >= INSTRUCTOR_TARGET && (superAdmin || authorIsSuperAdmin);

    let status: PrismaMaterialStatus = 'PENDING';
    if (rejected) status = 'CHANGES_REQUESTED';
    else if (ready) status = 'APPROVED';

    return this.prisma.courseMaterial.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPROVED' ? { publishedBody: material.body } : {}),
      },
      include: materialInclude,
    });
  }

  private async notifyReviewers(
    actor: AuthenticatedUser,
    material: { id: string; title: string },
    courseName: string,
    topicTitle: string,
  ) {
    const branchId = currentBranchId();
    if (!branchId) return;
    try {
      const recipients = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          id: { not: actor.id },
          OR: [
            {
              branchId,
              roles: { some: { role: { name: { in: ['INSTRUCTOR', 'BRANCH_ADMIN'] } } } },
            },
            { roles: { some: { role: { name: 'SUPER_ADMIN' } } } },
          ],
        },
        select: { id: true },
      });
      if (!recipients.length) return;
      const author = `${actor.firstName} ${actor.lastName}`.trim();
      await this.prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          type: 'INFO' as const,
          title: `Material awaiting approval — ${topicTitle}`,
          message: `${author} contributed “${material.title}” to ${topicTitle} in ${courseName}. It needs two other instructors and a Super Admin.`,
        })),
      });
    } catch {
      // A missed notification should not block the contribution.
    }
  }

  private async notifyAuthorOfComment(
    actor: AuthenticatedUser,
    material: MaterialRecord,
    kind: 'NOTE' | 'CHANGE',
  ) {
    if (actor.id === material.authorUserId) return;
    try {
      const name = `${actor.firstName} ${actor.lastName}`.trim();
      await this.prisma.notification.create({
        data: {
          userId: material.authorUserId,
          type: kind === 'CHANGE' ? 'WARNING' : 'INFO',
          title: kind === 'CHANGE' ? `Change requested — ${material.title}` : `Comment on ${material.title}`,
          message: `${name} wrote on “${material.title}” in ${material.topic.title}.`,
        },
      });
    } catch {
      // A missed notification should not block the comment.
    }
  }

  private async notifyAuthor(material: MaterialRecord) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: material.authorUserId,
          type: 'SUCCESS',
          title: `Material approved — ${material.topic.title}`,
          message: `“${material.title}” is now published for ${material.topic.course.name}.`,
        },
      });
    } catch {
      // A missed notification should not block the approval.
    }
  }

  private async requireMaterial(id: string): Promise<MaterialRecord> {
    const material = await this.prisma.courseMaterial.findFirst({
      where: { id, deletedAt: null },
      include: materialInclude,
    });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  private requireBranchId() {
    const branchId = currentBranchId();
    if (!branchId) throw new BadRequestException('Choose a branch first');
    return branchId;
  }

  private canEdit(actor: AuthenticatedUser, authorUserId: string) {
    return (
      actor.id === authorUserId ||
      actor.roles.includes('SUPER_ADMIN') ||
      actor.roles.includes('BRANCH_ADMIN')
    );
  }

  private authorIsSuperAdmin(material: {
    author: { roles: { role: { name: string } }[] };
  }) {
    return material.author.roles.some((entry) => entry.role.name === 'SUPER_ADMIN');
  }

  private progress(material: {
    author: { roles: { role: { name: string } }[] };
    reviews: { decision: MaterialDecision; reviewerRole: string }[];
  }): MaterialProgress {
    const approved = material.reviews.filter((review) => review.decision === 'APPROVED');
    return {
      instructorApprovals: approved.filter((review) => review.reviewerRole === 'INSTRUCTOR').length,
      instructorTarget: INSTRUCTOR_TARGET,
      superAdminApproved: approved.some((review) => review.reviewerRole === 'SUPER_ADMIN'),
      authorIsSuperAdmin: this.authorIsSuperAdmin(material),
    };
  }

  private toSummary(material: {
    id: string;
    title: string;
    status: PrismaMaterialStatus;
    body: string;
    publishedBody: string | null;
    authorUserId: string;
    updatedAt: Date;
    author: { id: string; firstName: string; lastName: string; roles: { role: { name: string } }[] };
    reviews: { decision: MaterialDecision; reviewerRole: string }[];
  }): MaterialSummary {
    const source = material.status === 'APPROVED' ? (material.publishedBody ?? material.body) : material.body;
    return {
      id: material.id,
      title: material.title,
      status: material.status as MaterialStatus,
      authorUserId: material.authorUserId,
      authorName: `${material.author.firstName} ${material.author.lastName}`.trim(),
      excerpt: excerpt(source),
      updatedAt: material.updatedAt.toISOString(),
      progress: this.progress(material),
    };
  }

  private toDetail(actor: AuthenticatedUser, material: MaterialRecord): MaterialDetail {
    const summary = this.toSummary(material);
    const waiting = material.status === 'PENDING';
    const canReview =
      waiting &&
      actor.id !== material.authorUserId &&
      (actor.roles.includes('INSTRUCTOR') || actor.roles.includes('SUPER_ADMIN'));
    const ownReview = material.reviews.find((review) => review.reviewerUserId === actor.id);

    return {
      ...summary,
      body: material.body,
      publishedBody: material.publishedBody,
      courseId: material.topic.course.id,
      courseName: material.topic.course.name,
      topicId: material.topic.id,
      topicTitle: material.topic.title,
      createdAt: material.createdAt.toISOString(),
      reviews: material.reviews.map((review) => this.toReview(review)),
      comments: material.comments.map((entry) => this.toComment(entry)),
      siblings: material.topic.materials
        .filter((item) => item.id !== material.id)
        .map((item) => this.toSummary(item)),
      canApprove: canReview && ownReview?.decision !== 'APPROVED',
      canRequestChanges: canReview && ownReview?.decision !== 'REJECTED',
      canEdit: this.canEdit(actor, material.authorUserId),
      canDelete: this.canEdit(actor, material.authorUserId),
    };
  }

  private toComment(entry: MaterialRecord['comments'][number]): MaterialCommentItem {
    return {
      id: entry.id,
      authorUserId: entry.authorUserId,
      authorName: `${entry.author.firstName} ${entry.author.lastName}`.trim(),
      kind: entry.kind,
      body: entry.body,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private toReview(review: ReviewRecord): MaterialReviewItem {
    return {
      id: review.id,
      reviewerUserId: review.reviewerUserId,
      reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`.trim(),
      reviewerRole: review.reviewerRole,
      decision: review.decision,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }
}

function excerpt(markdown: string) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`[\]()\-!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= 160) return plain;
  return `${plain.slice(0, 157)}...`;
}
