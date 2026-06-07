import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';
import {
  ForgotPasswordRequestDto,
  LoginDto,
  RegisterRequestDto,
  ResetPasswordConfirmDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // Path '/api/v1' để cookie được gửi cho cả /auth/refresh và /profile/sessions
  private readonly cookiePath = '/api/v1';

  constructor(private readonly authService: AuthService) {}

  // --- Luồng 1: Login ---
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, this.ip(req), this.ua(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { message: result.message, accessToken: result.accessToken, user: result.user };
  }

  // --- Luồng 1: Refresh (đọc refresh_token từ HttpOnly cookie) ---
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    const result = await this.authService.refresh(token, this.ip(req), this.ua(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  // --- Logout (cần access token hợp lệ) ---
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sub, user.jti, req.cookies?.['refresh_token'], this.ip(req));
    this.clearRefreshCookie(res);
    return { message: 'Đăng xuất thành công.' };
  }

  // --- Luồng 2: Register (request OTP -> verify) ---
  @Public()
  @Post('register-request')
  @HttpCode(HttpStatus.OK)
  registerRequest(@Body() dto: RegisterRequestDto, @Req() req: Request) {
    return this.authService.registerRequest(dto, this.ip(req));
  }

  @Public()
  @Post('verify-register-otp')
  @HttpCode(HttpStatus.CREATED)
  verifyRegisterOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyRegisterOtp(dto, this.ip(req));
  }

  // --- Luồng 3: Forgot password ---
  @Public()
  @Post('forgot-password-request')
  @HttpCode(HttpStatus.OK)
  forgotPasswordRequest(@Body() dto: ForgotPasswordRequestDto, @Req() req: Request) {
    return this.authService.forgotPasswordRequest(dto, this.ip(req));
  }

  @Public()
  @Post('reset-password-confirm')
  @HttpCode(HttpStatus.OK)
  resetPasswordConfirm(@Body() dto: ResetPasswordConfirmDto, @Req() req: Request) {
    return this.authService.resetPasswordConfirm(dto, this.ip(req));
  }

  // --- Luồng 1: Google SSO ---
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    /* GoogleAuthGuard điều hướng sang trang đăng nhập Google */
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const ssoUser = req.user as { email?: string } | undefined;
    const base = process.env.APP_BASE_URL ?? 'http://localhost';
    try {
      const result = await this.authService.googleLogin(ssoUser?.email, this.ip(req), this.ua(req));
      this.setRefreshCookie(res, result.refreshToken);
      // C6 (Phase 5): redirect tới /auth/sso-callback để FE setSession + load /profile rồi
      // mới redirect dashboard (tránh hiện URL kèm token trong tab Dashboard).
      res.redirect(`${base}/auth/sso-callback?token=${result.accessToken}`);
    } catch {
      res.redirect(`${base}/auth/login?error=sso_denied`);
    }
  }

  // ---------------------------------------------------------------------------
  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }

  private ua(req: Request): string {
    return req.headers['user-agent'] ?? '';
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: this.cookiePath,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('refresh_token', { path: this.cookiePath });
  }
}
