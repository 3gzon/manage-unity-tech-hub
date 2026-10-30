import { Module } from '@nestjs/common';
import { MailService } from '../../infrastructure/mail/mail.service';
import { SettingsModule } from '../settings/settings.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [SettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService, MailService],
})
export class ReportsModule {}
