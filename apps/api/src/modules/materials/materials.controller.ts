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
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateMaterialDto,
  ListMaterialsQueryDto,
  ListMaterialTopicsQueryDto,
  MaterialDecisionDto,
  CreateMaterialCommentDto,
  UpdateMaterialDto,
} from './dto/material.dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
@Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  list(@Query() query: ListMaterialsQueryDto) {
    return this.materials.list(query);
  }

  @Get('topics')
  topics(@Query() query: ListMaterialTopicsQueryDto) {
    return this.materials.topicOptions(query.courseId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.materials.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMaterialDto) {
    return this.materials.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materials.update(user, id, dto);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateMaterialCommentDto,
  ) {
    return this.materials.addComment(user, id, dto);
  }

  @Post(':id/decision')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MaterialDecisionDto,
  ) {
    return this.materials.decide(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.materials.remove(user, id);
  }
}
