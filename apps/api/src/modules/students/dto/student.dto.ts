import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Gender, ParentRelationship, StudentStatus } from '@prisma/client';

export class GuardianDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(ParentRelationship)
  relationship!: ParentRelationship;
}

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsDateString()
  registrationDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians?: GuardianDto[];
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  instructorId?: string | null;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsDateString()
  registrationDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians?: GuardianDto[];
}

export class ImportStudentItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  row!: number;

  @ValidateNested()
  @Type(() => CreateStudentDto)
  student!: CreateStudentDto;
}

export class ImportStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportStudentItemDto)
  students!: ImportStudentItemDto[];
}

export class ListStudentsQueryDto {
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
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsIn(['PAID', 'UNPAID', 'PARTIAL', 'NONE'])
  paymentStatus?: 'PAID' | 'UNPAID' | 'PARTIAL' | 'NONE';

  @IsOptional()
  @IsIn(['firstName', 'lastName', 'registrationDate', 'status'])
  sortBy?: 'firstName' | 'lastName' | 'registrationDate' | 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class AddFamilyMemberDto {
  @IsUUID()
  studentId!: string;
}
