import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';

@Module({
  imports: [AuditModule],
  controllers: [CompensationController],
  providers: [CompensationService],
})
export class CompensationModule {}
