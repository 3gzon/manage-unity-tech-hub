export type MaterialStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
export type MaterialDecision = 'APPROVED' | 'REJECTED';
export type MaterialReviewerRole = 'INSTRUCTOR' | 'SUPER_ADMIN';

export interface MaterialProgress {
  instructorApprovals: number;
  instructorTarget: number;
  superAdminApproved: boolean;
  authorIsSuperAdmin: boolean;
}

export interface MaterialCommentItem {
  id: string;
  authorUserId: string;
  authorName: string;
  kind: 'NOTE' | 'CHANGE';
  body: string;
  createdAt: string;
}

export interface CreateMaterialCommentRequest {
  body: string;
  kind?: 'NOTE' | 'CHANGE';
}

export interface MaterialReviewItem {
  id: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: MaterialReviewerRole;
  decision: MaterialDecision;
  comment: string | null;
  createdAt: string;
}

export interface MaterialSummary {
  id: string;
  title: string;
  status: MaterialStatus;
  authorUserId: string;
  authorName: string;
  excerpt: string;
  updatedAt: string;
  progress: MaterialProgress;
}

export interface MaterialTopicGroup {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  materials: MaterialSummary[];
}

export interface MaterialListResponse {
  topics: MaterialTopicGroup[];
}

export interface MaterialTopicOption {
  id: string;
  title: string;
  courseId: string;
}

export interface MaterialDetail extends MaterialSummary {
  body: string;
  publishedBody: string | null;
  courseId: string;
  courseName: string;
  topicId: string;
  topicTitle: string;
  createdAt: string;
  reviews: MaterialReviewItem[];
  comments: MaterialCommentItem[];
  siblings: MaterialSummary[];
  canApprove: boolean;
  canRequestChanges: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface MaterialListQuery {
  courseId?: string;
  status?: 'PENDING' | 'APPROVED';
}

export interface CreateMaterialRequest {
  courseId: string;
  topicId?: string;
  topicTitle?: string;
  title: string;
  body: string;
}

export interface UpdateMaterialRequest {
  title?: string;
  body?: string;
}

export interface MaterialDecisionRequest {
  decision: MaterialDecision;
  comment?: string;
}
