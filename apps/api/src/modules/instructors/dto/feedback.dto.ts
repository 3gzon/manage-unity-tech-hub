import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { FeedbackRating } from '@unity/types';

const RATINGS = ['EXCELLENT', 'GOOD', 'SATISFACTORY', 'NEEDS_SUPPORT'] as const;

export class SendStudentFeedbackDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  groupId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  period!: string;

  @IsIn(RATINGS)
  overall!: FeedbackRating;

  @IsIn(RATINGS)
  participation!: FeedbackRating;

  @IsIn(RATINGS)
  understanding!: FeedbackRating;

  @IsIn(RATINGS)
  practice!: FeedbackRating;

  @IsIn(RATINGS)
  attendance!: FeedbackRating;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  strengths!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  improvements!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  nextSteps!: string;
}

export class ListFeedbackQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;
}
