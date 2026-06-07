import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../infra/database/prisma.service';
import { AuditService as CoreAuditService } from '../../core/audit/audit.service';
import { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ExportAuditDto, QueryAuditDto } from './dto/security.dto';

const SECURITY_ACTIONS = [
  'ACCESS_DENIED',
  'SECURITY_ALERT',
  'DOWNLOAD_DENIED',
  'REFRESH_REUSE_DETECTED',
  'INTEGRITY_COMPROMISED',
  'LOCKDOWN',
  'LOCKDOWN_RELEASE',
];

@Injectable()
export class SecurityAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: CoreAuditService,
  ) {}

  // --- Luồng 23: Ledger Dashboard (cursor pagination) ---
  async queryLogs(q: QueryAuditDto) {
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        q.cursor ? { id: { lt: BigInt(q.cursor) } } : {},
        q.userId ? { userId: q.userId } : {},
        q.ipAddress ? { ipAddress: { contains: q.ipAddress } } : {},
        q.action ? { action: q.action } : {},
        q.status !== undefined ? { isSuccess: q.status === 'true' } : {},
        q.startTime || q.endTime
          ? {
              timestamp: {
                ...(q.startTime ? { gte: new Date(q.startTime) } : {}),
                ...(q.endTime ? { lte: new Date(q.endTime) } : {}),
              },
            }
          : {},
      ],
    };

    const items = await this.prisma.auditLog.findMany({
      where,
      take: q.limit + 1,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });
    const hasMore = items.length > q.limit;
    const rows = items.slice(0, q.limit);
    const nextCursor = hasMore ? rows[rows.length - 1].id.toString() : null;

    return {
      logs: rows.map((r) => ({
        id: r.id.toString(),
        timestamp: r.timestamp,
        userId: r.userId,
        action: r.action,
        targetId: r.targetId,
        ipAddress: r.ipAddress,
        isSuccess: r.isSuccess,
        failReason: r.failReason,
        metadata: r.metadata,
        currentHash: r.currentHash,
      })),
      meta: { hasMore, nextCursor },
    };
  }

  // --- Luồng 24: Export CSV streaming (cursor + write-through) ---
  async exportCsv(dto: ExportAuditDto, admin: AuthenticatedUser, ip: string, res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_${dto.startTime}_${dto.endTime}.csv"`,
    );
    res.write('﻿'); // BOM cho Excel
    res.write('id,timestamp,user_id,action,target_id,ip_address,is_success,fail_reason,previous_hash,current_hash,metadata\n');

    const where = this.exportWhere(dto);
    const BATCH = 1000;
    let lastId = 0n;
    let total = 0;
    while (true) {
      const rows = await this.prisma.auditLog.findMany({
        where: { AND: [where, { id: { gt: lastId } }] },
        orderBy: { id: 'asc' },
        take: BATCH,
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        res.write(
          [
            r.id.toString(),
            r.timestamp.toISOString(),
            r.userId ?? '',
            r.action,
            r.targetId ?? '',
            r.ipAddress ?? '',
            r.isSuccess ? 'true' : 'false',
            this.csvEscape(r.failReason ?? ''),
            r.previousHash,
            r.currentHash,
            this.csvEscape(r.metadata ? JSON.stringify(r.metadata) : ''),
          ].join(',') + '\n',
        );
        total++;
      }
      lastId = rows[rows.length - 1].id;
    }
    res.end();
    await this.audit.log({ action: 'AUDIT_EXPORT', userId: admin.sub, ipAddress: ip, isSuccess: true, metadata: { format: 'CSV', scope: dto.scope ?? 'ALL', rows: total } });
  }

  // --- Luồng 24: Export PDF có Watermark + Digital Signature Footer ---
  async exportPdf(dto: ExportAuditDto, admin: AuthenticatedUser, ip: string, res: Response) {
    const where = this.exportWhere(dto);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: 1000, // Giới hạn PDF; dữ liệu lớn hơn dùng CSV
    });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const watermark = `Exported by ${admin.email} | ${new Date().toISOString()}`;
    const contentLines: string[] = [];
    // Helvetica (WinAnsi) không có glyph tiếng Việt; thay non-Latin1 bằng '?'.
    // Production khuyến nghị nhúng font Unicode (DejaVu Sans, Noto Sans).
    const toAscii = (s: string) => s.replace(/[^\x00-\xFF]/g, '?');

    const addPage = () => {
      const page = pdf.addPage([595, 842]); // A4 portrait
      page.drawText(toAscii(`VDT DMS - Audit Log Export`), { x: 40, y: 800, size: 14, font: bold });
      page.drawText(
        toAscii(`Time range: ${dto.startTime} -> ${dto.endTime} (scope=${dto.scope ?? 'ALL'})`),
        { x: 40, y: 782, size: 9, font },
      );
      // Watermark chéo, mờ
      page.drawText(toAscii(watermark), {
        x: 60, y: 420, size: 24, font,
        color: rgb(0.85, 0.85, 0.85), rotate: degrees(45), opacity: 0.4,
      });
      return page;
    };
    let page = addPage();
    let y = 760;
    for (const r of rows) {
      const line = `[${r.id}] ${r.timestamp.toISOString()} ${r.action} user=${r.userId ?? '-'} ip=${r.ipAddress ?? '-'} ok=${r.isSuccess} hash=${r.currentHash.slice(0, 12)}...`;
      contentLines.push(line);
      page.drawText(toAscii(line).slice(0, 130), { x: 40, y, size: 7, font });
      y -= 11;
      if (y < 60) {
        page = addPage();
        y = 760;
      }
    }

    // Digital signature footer: SHA-256 toàn bộ nội dung đã vẽ
    const digest = createHash('sha256').update(contentLines.join('\n')).digest('hex');
    const footerPage = pdf.addPage([595, 842]);
    footerPage.drawText('Digital Signature Footer (SHA-256 of rendered content):', { x: 40, y: 800, size: 11, font: bold });
    footerPage.drawText(digest, { x: 40, y: 780, size: 9, font });
    footerPage.drawText(
      toAscii(`Total rows: ${rows.length} (PDF capped at 1000; use CSV for larger exports)`),
      { x: 40, y: 760, size: 9, font },
    );
    footerPage.drawText(toAscii(watermark), {
      x: 60, y: 420, size: 24, font,
      color: rgb(0.85, 0.85, 0.85), rotate: degrees(45), opacity: 0.4,
    });

    const bytes = await pdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_${dto.startTime}_${dto.endTime}.pdf"`,
    );
    res.end(Buffer.from(bytes));
    await this.audit.log({ action: 'AUDIT_EXPORT', userId: admin.sub, ipAddress: ip, isSuccess: true, metadata: { format: 'PDF', scope: dto.scope ?? 'ALL', rows: rows.length, digest } });
  }

  // --- Luồng 25: Danh sách cảnh báo an ninh ---
  async listSecurityAlerts(limit = 50) {
    const rows = await this.prisma.auditLog.findMany({
      where: { action: { in: SECURITY_ACTIONS } },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      timestamp: r.timestamp,
      userId: r.userId,
      action: r.action,
      targetId: r.targetId,
      ipAddress: r.ipAddress,
      failReason: r.failReason,
    }));
  }

  // --- helpers ---
  private exportWhere(dto: ExportAuditDto): Prisma.AuditLogWhereInput {
    return {
      timestamp: { gte: new Date(dto.startTime), lte: new Date(dto.endTime) },
      ...(dto.scope === 'SECURITY_ONLY' ? { action: { in: SECURITY_ACTIONS } } : {}),
    };
  }

  private csvEscape(s: string): string {
    if (s === '' || s === null) return '';
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
}
