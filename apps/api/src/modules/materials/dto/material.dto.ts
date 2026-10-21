import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { MaterialDecision } from '@unity/types';

export class ListMaterialsQueryDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED'])
  status?: 'PENDING' | 'APPROVED';
}

export class ListMaterialTopicsQueryDto {
  @IsUUID()
  courseId!: string;
}

export class CreateMaterialDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsUUID()
  topicId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  topicTitle?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  body!: string;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  body?: string;
}

export class MaterialDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: MaterialDecision;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class CreateMaterialCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsIn(['NOTE', 'CHANGE'])
  kind?: 'NOTE' | 'CHANGE';
}
