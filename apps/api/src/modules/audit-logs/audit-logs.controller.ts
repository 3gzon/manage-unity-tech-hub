import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListAuditLogsQueryDto } from './dto/audit-log.dto';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@Roles('SUPER_ADMIN', 'ADMIN')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Permissions('audit.read')
  findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('lookups')
  @Permissions('audit.read')
  lookups() {
    return this.auditLogsService.lookups();
  }

  @Get(':id')
  @Permissions('audit.read')
  findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id);
  }
}
