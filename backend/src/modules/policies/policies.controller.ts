import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AdminGuard } from '../../core/guards/admin.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto, SimulatePolicyDto } from './dto/policies.dto';

/** Luồng 21, 22 — ABAC Policy Manager & Visual Rule Builder. */
@ApiTags('admin-policies')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  list() {
    return this.policies.listPolicies();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreatePolicyDto, @Req() req: Request) {
    return this.policies.createPolicy(dto, admin, this.ip(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.policies.deletePolicy(id, admin, this.ip(req));
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  simulate(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SimulatePolicyDto, @Req() req: Request) {
    return this.policies.simulate(dto, admin, this.ip(req));
  }

  private ip(req: Request): string {
    return (req.ip ?? '').replace('::ffff:', '');
  }
}
