import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TuitionQuoteModule } from './tuition-quote.module';

@Module({
  imports: [AuditModule, TuitionQuoteModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
