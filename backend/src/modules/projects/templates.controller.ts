import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infra/database/prisma.service';

interface TemplateFolderNode {
  name: string;
  parentPath: string | null;
  isLocked: boolean;
  displayOrder: number;
  description: string | null;
  children: TemplateFolderNode[];
}

/**
 * GET /api/v1/project-templates (Luồng 11) — danh sách mẫu + cây thư mục để Preview.
 * Chỉ trả các mẫu đang active.
 */
@ApiTags('projects')
@ApiBearerAuth()
@Controller('project-templates')
export class ProjectTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const templates = await this.prisma.projectTemplate.findMany({
      where: { isActive: true },
      include: { folders: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      templateType: t.templateType,
      description: t.description,
      folders: this.buildTree(t.folders),
    }));
  }

  // Dựng cây từ parent_path materialized
  private buildTree(
    folders: { name: string; parentPath: string | null; isLocked: boolean; displayOrder: number; description: string | null }[],
  ): TemplateFolderNode[] {
    const nodes = new Map<string, TemplateFolderNode>();
    const roots: TemplateFolderNode[] = [];

    const sorted = [...folders].sort(
      (a, b) =>
        (a.parentPath ? a.parentPath.split('/').length : 0) -
          (b.parentPath ? b.parentPath.split('/').length : 0) || a.displayOrder - b.displayOrder,
    );

    for (const f of sorted) {
      const node: TemplateFolderNode = { ...f, children: [] };
      const ownPath = f.parentPath ? `${f.parentPath}/${f.name}` : f.name;
      nodes.set(ownPath, node);
      if (f.parentPath && nodes.has(f.parentPath)) {
        nodes.get(f.parentPath)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }
}
