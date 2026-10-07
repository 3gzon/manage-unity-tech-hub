import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AttendanceRecordsService } from './attendance-records.service';
import { UpdateSessionAttendanceDto } from './dto/attendance.dto';

@Controller('sessions/:sessionId/attendance')
export class SessionAttendanceController {
  constructor(private readonly attendanceService: AttendanceRecordsService) {}

  @Get()
  @Permissions('attendance.read')
  getAttendance(@CurrentUser() user: AuthenticatedUser, @Param('sessionId') sessionId: string) {
    return this.attendanceService.getSessionAttendance(user, sessionId);
  }

  @Put()
  @Permissions('attendance.manage')
  updateAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionAttendanceDto,
  ) {
    return this.attendanceService.updateSessionAttendance(user, sessionId, dto);
  }
}
