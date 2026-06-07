import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/documents.dto';

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);

/** Luồng 15 — Upload Workspace. */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('projects/:projectId/documents')
export class DocumentUploadController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  // Hard limit 50MB chặn ngay tại Gateway (-> 413 PayloadTooLarge)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documents.upload(projectId, file, dto, user);
  }
}
