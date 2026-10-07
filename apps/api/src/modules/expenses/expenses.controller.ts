import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateExpenseDto,
  ListExpensesQueryDto,
  MonthlyExpenseSummaryQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@Roles('SUPER_ADMIN', 'ADMIN')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Permissions('expenses.read')
  findAll(@Query() query: ListExpensesQueryDto) {
    return this.expensesService.findAll(query);
  }

  @Get('summary/monthly')
  @Permissions('expenses.read')
  monthlySummary(@Query() query: MonthlyExpenseSummaryQueryDto) {
    return this.expensesService.getMonthlySummary(query);
  }

  @Get(':id')
  @Permissions('expenses.read')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @Permissions('expenses.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('expenses.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user, id, dto);
  }

  @Post(':id/void')
  @Permissions('expenses.manage')
  voidExpense(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expensesService.void(user, id);
  }
}
