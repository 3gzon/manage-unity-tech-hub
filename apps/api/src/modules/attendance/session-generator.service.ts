import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

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

  async ensureSessionsForDate(groupId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    return this.generateForGroup(groupId, dayStart, dayStart);
  }
}
