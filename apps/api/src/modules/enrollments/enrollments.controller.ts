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
import { CreateEnrollmentDto, ListEnrollmentsQueryDto, UpdateEnrollmentDto } from './dto/enrollment.dto';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @Permissions('enrollments.read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListEnrollmentsQueryDto) {
    return this.enrollmentsService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('enrollments.read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.enrollmentsService.findOne(user, id);
  }

  @Post()
  @Permissions('enrollments.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('enrollments.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('enrollments.manage')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.enrollmentsService.withdraw(user, id);
  }
}
