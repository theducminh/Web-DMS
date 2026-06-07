import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfraModule } from './infra/infra.module';
import { QueueModule } from './infra/queue/queue.module';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ReleasesModule } from './modules/releases/releases.module';
import { SecurityModule } from './modules/security/security.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { TemplatesModule } from './modules/templates/templates.module';

/**
 * Root Module — Modular Monolith.
 * Các domain module (auth, profile, admin, projects, documents, workflow,
 * releases, policies, security, search) sẽ được import dần trong Phase 3.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InfraModule,
    QueueModule,
    CoreModule,
    // --- Domain modules (Phase 3) ---
    AuthModule, //        [Luồng 1, 2, 3]
    DashboardModule, //   [Luồng 4]
    ProfileModule, //     [Luồng 5, 6]
    AdminModule, //       [Luồng 7, 8, 9]
    ProjectsModule, //    [Luồng 10, 11, 13, 14]
    DocumentsModule, //   [Luồng 12, 15, 16, 18]
    WorkflowModule, //    [Luồng 17]
    ReleasesModule, //    [Luồng 19, 20]
    SecurityModule, //    [Luồng 23, 24, 25]
    PoliciesModule, //    [Luồng 21, 22]
    TemplatesModule, //   [Luồng 26]
    // SearchModule,      // [Global Search]
  ],
})
export class AppModule {}
