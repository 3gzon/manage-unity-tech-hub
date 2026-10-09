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
import {
  AddFamilyMemberDto,
  CreateStudentDto,
  ImportStudentsDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('students.read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListStudentsQueryDto) {
    return this.studentsService.findAll(user, query);
  }

  @Get('filter-options')
  @Permissions('students.read')
  getFilterOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getFilterOptions(user);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studentsService.findOne(user, id);
  }

  @Post()
  @Permissions('students.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(user, dto);
  }

  @Post('import')
  @Permissions('students.create')
  importStudents(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportStudentsDto) {
    return this.studentsService.importStudents(user, dto.students);
  }

  @Post(':id/family')
  @Permissions('students.update')
  addFamilyMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddFamilyMemberDto,
  ) {
    return this.studentsService.addFamilyMember(user, id, dto.studentId);
  }

  @Delete(':id/family')
  @Permissions('students.update')
  leaveFamily(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studentsService.leaveFamily(user, id);
  }

  @Patch(':id')
  @Permissions('students.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('students.archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.studentsService.archive(user, id);
  }
}
