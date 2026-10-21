import { Controller, Get, Header, Param, Query, StreamableFile } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ListFeedbackQueryDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@Roles('INSTRUCTOR', 'SUPER_ADMIN', 'BRANCH_ADMIN')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListFeedbackQueryDto) {
    return this.feedback.list(user, query);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const { buffer, studentName } = await this.feedback.pdf(user, id);
    const safeName = studentName.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="Vleresim-${safeName}.pdf"`,
    });
  }
}
