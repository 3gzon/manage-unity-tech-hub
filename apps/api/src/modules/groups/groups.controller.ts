import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateGroupDto, ListGroupsQueryDto, UpdateGroupDto, UpdateGroupScheduleDto } from './dto/group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @Permissions('groups.read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListGroupsQueryDto) {
    return this.groupsService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('groups.read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.findOne(user, id);
  }

  @Post()
  @Permissions('groups.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user, dto);
  }

  @Patch(':id/schedule')
  @Permissions('attendance.manage')
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupScheduleDto,
  ) {
    return this.groupsService.updateSchedule(user, id, dto);
  }

  @Patch(':id')
  @Permissions('groups.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('groups.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.archive(user, id);
  }
}
