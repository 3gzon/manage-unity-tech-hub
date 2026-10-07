import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { StudentAccessService } from './student-access.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [AuditModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentAccessService],
  exports: [StudentAccessService],
})
export class StudentsModule {}
