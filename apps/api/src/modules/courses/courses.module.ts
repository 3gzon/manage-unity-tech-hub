import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { GroupsModule } from '../groups/groups.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [AuditModule, GroupsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
