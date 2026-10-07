import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FinancialReportQueryDto } from './dto/financial-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles('SUPER_ADMIN', 'ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial')
  @Permissions('reports.financial')
  financial(@Query() query: FinancialReportQueryDto) {
    return this.reportsService.getFinancialReport(query);
  }
}
