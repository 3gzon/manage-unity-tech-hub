import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FinancialReportQueryDto, SendReportEmailDto } from './dto/financial-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial')
  @Permissions('reports.financial')
  financial(@Query() query: FinancialReportQueryDto) {
    return this.reportsService.getFinancialReport(query);
  }

  @Get('financial/pdf')
  @Permissions('reports.financial')
  async financialPdf(@Query() query: FinancialReportQueryDto, @Res() res: Response) {
    const { pdf, periodLabel } = await this.reportsService.generatePdf(query);
    const safeName = periodLabel.replace(/[^\w.-]+/g, '-');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Raport-financiar-${safeName}.pdf"`,
    });
    res.send(pdf);
  }

  @Post('financial/email')
  @Permissions('reports.financial')
  sendEmail(@Body() dto: SendReportEmailDto) {
    return this.reportsService.sendReportEmail(dto, dto.email);
  }
}
