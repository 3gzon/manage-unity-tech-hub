import { Controller, Get } from '@nestjs/common';
import type { AdminDashboardResponse, InstructorDashboardResponse } from '@unity/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('reports.general')
  getAdminDashboard(@CurrentUser() user: AuthenticatedUser): Promise<AdminDashboardResponse> {
    return this.dashboardService.getAdminDashboard(user);
  }

  @Get('instructor')
  @Roles('INSTRUCTOR')
  @Permissions('groups.read')
  getInstructorDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InstructorDashboardResponse> {
    return this.dashboardService.getInstructorDashboard(user);
  }
}
