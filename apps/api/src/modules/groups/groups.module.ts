import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { GroupAccessService } from './group-access.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [AuditModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupAccessService],
  exports: [GroupAccessService],
})
export class GroupsModule {}
