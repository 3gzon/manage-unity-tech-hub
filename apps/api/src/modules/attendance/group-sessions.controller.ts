import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateClassSessionDto, ListGroupSessionsQueryDto } from './dto/attendance.dto';
import { SessionsService } from './sessions.service';

@Controller('groups/:groupId/sessions')
export class GroupSessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @Permissions('attendance.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Query() query: ListGroupSessionsQueryDto,
  ) {
    return this.sessionsService.listGroupSessions(user, groupId, query);
  }

  @Post()
  @Permissions('attendance.manage')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateClassSessionDto,
  ) {
    return this.sessionsService.createGroupSession(user, groupId, dto);
  }
}
