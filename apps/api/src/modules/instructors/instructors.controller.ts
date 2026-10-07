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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateInstructorDto,
  ListInstructorsQueryDto,
  UpdateInstructorDto,
} from './dto/instructor.dto';
import { InstructorsService } from './instructors.service';

@Controller('instructors')
@Roles('SUPER_ADMIN', 'ADMIN')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Get()
  @Permissions('instructors.read')
  findAll(@Query() query: ListInstructorsQueryDto) {
    return this.instructorsService.findAll(query);
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('instructors.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.instructorsService.archive(user, id);
  }
}
