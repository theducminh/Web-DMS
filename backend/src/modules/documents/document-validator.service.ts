import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

/**
 * F4 (Phase 6) — SOLID Refactor: tách Validation khỏi DocumentsService.
 *
 * SRP (Single Responsibility): Class này chỉ có MỘT lý do để thay đổi -
 * khi luật validate input upload tài liệu thay đổi (định dạng mới, tên trùng lặp,
 * trạng thái tài liệu nguồn...). Không đụng chạm tới logic storage, audit, queue.
 *
 * OCP (Open-Closed): Thêm luật mới (vd: limit độ dài tên) chỉ cần thêm 1 method
 * public mới. KHÔNG sửa method cũ. DocumentsService gọi qua interface stable.
 */

export const ALLOWED_DOCUMENT_TYPES = ['pdf', 'docx', 'md', 'txt'] as const;
export const EXTRACTABLE_DOCUMENT_TYPES = ['pdf', 'docx', 'md', 'txt'] as const;

export type DocumentFileType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

@Injectable()
export class DocumentValidator {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate đuôi file + trả về fileType chuẩn hóa (lower-case, không dấu chấm).
   * Throw BadRequestException nếu định dạng không nằm trong whitelist.
   */
  validateFileType(originalname: string): DocumentFileType {
    const ext = (originalname.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_DOCUMENT_TYPES.includes(ext as DocumentFileType)) {
      throw new BadRequestException(
        `Định dạng không hỗ trợ. Chỉ chấp nhận: ${ALLOWED_DOCUMENT_TYPES.join(', ')}.`,
      );
    }
    return ext as DocumentFileType;
  }

  /**
   * Khi upload version mới — tài liệu nguồn phải tồn tại + đúng project +
   * KHÔNG được ở trạng thái UNDER_REVIEW (đang chờ duyệt thì không nhận bản mới).
   */
  async assertDocumentEditable(documentId: string, projectId: string): Promise<void> {
    const existing = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { projectId: true, status: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException('Tài liệu không tồn tại trong dự án.');
    }
    if (existing.status === 'UNDER_REVIEW') {
      throw new ForbiddenException('Tài liệu đang chờ duyệt, không thể tải bản mới.');
    }
  }

  /**
   * Tạo tài liệu mới — chống trùng tên (cùng folder, không tính soft-deleted).
   * Throw BadRequestException + gợi ý dùng "Upload version mới" cho UX tốt hơn.
   */
  async assertNoDuplicateTitle(projectId: string, folderId: string | null, title: string): Promise<void> {
    const dup = await this.prisma.document.findFirst({
      where: { projectId, folderId, title, isDeleted: false },
      select: { id: true },
    });
    if (dup) {
      throw new BadRequestException(
        `Tài liệu tên "${title}" đã tồn tại trong thư mục này. Vui lòng đổi tên hoặc bấm "Upload version mới" trên tài liệu cũ.`,
      );
    }
  }
}
