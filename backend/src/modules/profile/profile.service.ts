import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../infra/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { OtpService } from '../auth/otp.service';
import { MailService } from '../auth/mail.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  private readonly saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
  ) {}

  // B1 (Phase 5): Search nhân sự công ty cho dropdown — minimal info, không cần admin.
  async searchable(query: string, limit = 15) {
    const where: any = { status: 'ACTIVE' };
    if (query && query.trim().length > 0) {
      const q = query.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.profile.findMany({
      where,
      take: Math.min(Math.max(limit, 1), 50),
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        title: true,
        department: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      title: r.title,
      department: r.department?.name ?? null,
    }));
  }

  // D3 (Phase 5): Public profile (minimal) — mọi user authenticated xem được.
  // Khác với getProfile: không trả phone/dob/gender (privacy). Dùng cho "Click locked-by → profile".
  async getPublicProfile(userId: string) {
    const p = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { department: { select: { name: true } } },
    });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ.');
    return {
      id: p.id,
      email: p.email,
      fullName: p.fullName,
      displayName: p.displayName,
      department: p.department ? { name: p.department.name } : null,
      title: p.title,
      clearanceLevel: p.clearanceLevel,
      status: p.status,
      authProvider: p.authProvider,
      createdAt: p.createdAt,
    };
  }

  // --- Luồng 5: Xem hồ sơ ---
  async getProfile(userId: string) {
    const p = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { department: { select: { name: true } } },
    });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ.');
    return {
      id: p.id,
      email: p.email,
      fullName: p.fullName,
      displayName: p.displayName,
      phone: p.phone,
      department: p.department ? { name: p.department.name } : null,
      title: p.title,
      clearanceLevel: p.clearanceLevel,
      dob: p.dob,
      gender: p.gender,
      authProvider: p.authProvider,
      status: p.status,
    };
  }

  // --- Luồng 5: Gửi OTP xác thực cho user SSO trước khi sửa hồ sơ ---
  async requestUpdateOtp(userId: string): Promise<{ message: string }> {
    const p = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ.');
    const { otp } = await this.otp.generate('profile-update', p.email);
    await this.mail.sendOtp(p.email, otp, 'forgot');
    return { message: 'Mã OTP xác thực đã được gửi đến email công ty của bạn.' };
  }

  // --- Luồng 5: Cập nhật hồ sơ (xác thực danh tính trước khi ghi — FR-1.2.3) ---
  async updateProfile(userId: string, dto: UpdateProfileDto, ip: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ.');

    await this.verifyIdentity(profile, dto.authContext);

    // Chỉ cho phép sửa các trường cá nhân; thuộc tính ABAC do Admin quản lý.
    const before = {
      fullName: profile.fullName,
      dob: profile.dob,
      gender: profile.gender,
      phone: profile.phone,
    };
    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.dob !== undefined) data.dob = dto.dob ? new Date(dto.dob) : null;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.phone !== undefined) data.phone = dto.phone;

    const updated = await this.prisma.profile.update({ where: { id: userId }, data });

    await this.audit.log({
      action: 'PROFILE_UPDATED',
      userId,
      ipAddress: ip,
      isSuccess: true,
      metadata: {
        before,
        after: { fullName: updated.fullName, dob: updated.dob, gender: updated.gender, phone: updated.phone },
      },
    });

    return { message: 'Cập nhật hồ sơ thành công.' };
  }

  // --- Luồng 6: Đổi mật khẩu ---
  async changePassword(userId: string, dto: ChangePasswordDto, ip: string): Promise<{ message: string }> {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ.');

    if (profile.authProvider !== 'LOCAL' || !profile.passwordHash) {
      throw new BadRequestException('Tài khoản đăng nhập bằng Google không thể đổi mật khẩu tại đây.');
    }
    const ok = await bcrypt.compare(dto.currentPassword, profile.passwordHash);
    if (!ok) {
      await this.audit.log({ action: 'PASSWORD_CHANGED', userId, ipAddress: ip, isSuccess: false, failReason: 'Sai mật khẩu hiện tại' });
      throw new BadRequestException({ message: 'Mật khẩu hiện tại không chính xác.', error: 'INVALID_CURRENT_PASSWORD' });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    await this.prisma.profile.update({ where: { id: userId }, data: { passwordHash } });

    // Đổi mật khẩu -> thu hồi toàn bộ phiên (Force Logout mọi thiết bị)
    await this.auth.revokeAllSessions(userId);

    await this.audit.log({ action: 'PASSWORD_CHANGED', userId, ipAddress: ip, isSuccess: true });
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }

  // --- Xác thực danh tính theo provider ---
  private async verifyIdentity(profile: any, ctx: { type: string; value: string }): Promise<void> {
    if (profile.authProvider === 'LOCAL') {
      if (ctx.type !== 'PASSWORD' || !profile.passwordHash) {
        throw new BadRequestException('Yêu cầu xác thực bằng mật khẩu.');
      }
      const ok = await bcrypt.compare(ctx.value, profile.passwordHash);
      if (!ok) {
        throw new BadRequestException({
          message: 'Mật khẩu hiện tại không chính xác.',
          error: 'INVALID_CURRENT_PASSWORD',
        });
      }
    } else {
      // GOOGLE -> xác thực bằng OTP gửi qua email công ty
      if (ctx.type !== 'OTP') {
        throw new BadRequestException('Yêu cầu xác thực bằng OTP.');
      }
      const ok = await this.otp.verify('profile-update', profile.email, ctx.value);
      if (!ok) throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
    }
  }
}
