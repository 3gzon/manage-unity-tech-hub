import { IsDateString, IsEmail } from 'class-validator';

export class InstructorReportQueryDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;
}

export class SendInstructorReportEmailDto extends InstructorReportQueryDto {
  @IsEmail()
  email!: string;
}
