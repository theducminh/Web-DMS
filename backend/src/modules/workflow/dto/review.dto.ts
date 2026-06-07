import { IsIn, IsOptional, IsString } from 'class-validator';

/** Quyết định phê duyệt (Luồng 17). REJECT bắt buộc kèm comment >= 10 ký tự (kiểm ở service). */
export class ReviewDecisionDto {
  @IsIn(['APPROVE', 'REJECT'], { message: 'Hành động không hợp lệ.' })
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comment?: string;
}
