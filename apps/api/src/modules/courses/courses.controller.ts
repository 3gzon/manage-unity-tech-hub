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
import { CreateCourseDto, ListCoursesQueryDto, UpdateCourseDto } from './dto/course.dto';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @Permissions('courses.read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCoursesQueryDto) {
    return this.coursesService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('courses.read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.coursesService.findOne(user, id);
  }

  @Post()
  @Permissions('courses.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('courses.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('courses.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.coursesService.archive(user, id);
  }
}
