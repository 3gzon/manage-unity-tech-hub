import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceRecordsService } from './attendance-records.service';
import { AttendanceTodayController } from './attendance-today.controller';
import { GroupAttendanceController } from './group-attendance.controller';
import { GroupSessionsController } from './group-sessions.controller';
import { SessionAttendanceController } from './session-attendance.controller';
import { SessionGeneratorService } from './session-generator.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [AuditModule, GroupsModule, NotificationsModule],
  controllers: [
    GroupSessionsController,
    GroupAttendanceController,
    SessionAttendanceController,
    AttendanceTodayController,
  ],
  providers: [SessionsService, SessionGeneratorService, AttendanceRecordsService],
})
export class AttendanceModule {}
