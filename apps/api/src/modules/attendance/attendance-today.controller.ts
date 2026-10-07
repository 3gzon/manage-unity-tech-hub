import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ListScheduleQueryDto, ListTodaySessionsQueryDto } from './dto/attendance.dto';
import { SessionsService } from './sessions.service';

@Controller('attendance')
export class AttendanceTodayController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('today')
  @Permissions('attendance.read')
  listToday(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTodaySessionsQueryDto) {
    return this.sessionsService.listTodayClasses(user, query);
  }

  @Get('schedule')
  @Permissions('attendance.read')
  listSchedule(@CurrentUser() user: AuthenticatedUser, @Query() query: ListScheduleQueryDto) {
    return this.sessionsService.listSchedule(user, query);
  }
}
