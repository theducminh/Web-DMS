import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Gửi email (Nodemailer). Nếu chưa cấu hình SMTP_HOST -> chế độ DEV: in OTP ra log
 * để test luồng mà không cần SMTP thật. (Có thể chuyển sang BullMQ mailer.worker sau.)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  }

  async sendOtp(email: string, otp: string, purpose: string): Promise<void> {
    const subject =
      purpose === 'register'
        ? 'VDT DMS — Mã xác thực đăng ký'
        : 'VDT DMS — Mã xác thực khôi phục mật khẩu';
    const text = `Mã xác thực của bạn là: ${otp} (hết hạn sau 5 phút).`;

    if (!this.transporter) {
      this.logger.warn(`[DEV-MAIL] To=${email} | ${subject} | OTP=${otp}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'VDT DMS <no-reply@vdt-dms.local>',
        to: email,
        subject,
        text,
      });
      this.logger.log(`[SMTP] ✓ Đã gửi ${subject} → ${email} (messageId=${info.messageId})`);
    } catch (err) {
      // Gửi mail lỗi không được làm sập luồng nghiệp vụ (OTP đã lưu Redis).
      this.logger.error(`[SMTP] ✗ Gửi email thất bại tới ${email}: ${(err as Error).message}. [Fallback] OTP=${otp}`);
    }
  }

  /** Gửi kết quả phê duyệt tài liệu cho tác giả (Luồng 17). */
  async sendReviewResult(
    email: string,
    payload: { documentTitle: string; decision: string; reason?: string; reviewerName?: string },
  ): Promise<void> {
    const label =
      payload.decision === 'APPROVE'
        ? 'đã được PHÊ DUYỆT'
        : payload.decision === 'REJECT'
          ? 'đã bị TỪ CHỐI'
          : payload.decision === 'REQUEST_UNLOCK'
            ? '— có YÊU CẦU TRẢ KHÓA'
            : 'cần được phê duyệt';
    const subject = `VDT DMS — Tài liệu "${payload.documentTitle}" ${label}`;
    const text =
      `Người duyệt: ${payload.reviewerName ?? 'N/A'}\nKết quả: ${payload.decision}` +
      (payload.reason ? `\nLý do/Ý kiến: ${payload.reason}` : '');

    if (!this.transporter) {
      this.logger.warn(`[DEV-MAIL] To=${email} | ${subject} | ${text.replace(/\n/g, ' | ')}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'VDT DMS <no-reply@vdt-dms.local>',
        to: email,
        subject,
        text,
      });
      this.logger.log(`[SMTP] ✓ Đã gửi ${subject} → ${email} (messageId=${info.messageId})`);
    } catch (err) {
      this.logger.error(`[SMTP] ✗ Gửi email review thất bại tới ${email}: ${(err as Error).message}`);
    }
  }

  /** Verify SMTP connection (sử dụng /api/v1/admin/system/smtp-status). */
  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.transporter) return { ok: false, message: 'SMTP_HOST chưa cấu hình (đang DEV-MAIL mode).' };
    try {
      await this.transporter.verify();
      return { ok: true, message: `SMTP server ${process.env.SMTP_HOST} accept connection.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
