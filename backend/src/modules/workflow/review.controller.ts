import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ReviewService } from './review.service';
import { ReviewDecisionDto } from './dto/review.dto';

/** Luồng 17 — Approval Workflow (FSM). */
@ApiTags('workflow')
@ApiBearerAuth()
@Controller('documents')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  // Contributor gửi duyệt
  @Patch(':docId/submit-review')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.review.submitForReview(docId, user);
  }

  // PM/Reviewer phê duyệt / từ chối
  @Post(':docId/review')
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId') docId: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.review.review(docId, dto, user);
  }
}
