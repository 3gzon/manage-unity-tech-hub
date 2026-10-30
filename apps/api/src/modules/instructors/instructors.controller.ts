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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateInstructorDto,
  ListInstructorsQueryDto,
  UpdateInstructorDto,
} from './dto/instructor.dto';
import { InstructorReportQueryDto, SendInstructorReportEmailDto } from './dto/instructor-report.dto';
import { SendStudentFeedbackDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';
import { InstructorReportService } from './instructor-report.service';
import { InstructorsService } from './instructors.service';

@Controller('instructors')
@Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
export class InstructorsController {
  constructor(
    private readonly instructorsService: InstructorsService,
    private readonly feedbackService: FeedbackService,
    private readonly reportService: InstructorReportService,
  ) {}

  @Get()
  @Permissions('instructors.read')
  findAll(@Query() query: ListInstructorsQueryDto) {
    return this.instructorsService.findAll(query);
  }

  @Get('me')
  @Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.instructorsService.findMine(user);
  }

  @Get('options')
  @Permissions('instructors.read')
  options() {
    return this.instructorsService.options();
  }

  @Get('lookups')
  @Permissions('instructors.read')
  lookups() {
    return this.instructorsService.lookups();
  }

  @Get(':id')
  @Permissions('instructors.read')
  findOne(@Param('id') id: string) {
    return this.instructorsService.findOne(id);
  }

  @Post(':id/feedback')
  @Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
  sendFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendStudentFeedbackDto,
  ) {
    return this.feedbackService.send(user, id, dto);
  }

  @Post()
  @Permissions('instructors.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInstructorDto) {
    return this.instructorsService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('instructors.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInstructorDto,
  ) {
    return this.instructorsService.update(user, id, dto);
  }

  @Get(':id/report')
  @Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: InstructorReportQueryDto,
  ) {
    return this.reportService.generateReport(user, id, query.fromDate, query.toDate);
  }

  @Get(':id/report/pdf')
  @Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
  async reportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: InstructorReportQueryDto,
    @Res() res: Response,
  ) {
    const { pdf, report } = await this.reportService.generatePdf(user, id, query.fromDate, query.toDate);
    const safeName = report.instructorName.replace(/[^\w.-]+/g, '-');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Raport-${safeName}.pdf"`,
    });
    res.send(pdf);
  }

  @Post(':id/report/email')
  @Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
  sendReportEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendInstructorReportEmailDto,
  ) {
    return this.reportService.sendReportEmail(user, id, dto.fromDate, dto.toDate, dto.email);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('instructors.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.instructorsService.archive(user, id);
  }
}
