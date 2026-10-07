import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreatePaymentDto,
  ListPaymentsQueryDto,
  MonthlySummaryQueryDto,
  UpdatePaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@Roles('SUPER_ADMIN', 'ADMIN')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Permissions('payments.read')
  findAll(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('summary/monthly')
  @Permissions('payments.read')
  monthlySummary(@Query() query: MonthlySummaryQueryDto) {
    return this.paymentsService.getMonthlySummary(query);
  }

  @Get('student/:studentId/context')
  @Permissions('payments.read')
  studentContext(@Param('studentId') studentId: string) {
    return this.paymentsService.getStudentContext(studentId);
  }

  @Get(':id')
  @Permissions('payments.read')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @Permissions('payments.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('payments.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(user, id, dto);
  }

  @Post(':id/void')
  @Permissions('payments.void')
  voidPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.paymentsService.void(user, id);
  }
}
