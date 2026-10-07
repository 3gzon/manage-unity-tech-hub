import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { EmploymentContractStatus, EmploymentContractType, EmploymentTimeType } from '@prisma/client';

export class ListContractsQueryDto {
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
  employeeUserId?: string;

  @IsOptional()
  @IsEnum(EmploymentContractType)
  type?: EmploymentContractType;

  @IsOptional()
  @IsEnum(EmploymentContractStatus)
  status?: EmploymentContractStatus;
}

export class CreateContractDto {
  @IsUUID()
  employeeUserId!: string;

  @IsEnum(EmploymentContractType)
  type!: EmploymentContractType;

  @IsEnum(EmploymentTimeType)
  timeType!: EmploymentTimeType;

  @IsString()
  @MinLength(1)
  employerName!: string;

  @IsString()
  @MinLength(1)
  employerSeat!: string;

  @IsString()
  @MinLength(1)
  employerRegistrationNumber!: string;

  @IsString()
  @MinLength(1)
  employeeFirstName!: string;

  @IsString()
  @MinLength(1)
  employeeLastName!: string;

  @IsString()
  @MinLength(1)
  employeeQualification!: string;

  @IsString()
  @MinLength(1)
  employeeResidence!: string;

  @IsOptional()
  @IsString()
  employeePersonalNumber?: string;

  @IsString()
  @MinLength(1)
  jobTitle!: string;

  @IsString()
  @MinLength(1)
  jobNature!: string;

  @IsString()
  @MinLength(1)
  jobDescription!: string;

  @IsString()
  @MinLength(1)
  workplace!: string;

  @IsOptional()
  @IsBoolean()
  workInMultipleLocations?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  weeklyHours!: number;

  @IsString()
  @MinLength(1)
  workSchedule!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseSalary!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  collaborationPercentage?: number;

  @IsOptional()
  @IsString()
  percentageBase?: string;

  @IsOptional()
  @IsString()
  allowances?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  annualLeaveDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  noticePeriodDays!: number;

  @IsOptional()
  @IsString()
  terminationTerms?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  probationMonths?: number;

  @IsOptional()
  @IsString()
  agreedTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsUUID()
  employeeUserId?: string;

  @IsOptional()
  @IsEnum(EmploymentContractType)
  type?: EmploymentContractType;

  @IsOptional()
  @IsEnum(EmploymentContractStatus)
  status?: EmploymentContractStatus;

  @IsOptional()
  @IsEnum(EmploymentTimeType)
  timeType?: EmploymentTimeType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employerSeat?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employerRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeFirstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeLastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeQualification?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeResidence?: string;

  @IsOptional()
  @IsString()
  employeePersonalNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  jobNature?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  jobDescription?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  workplace?: string;

  @IsOptional()
  @IsBoolean()
  workInMultipleLocations?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  weeklyHours?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  workSchedule?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  collaborationPercentage?: number;

  @IsOptional()
  @IsString()
  percentageBase?: string;

  @IsOptional()
  @IsString()
  allowances?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  annualLeaveDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  noticePeriodDays?: number;

  @IsOptional()
  @IsString()
  terminationTerms?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  probationMonths?: number;

  @IsOptional()
  @IsString()
  agreedTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
