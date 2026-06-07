import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ProfileService } from './profile.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // --- Luồng 5 ---
  @Get()
  getProfile(@CurrentUser('sub') userId: string) {
    return this.profileService.getProfile(userId);
  }

  // B1 (Phase 5): Search nhân sự công ty cho dropdown (mọi user authenticated được gọi).
  // Khác với /admin/users (yêu cầu Admin): endpoint này chỉ trả minimal info (id, fullName, email,
  // title, department.name) để PM dùng trong Wizard tạo dự án + AddMemberModal khi chưa có
  // projectId context.
  @Get('searchable')
  searchable(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.profileService.searchable(q ?? '', Number(limit ?? 15));
  }

  // D3 (Phase 5): Public profile (minimal info) cho click "Khóa bởi uuid" → trang profile public.
  // KHÁC với GET / (trả profile của chính user đang login).
  @Get('public/:userId')
  getPublic(@Param('userId') userId: string) {
    return this.profileService.getPublicProfile(userId);
  }

  @Post('request-update-otp')
  @HttpCode(HttpStatus.OK)
  requestUpdateOtp(@CurrentUser('sub') userId: string) {
    return this.profileService.requestUpdateOtp(userId);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.profileService.updateProfile(user.sub, dto, this.ip(req));
  }

  // --- Luồng 6: Đổi mật khẩu ---
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.profileService.changePassword(user.sub, dto, this.ip(req));
  }

  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }
}
