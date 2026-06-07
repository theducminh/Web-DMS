import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AdminGuard } from '../../core/guards/admin.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { AdminUsersService } from './users.service';
import {
  BulkAttributesDto,
  BulkStatusDto,
  QueryUsersDto,
  UpdateAttributesDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  // --- Luồng 7 ---
  @Get()
  findUsers(@Query() query: QueryUsersDto) {
    return this.users.findUsers(query);
  }

  @Patch('bulk-status')
  @HttpCode(HttpStatus.OK)
  bulkStatus(@Body() dto: BulkStatusDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    return this.users.bulkStatus(dto, admin.sub, this.ip(req));
  }

  @Patch('bulk-attributes')
  @HttpCode(HttpStatus.OK)
  bulkAttributes(@Body() dto: BulkAttributesDto, @CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    return this.users.bulkAttributes(dto, admin.sub, this.ip(req));
  }

  // --- Luồng 8 ---
  @Get(':userId/attributes')
  getAttributes(@Param('userId') userId: string) {
    return this.users.getUserAttributes(userId);
  }

  @Put(':userId/attributes')
  updateAttributes(
    @Param('userId') userId: string,
    @Body() dto: UpdateAttributesDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.users.updateUserAttributes(userId, dto, admin.sub, this.ip(req));
  }

  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }
}
