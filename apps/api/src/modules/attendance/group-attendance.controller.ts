import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AttendanceRecordsService } from './attendance-records.service';

@Controller('groups/:groupId/attendance')
export class GroupAttendanceController {
  constructor(private readonly attendanceService: AttendanceRecordsService) {}

  @Get()
  @Permissions('attendance.read')
  getGroupAttendance(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.attendanceService.getGroupAttendance(user, groupId);
  }
}
