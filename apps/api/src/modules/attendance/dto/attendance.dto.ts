import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus, ClassSessionStatus } from '@prisma/client';

export class ListGroupSessionsQueryDto {
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
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(ClassSessionStatus)
  status?: ClassSessionStatus;
}

export class CreateClassSessionDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  startTime?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  endTime?: string;

  @IsOptional()
  @IsEnum(ClassSessionStatus)
  status?: ClassSessionStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsBoolean()
  generateFromSchedule?: boolean;
}

export class AttendanceRecordDto {
  @IsString()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSessionAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];

  @IsOptional()
  @IsBoolean()
  markAllPresent?: boolean;

  @IsOptional()
  @IsBoolean()
  completeSession?: boolean;
}

export class GroupAttendanceChangeDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  studentId!: string;

  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'CLEAR'])
  mark!: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'CLEAR';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SaveGroupAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupAttendanceChangeDto)
  changes!: GroupAttendanceChangeDto[];
}

export class ListTodaySessionsQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class ListScheduleQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
