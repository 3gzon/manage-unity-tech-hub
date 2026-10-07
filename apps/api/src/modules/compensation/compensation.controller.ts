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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  AdjustCompensationDto,
  CalculateCompensationDto,
  CreateCompensationRuleDto,
  ListCompensationQueryDto,
  UpdateCompensationRuleDto,
  UpdateCompensationStatusDto,
} from './dto/compensation.dto';
import { CompensationService } from './compensation.service';

@Controller('compensation')
@Roles('SUPER_ADMIN', 'ADMIN')
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) {}

  @Get('lookups')
  @Permissions('compensation.read')
  lookups() {
    return this.compensationService.lookups();
  }

  @Get('rules')
  @Permissions('compensation.read')
  listRules(@Query() query: ListCompensationQueryDto) {
    return this.compensationService.listRules(query);
  }

  @Post('rules')
  @Permissions('compensation.manage')
  createRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCompensationRuleDto) {
    return this.compensationService.createRule(user, dto);
  }

  @Patch('rules/:id')
  @Permissions('compensation.manage')
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompensationRuleDto,
  ) {
    return this.compensationService.updateRule(user, id, dto);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('compensation.manage')
  archiveRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.compensationService.archiveRule(user, id);
  }

  @Get()
  @Permissions('compensation.read')
  list(@Query() query: ListCompensationQueryDto) {
    return this.compensationService.list(query);
  }

  @Post('calculate')
  @Permissions('compensation.read')
  calculate(@Body() dto: CalculateCompensationDto) {
    return this.compensationService.calculate(dto);
  }

  @Post('snapshots')
  @Permissions('compensation.manage')
  saveSnapshot(@CurrentUser() user: AuthenticatedUser, @Body() dto: CalculateCompensationDto) {
    return this.compensationService.saveSnapshot(user, dto);
  }

  @Get(':id')
  @Permissions('compensation.read')
  findOne(@Param('id') id: string) {
    return this.compensationService.findOne(id);
  }

  @Post(':id/adjust')
  @Permissions('compensation.manage')
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdjustCompensationDto,
  ) {
    return this.compensationService.adjust(user, id, dto);
  }

  @Patch(':id/status')
  @Permissions('compensation.manage')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompensationStatusDto,
  ) {
    return this.compensationService.updateStatus(user, id, dto);
  }
}
