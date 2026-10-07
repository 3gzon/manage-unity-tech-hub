import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class FinancialReportQueryDto {
  @IsOptional()
  @IsIn(['THIS_MONTH', 'LAST_MONTH', 'LAST_3_MONTHS', 'CUSTOM'])
  preset?: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'CUSTOM';

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
