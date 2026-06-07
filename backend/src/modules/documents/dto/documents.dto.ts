import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const SECURITY_LEVEL = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'] as const;

// --- Luồng 12: Folder ---
export class CreateFolderDto {
  @IsString()
  @MinLength(1, { message: 'Tên thư mục không được trống.' })
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class MoveDocumentDto {
  @IsUUID()
  newFolderId!: string;
}

// --- Luồng 15: Upload metadata (multipart/form-data) ---
export class UploadDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsIn(SECURITY_LEVEL)
  securityLevel?: (typeof SECURITY_LEVEL)[number];

  @IsString()
  @MinLength(1, { message: 'Commit message là bắt buộc.' })
  commitMessage!: string;

  // Nếu có -> upload version mới cho tài liệu đang tồn tại; nếu không -> tạo tài liệu mới
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
