import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  UpdateRolePermissionsDto,
  UpdateUserDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles('SUPER_ADMIN', 'ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(user, query);
  }

  @Get('lookups')
  @Permissions('users.read')
  lookups(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.lookups(user);
  }

  @Get('roles')
  @Permissions('users.read')
  listRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listRoles(user);
  }

  @Patch('roles/:roleName/permissions')
  @Permissions('roles.manage')
  updateRolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roleName') roleName: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.usersService.updateRolePermissions(user, roleName, dto);
  }

  @Get(':id')
  @Permissions('users.read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.findOne(user, id);
  }

  @Post()
  @Permissions('users.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('users.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Post(':id/disable')
  @Permissions('users.manage')
  disable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.disable(user, id);
  }

  @Post(':id/enable')
  @Permissions('users.manage')
  enable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.enable(user, id);
  }

  @Post(':id/reset-password')
  @Permissions('users.manage')
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.usersService.resetPassword(user, id, dto);
  }
}
