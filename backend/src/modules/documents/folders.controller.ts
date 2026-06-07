import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { FoldersService } from './folders.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/documents.dto';

/** Luồng 12 — Folder Navigator (phạm vi dự án). */
@ApiTags('documents')
@ApiBearerAuth()
@Controller('projects/:projectId')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get('folders/:folderId')
  getContents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.folders.getContents(projectId, folderId, user);
  }

  @Post('folders')
  @HttpCode(HttpStatus.CREATED)
  createFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.folders.createFolder(projectId, dto, user);
  }

  @Patch('folders/:folderId')
  @HttpCode(HttpStatus.OK)
  updateFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folders.updateFolder(projectId, folderId, dto, user);
  }

  @Get('trash')
  listTrash(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string) {
    return this.folders.listTrash(projectId, user);
  }
}
