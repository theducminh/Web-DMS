import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DocumentsService } from './documents.service';
import { FoldersService } from './folders.service';
import { MoveDocumentDto } from './dto/documents.dto';

/** Luồng 16 (detail/version/download) + thao tác tài liệu của Luồng 12 (move/delete/lock). */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly folders: FoldersService,
  ) {}

  // --- Luồng 16 ---
  @Get(':docId')
  getDetail(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.documents.getDetail(docId, user);
  }

  @Post(':docId/versions/:versionId/restore')
  @HttpCode(HttpStatus.CREATED)
  restoreVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documents.restoreVersion(docId, versionId, user);
  }

  @Get(':docId/versions/:versionId/download')
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const ip = (req.ip ?? '').replace('::ffff:', '');
    return this.documents.getDownloadUrl(docId, versionId, user, ip);
  }

  // C1 (Phase 5): Preview URL inline cho browser iframe. KHÔNG ghi audit DOWNLOAD.
  @Get(':docId/versions/:versionId/preview')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId') docId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documents.getPreviewUrl(docId, versionId, user);
  }

  // --- Luồng 12: thao tác tài liệu ---
  @Patch(':docId/move')
  @HttpCode(HttpStatus.OK)
  move(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string, @Body() dto: MoveDocumentDto) {
    return this.folders.moveDocument(docId, dto, user);
  }

  @Delete(':docId')
  @HttpCode(HttpStatus.OK)
  softDelete(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.folders.softDelete(docId, user);
  }

  @Post(':docId/restore-trash')
  @HttpCode(HttpStatus.OK)
  restoreTrash(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.folders.restoreFromTrash(docId, user);
  }

  // --- Luồng 12: Pessimistic Lock ---
  @Post(':docId/lock')
  @HttpCode(HttpStatus.OK)
  lock(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.folders.lock(docId, user);
  }

  // D4 (Phase 5): "Xin trả khóa" — không force unlock; gửi email cho owner.
  @Post(':docId/lock/request-release')
  @HttpCode(HttpStatus.OK)
  requestUnlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId') docId: string,
    @Body() body: { reason?: string },
  ) {
    return this.folders.requestUnlock(docId, body?.reason ?? '(không nêu lý do)', user);
  }

  @Delete(':docId/lock/force')
  @HttpCode(HttpStatus.OK)
  forceUnlock(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.folders.forceUnlock(docId, user);
  }

  @Delete(':docId/lock')
  @HttpCode(HttpStatus.OK)
  unlock(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.folders.unlock(docId, user);
  }

  @Patch(':docId/lock/heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Param('docId') docId: string) {
    return this.folders.heartbeat(docId, user);
  }
}
