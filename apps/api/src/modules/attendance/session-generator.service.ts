import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { currentBranchId } from '../../common/branch/branch-context';

@Injectable()
export class SessionGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForGroup(groupId: string, fromDate: Date, toDate: Date) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      include: { schedules: true },
    });

    if (!group) {
      return { created: 0, skipped: 0 };
    }

    let created = 0;
    let skipped = 0;

    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const dayOfWeek = cursor.getDay();

      for (const schedule of group.schedules) {
        if (schedule.dayOfWeek !== dayOfWeek) continue;

        try {
          await this.prisma.classSession.create({
            data: {
              branchId: currentBranchId()!,
              groupId,
              sessionDate: new Date(cursor),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              status: 'SCHEDULED',
            },
          });
          created += 1;
        } catch {
          skipped += 1;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return { created, skipped };
  }

  async repeatMonth(groupId: string, sourceMonth: string, targetMonth: string) {
    const [srcYear, srcMon] = sourceMonth.split('-').map(Number);
    const [tgtYear, tgtMon] = targetMonth.split('-').map(Number);

    const srcFrom = new Date(srcYear!, srcMon! - 1, 1);
    const srcTo = new Date(srcYear!, srcMon!, 0);

    const sourceSessions = await this.prisma.classSession.findMany({
      where: {
        groupId,
        sessionDate: { gte: srcFrom, lte: srcTo },
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      select: { sessionDate: true, startTime: true, endTime: true },
    });

    if (sourceSessions.length === 0) {
      return { created: 0, skipped: 0, patterns: 0 };
    }

    const patternSet = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }>();
    for (const s of sourceSessions) {
      const dow = s.sessionDate.getDay();
      const key = `${dow}-${s.startTime}-${s.endTime}`;
      if (!patternSet.has(key)) {
        patternSet.set(key, { dayOfWeek: dow, startTime: s.startTime, endTime: s.endTime });
      }
    }

    const tgtFrom = new Date(tgtYear!, tgtMon! - 1, 1);
    const tgtTo = new Date(tgtYear!, tgtMon!, 0);

    let created = 0;
    let skipped = 0;

    const cursor = new Date(tgtFrom);
    while (cursor <= tgtTo) {
      const dow = cursor.getDay();
      for (const pattern of patternSet.values()) {
        if (pattern.dayOfWeek !== dow) continue;
        try {
          await this.prisma.classSession.create({
            data: {
              branchId: currentBranchId()!,
              groupId,
              sessionDate: new Date(cursor),
              startTime: pattern.startTime,
              endTime: pattern.endTime,
              status: 'SCHEDULED',
            },
          });
          created += 1;
        } catch {
          skipped += 1;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { created, skipped, patterns: patternSet.size };
  }

  async ensureSessionsForDate(groupId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    return this.generateForGroup(groupId, dayStart, dayStart);
  }
}
