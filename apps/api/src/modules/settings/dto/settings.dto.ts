import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export class UpdateSettingsDto {
  @IsString()
  @MinLength(1)
  schoolName!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  phone?: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  multiCourseDiscountPercent!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  familyPackDiscountPercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  invoiceDueDay!: number;
}
