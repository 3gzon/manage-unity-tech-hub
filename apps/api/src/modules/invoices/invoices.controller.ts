import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateInvoiceDto,
  GenerateMonthlyInvoicesDto,
  ListInvoicesQueryDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@Roles('SUPER_ADMIN', 'ADMIN')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Permissions('invoices.read')
  findAll(@Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @Permissions('invoices.read')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post('generate')
  @Permissions('invoices.create')
  generateMonthly(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateMonthlyInvoicesDto) {
    return this.invoicesService.generateMonthly(user, dto);
  }

  @Post()
  @Permissions('invoices.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('invoices.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(user, id, dto);
  }

  @Post(':id/cancel')
  @Permissions('invoices.cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.cancel(user, id);
  }

  @Get(':id/pdf')
  @Permissions('invoices.read')
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(@Param('id') id: string) {
    const buffer = await this.invoicesService.generatePdf(id);
    const invoice = await this.invoicesService.findOne(id);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    });
  }
}
