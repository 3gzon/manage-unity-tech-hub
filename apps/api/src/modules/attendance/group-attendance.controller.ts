import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AttendanceRecordsService } from './attendance-records.service';
import { SaveGroupAttendanceDto } from './dto/attendance.dto';

@Controller('groups/:groupId/attendance')
export class GroupAttendanceController {
  constructor(private readonly attendanceService: AttendanceRecordsService) {}

  @Get()
  @Permissions('attendance.read')
  getGroupAttendance(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.attendanceService.getGroupAttendance(user, groupId);
  }

  @Put()
  @Permissions('attendance.manage')
  saveGroupAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: SaveGroupAttendanceDto,
  ) {
    return this.attendanceService.saveGroupAttendance(user, groupId, dto);
  }
}
