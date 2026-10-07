import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateContractDto, ListContractsQueryDto, UpdateContractDto } from './dto/contract.dto';
import { ContractsService } from './contracts.service';

@Controller('contracts')
@Roles('SUPER_ADMIN')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @Permissions('contracts.read')
  findAll(@Query() query: ListContractsQueryDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id/pdf')
  @Permissions('contracts.read')
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(@Param('id') id: string) {
    const buffer = await this.contractsService.generatePdf(id);
    const contract = await this.contractsService.findOne(id);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="${contract.contractNumber}.pdf"`,
    });
  }

  @Get(':id')
  @Permissions('contracts.read')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @Permissions('contracts.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContractDto) {
    return this.contractsService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('contracts.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('contracts.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.contractsService.archive(user, id);
  }
}
