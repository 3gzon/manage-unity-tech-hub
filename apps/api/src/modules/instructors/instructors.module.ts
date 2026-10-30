import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MailService } from '../../infrastructure/mail/mail.service';
import { SettingsModule } from '../settings/settings.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { InstructorReportService } from './instructor-report.service';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';

@Module({
  imports: [AuditModule, AuthModule, SettingsModule],
  controllers: [InstructorsController, FeedbackController],
  providers: [InstructorsService, FeedbackService, InstructorReportService, MailService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
