import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../infra/database/prisma.service';
import { RedisService } from '../../infra/cache/redis.service';
import { AuditService } from '../../core/audit/audit.service';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import {
  ForgotPasswordRequestDto,
  LoginDto,
  RegisterRequestDto,
  ResetPasswordConfirmDto,
  VerifyOtpDto,
} from './dto/auth.dto';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface SessionInfo {
  id: string; // = refresh jti
  userAgent: string;
  ipAddress: string;
  isCurrent: boolean;
  lastActiveAt: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  private readonly accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
  private readonly refreshTtl = process.env.JWT_REFRESH_TTL ?? '7d';
  // Để trống = chấp nhận MỌI email (kể cả @gmail.com). Set giá trị (vd 'viettel.com.vn')
  // chỉ khi muốn giới hạn domain công ty cho Google SSO.
  private readonly allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN ?? '').trim();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
  ) {}

  // =========================================================================
  // LOGIN (Luồng 1)
  // =========================================================================
  async login(
    dto: LoginDto,
    ip: string,
    userAgent?: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string; user: any }> {
    const email = dto.email.toLowerCase();
    await this.assertNotBruteForced(email);

    const profile = await this.prisma.profile.findUnique({
      where: { email },
      include: { department: true },
    });

    const passwordOk =
      profile?.passwordHash != null && (await bcrypt.compare(dto.password, profile.passwordHash));

    if (!profile || !passwordOk) {
      await this.registerFailedAttempt(email);
      await this.audit.log({
        action: 'LOGIN',
        userId: profile?.id ?? null,
        ipAddress: ip,
        isSuccess: false,
        failReason: 'Sai email hoặc mật khẩu',
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    if (profile.status !== 'ACTIVE') {
      await this.audit.log({
        action: 'LOGIN',
        userId: profile.id,
        ipAddress: ip,
        isSuccess: false,
        failReason: `Tài khoản trạng thái ${profile.status}`,
      });
      throw new ForbiddenException(
        profile.status === 'PENDING'
          ? 'Tài khoản đang chờ Admin phê duyệt.'
          : 'Tài khoản của bạn đã bị Admin vô hiệu hóa. Vui lòng liên hệ IT Helpdesk.',
      );
    }

    await this.clearFailedAttempts(email);
    const tokens = await this.issueTokens(profile, { ip, userAgent });

    await this.audit.log({ action: 'LOGIN', userId: profile.id, ipAddress: ip, isSuccess: true });

    return {
      message: 'Đăng nhập thành công',
      ...tokens,
      user: this.publicUser(profile),
    };
  }

  // =========================================================================
  // REFRESH (Luồng 1) — Refresh Token Rotation + phát hiện tái sử dụng
  // =========================================================================
  async refresh(
    refreshToken: string | undefined,
    ip: string,
    userAgent?: string,
  ): Promise<IssuedTokens & { user: any }> {
    if (!refreshToken) throw new UnauthorizedException('Thiếu refresh token.');

    let payload: { sub: string; jti: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.');
    }

    const exists = await this.redis.client.get(`refresh:${payload.sub}:${payload.jti}`);
    if (!exists) {
      // Token cũ (đã xoay) bị dùng lại => nghi bị đánh cắp => thu hồi toàn bộ phiên.
      await this.revokeAllSessions(payload.sub);
      await this.audit.log({
        action: 'REFRESH_REUSE_DETECTED',
        userId: payload.sub,
        ipAddress: ip,
        isSuccess: false,
        failReason: 'Refresh token đã bị thu hồi được dùng lại — thu hồi toàn bộ phiên',
      });
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    }

    // Xoay vòng: hủy refresh jti cũ + session hash cũ
    await this.redis.client.del(`refresh:${payload.sub}:${payload.jti}`);
    await this.redis.client.srem(`user:sessions:${payload.sub}`, payload.jti);
    await this.redis.client.del(`session:${payload.sub}:${payload.jti}`);

    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });
    if (!profile || profile.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không khả dụng.');
    }

    const tokens = await this.issueTokens(profile, { ip, userAgent });
    return { ...tokens, user: this.publicUser(profile) };
  }

  // =========================================================================
  // LOGOUT
  // =========================================================================
  async logout(userId: string, accessJti: string | undefined, refreshToken: string | undefined, ip: string): Promise<void> {
    if (accessJti) {
      await this.redis.client.set(`blacklist:${accessJti}`, '1', 'EX', this.ttlSeconds(this.accessTtl));
      await this.redis.client.srem(`user:access:${userId}`, accessJti);
    }
    if (refreshToken) {
      try {
        const p = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
        await this.redis.client.del(`refresh:${p.sub}:${p.jti}`);
        await this.redis.client.srem(`user:sessions:${p.sub}`, p.jti);
      } catch {
        /* token đã hỏng — bỏ qua */
      }
    }
    await this.audit.log({ action: 'LOGOUT', userId, ipAddress: ip, isSuccess: true });
  }

  // =========================================================================
  // REGISTER (Luồng 2) — 2 bước: request OTP -> verify tạo tài khoản PENDING
  // =========================================================================
  async registerRequest(dto: RegisterRequestDto, ip: string): Promise<{ message: string; expiresIn: number }> {
    const email = dto.email.toLowerCase();

    const existed = await this.prisma.profile.findUnique({ where: { email } });
    if (existed) {
      throw new BadRequestException('Email này đã được đăng ký trong hệ thống.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    // Lưu tạm thông tin đăng ký (đã băm mật khẩu) chờ xác thực OTP
    await this.redis.client.set(
      `pending:register:${email}`,
      JSON.stringify({
        email,
        fullName: dto.fullName,
        displayName: dto.displayName ?? null,
        dob: dto.dob ?? null,
        gender: dto.gender ?? null,
        passwordHash,
      }),
      'EX',
      Number(process.env.OTP_TTL_SECONDS ?? 300),
    );

    const { otp, expiresIn } = await this.otp.generate('register', email);
    await this.mail.sendOtp(email, otp, 'register');

    await this.audit.log({ action: 'REGISTER_ATTEMPT', ipAddress: ip, isSuccess: true, targetId: email });
    return { message: `Mã xác thực đã được gửi đến ${email}. Vui lòng kiểm tra hộp thư.`, expiresIn };
  }

  async verifyRegisterOtp(dto: VerifyOtpDto, ip: string): Promise<{ message: string; userId: string }> {
    const email = dto.email.toLowerCase();
    const valid = await this.otp.verify('register', email, dto.otp);
    if (!valid) throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');

    const raw = await this.redis.client.get(`pending:register:${email}`);
    if (!raw) throw new BadRequestException('Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.');
    const data = JSON.parse(raw);

    // Tài khoản mới: PENDING + department NULL (chờ Admin gán) — FR-1.2.1
    const profile = await this.prisma.profile.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        displayName: data.displayName,
        dob: data.dob ? new Date(data.dob) : null,
        gender: data.gender,
        passwordHash: data.passwordHash,
        authProvider: 'LOCAL',
        status: 'PENDING',
      },
    });
    await this.redis.client.del(`pending:register:${email}`);

    await this.audit.log({ action: 'REGISTER_SUCCESS', userId: profile.id, ipAddress: ip, isSuccess: true });
    return {
      message: 'Xác thực thành công. Tài khoản của bạn đã được tạo và đang chờ Admin phê duyệt.',
      userId: profile.id,
    };
  }

  // =========================================================================
  // FORGOT PASSWORD (Luồng 3)
  // =========================================================================
  async forgotPasswordRequest(dto: ForgotPasswordRequestDto, ip: string): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const profile = await this.prisma.profile.findUnique({ where: { email } });

    // Chống User Enumeration: luôn trả về thông báo chung chung
    if (profile && profile.passwordHash) {
      const { otp } = await this.otp.generate('forgot', email);
      await this.mail.sendOtp(email, otp, 'forgot');
    }
    await this.audit.log({ action: 'PASSWORD_RESET_REQUESTED', userId: profile?.id ?? null, ipAddress: ip, isSuccess: true, targetId: email });
    return { message: 'Nếu email tồn tại trong hệ thống, một mã OTP đã được gửi đi.' };
  }

  async resetPasswordConfirm(dto: ResetPasswordConfirmDto, ip: string): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const valid = await this.otp.verify('forgot', email, dto.otp);
    if (!valid) throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');

    const profile = await this.prisma.profile.findUnique({ where: { email } });
    if (!profile) throw new BadRequestException('Yêu cầu không hợp lệ.');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    await this.prisma.profile.update({ where: { id: profile.id }, data: { passwordHash } });

    // Force Session Eviction: đá toàn bộ phiên cũ trên mọi thiết bị
    await this.revokeAllSessions(profile.id);

    await this.audit.log({ action: 'PASSWORD_RESET_SUCCESS', userId: profile.id, ipAddress: ip, isSuccess: true });
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }

  // =========================================================================
  // GOOGLE SSO (Luồng 1) — domain restriction OPT-IN qua ALLOWED_EMAIL_DOMAIN.
  // Để trống (mặc định) = chấp nhận mọi email Google đã verify trong DB profiles.
  // =========================================================================
  async googleLogin(
    email: string | undefined,
    ip: string,
    userAgent?: string,
  ): Promise<IssuedTokens & { user: any }> {
    if (!email) {
      await this.audit.log({
        action: 'LOGIN_GOOGLE',
        ipAddress: ip,
        isSuccess: false,
        failReason: 'Google trả về thiếu email',
      });
      throw new ForbiddenException('Không lấy được email từ Google.');
    }

    const lower = email.toLowerCase();
    if (this.allowedDomain && !lower.endsWith(`@${this.allowedDomain}`)) {
      await this.audit.log({
        action: 'LOGIN_GOOGLE',
        ipAddress: ip,
        isSuccess: false,
        failReason: `Email không thuộc domain ${this.allowedDomain}`,
        targetId: email,
      });
      throw new ForbiddenException(`Chỉ chấp nhận email thuộc tên miền @${this.allowedDomain}.`);
    }

    const profile = await this.prisma.profile.findUnique({
      where: { email: lower },
      include: { department: true },
    });
    if (!profile || profile.status !== 'ACTIVE') {
      await this.audit.log({ action: 'LOGIN_GOOGLE', userId: profile?.id ?? null, ipAddress: ip, isSuccess: false, failReason: 'Tài khoản không tồn tại/không active' });
      throw new ForbiddenException('Tài khoản chưa được kích hoạt trong hệ thống.');
    }

    const tokens = await this.issueTokens(profile, { ip, userAgent });
    await this.audit.log({ action: 'LOGIN_GOOGLE', userId: profile.id, ipAddress: ip, isSuccess: true });
    return { ...tokens, user: this.publicUser(profile) };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================
  /** Thu hồi toàn bộ phiên của user (Force Logout) — dùng bởi reset password, admin disable, lockdown. */
  async revokeAllSessions(userId: string): Promise<void> {
    const refreshJtis = await this.redis.client.smembers(`user:sessions:${userId}`);
    const pipeline = this.redis.client.pipeline();
    for (const jti of refreshJtis) pipeline.del(`refresh:${userId}:${jti}`);
    pipeline.del(`user:sessions:${userId}`);

    const accessJtis = await this.redis.client.smembers(`user:access:${userId}`);
    for (const jti of accessJtis) pipeline.set(`blacklist:${jti}`, '1', 'EX', this.ttlSeconds(this.accessTtl));
    pipeline.del(`user:access:${userId}`);

    // Hủy cache quyền ABAC của user (TTL 5 phút bị xóa ngay)
    pipeline.del(`abac:cache:${userId}`);
    await pipeline.exec();
  }

  private async issueTokens(profile: any, meta: SessionMeta = {}): Promise<IssuedTokens> {
    const accessJti = randomUUID();
    const accessPayload = {
      sub: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      department: profile.department?.name ?? null,
      title: profile.title ?? null,
      clearanceLevel: profile.clearanceLevel,
      authProvider: profile.authProvider,
      jti: accessJti,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: this.accessTtl,
    });

    const refreshJti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: profile.id, jti: refreshJti, type: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: this.refreshTtl },
    );

    const refreshSeconds = this.ttlSeconds(this.refreshTtl);
    const now = new Date().toISOString();
    const pipeline = this.redis.client.pipeline();
    pipeline.set(`refresh:${profile.id}:${refreshJti}`, '1', 'EX', refreshSeconds);
    pipeline.sadd(`user:sessions:${profile.id}`, refreshJti);
    pipeline.sadd(`user:access:${profile.id}`, accessJti);
    // Metadata phiên để liệt kê/thu hồi (Luồng 6)
    pipeline.hset(`session:${profile.id}:${refreshJti}`, {
      accessJti,
      userAgent: meta.userAgent ?? '',
      ip: meta.ip ?? '',
      createdAt: now,
      lastActiveAt: now,
    });
    pipeline.expire(`session:${profile.id}:${refreshJti}`, refreshSeconds);
    await pipeline.exec();

    return { accessToken, refreshToken };
  }

  // --- Quản lý phiên (Luồng 6) ---
  async getRefreshJti(refreshToken: string | undefined): Promise<string | null> {
    if (!refreshToken) return null;
    try {
      const p = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      return p.jti ?? null;
    } catch {
      return null;
    }
  }

  async listSessions(userId: string, currentRefreshJti?: string | null): Promise<SessionInfo[]> {
    const jtis = await this.redis.client.smembers(`user:sessions:${userId}`);
    const sessions: SessionInfo[] = [];
    for (const jti of jtis) {
      const h = await this.redis.client.hgetall(`session:${userId}:${jti}`);
      if (!h || Object.keys(h).length === 0) continue;
      sessions.push({
        id: jti,
        userAgent: h.userAgent ?? '',
        ipAddress: h.ip ?? '',
        isCurrent: jti === currentRefreshJti,
        lastActiveAt: h.lastActiveAt ?? '',
        createdAt: h.createdAt ?? '',
      });
    }
    return sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const h = await this.redis.client.hgetall(`session:${userId}:${sessionId}`);
    const pipeline = this.redis.client.pipeline();
    if (h?.accessJti) {
      pipeline.set(`blacklist:${h.accessJti}`, '1', 'EX', this.ttlSeconds(this.accessTtl));
      pipeline.srem(`user:access:${userId}`, h.accessJti);
    }
    pipeline.del(`refresh:${userId}:${sessionId}`);
    pipeline.srem(`user:sessions:${userId}`, sessionId);
    pipeline.del(`session:${userId}:${sessionId}`);
    await pipeline.exec();
  }

  async revokeOtherSessions(userId: string, currentRefreshJti: string | null): Promise<void> {
    const jtis = await this.redis.client.smembers(`user:sessions:${userId}`);
    for (const jti of jtis) {
      if (jti !== currentRefreshJti) await this.revokeSession(userId, jti);
    }
  }

  /** Thu hồi phiên của user trừ một jti (dùng cho Emergency Lockdown — giữ phiên admin). */
  async revokeAllExcept(userId: string, exceptJti: string | null): Promise<void> {
    return this.revokeOtherSessions(userId, exceptJti);
  }

  private publicUser(profile: any) {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      department: profile.department?.name ?? null,
      title: profile.title ?? null,
      clearanceLevel: profile.clearanceLevel,
      authProvider: profile.authProvider,
    };
  }

  // --- Chống brute-force: sai >=3 lần -> khóa 60s (FR Login) ---
  private failKey(email: string): string {
    return `login:fail:${email}`;
  }
  private async assertNotBruteForced(email: string): Promise<void> {
    const count = Number((await this.redis.client.get(this.failKey(email))) ?? 0);
    if (count >= 3) {
      throw new HttpException(
        'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 60 giây.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
  private async registerFailedAttempt(email: string): Promise<void> {
    const k = this.failKey(email);
    const count = await this.redis.client.incr(k);
    if (count === 1) await this.redis.client.expire(k, 60);
  }
  private async clearFailedAttempts(email: string): Promise<void> {
    await this.redis.client.del(this.failKey(email));
  }

  /** Chuyển '15m'/'7d'/'30s'/'2h' -> số giây. */
  private ttlSeconds(ttl: string): number {
    const m = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!m) return Number(ttl) || 900;
    const n = Number(m[1]);
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
  }
}
