import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { TuitionQuoteService } from './tuition-quote.service';

@Module({
  imports: [SettingsModule],
  providers: [TuitionQuoteService],
  exports: [TuitionQuoteService],
})
export class TuitionQuoteModule {}
