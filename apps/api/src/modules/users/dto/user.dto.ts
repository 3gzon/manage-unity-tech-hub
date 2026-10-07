import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SYSTEM_ROLES, USER_ACCOUNT_STATUSES } from '@unity/types';
import type { SystemRole, UserAccountStatus } from '@unity/types';

export class ListUsersQueryDto {
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
  @IsIn(SYSTEM_ROLES)
  role?: SystemRole;

  @IsOptional()
  @IsIn(USER_ACCOUNT_STATUSES)
  status?: UserAccountStatus;
}

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(SYSTEM_ROLES)
  role!: SystemRole;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  instructorId?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsIn(SYSTEM_ROLES)
  role?: SystemRole;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  instructorId?: string | null;
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
