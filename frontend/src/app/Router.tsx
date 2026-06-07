import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import { ProtectedRoute } from './ProtectedRoute';
import { MainLayout } from '../widgets/layout/MainLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { SsoCallbackPage } from '../pages/auth/SsoCallbackPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { SecurityPage } from '../pages/profile/SecurityPage';
import { UserPublicProfilePage } from '../pages/profile/UserPublicProfilePage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ProjectListPage } from '../pages/projects/ProjectListPage';
import { ProjectCreatePage } from '../pages/projects/ProjectCreatePage';
import { ProjectTeamPage } from '../pages/projects/ProjectTeamPage';
import { ProjectSettingsPage } from '../pages/projects/ProjectSettingsPage';
import { FolderPage } from '../pages/documents/FolderPage';
import { DocumentDiffPage } from '../pages/documents/DocumentDiffPage';
import { DocumentUploadPage } from '../pages/documents/DocumentUploadPage';
import { DocumentDetailPage } from '../pages/documents/DocumentDetailPage';
import { DocumentReviewPage } from '../pages/documents/DocumentReviewPage';
import { AuditExportPage } from '../pages/admin/AuditExportPage';
import { AuditLedgerPage } from '../pages/admin/AuditLedgerPage';
import { TamperHubPage } from '../pages/admin/TamperHubPage';
import { PolicyBuilderPage } from '../pages/admin/PolicyBuilderPage';
import { PolicyGuidePage } from '../pages/admin/PolicyGuidePage';
import { DepartmentsPage } from '../pages/admin/DepartmentsPage';
import { UserDirectoryPage } from '../pages/admin/UserDirectoryPage';
import { AttributeAssignmentPage } from '../pages/admin/AttributeAssignmentPage';
import { TemplateTreeBuilderPage } from '../pages/admin/TemplateTreeBuilderPage';
import { ReleaseListPage } from '../pages/releases/ReleaseListPage';
import { CompliancePage } from '../pages/releases/CompliancePage';

/**
 * Full route map:
 *   /auth/login                                — Luồng 1
 *   /auth/register                             — Luồng 2 (Stepper 2 bước)
 *   /auth/forgot-password                      — Luồng 3 (Stepper 3 bước)
 *   /dashboard                                 — Luồng 4
 *   /profile                                   — Luồng 5 (Password Gate Modal)
 *   /profile/security                          — Luồng 6 (Change Password + Sessions)
 *   /projects                                  — Luồng 10
 *   /projects/create                           — Luồng 11 (Wizard 2 bước)
 *   /projects/:projectId/team                  — Luồng 13 (Team Grid + AddMember Modal)
 *   /projects/:projectId/settings              — Luồng 14 (General + Danger Zone Archive)
 *   /projects/:projectId/folders/:folderId     — Luồng 12
 *   /projects/:projectId/documents/upload      — Luồng 15 (Dropzone + Progress)
 *   /documents/:docId/detail                   — Luồng 16 (3 Tabs + Lock)
 *   /documents/:docId/review                   — Luồng 17 (Approve/Reject Split)
 *   /admin/audit-logs/export                   — Luồng 24 (Compliance Export)
 *   /projects/:projectId/releases              — Luồng 19
 *   /projects/:projectId/releases/:releaseId   — Luồng 20 (Compliance + Export)
 *   /documents/diff                            — Luồng 18
 *   /admin/users                               — Luồng 7
 *   /admin/users/:userId/attributes            — Luồng 8
 *   /admin/departments                         — Luồng 9
 *   /admin/project-templates                   — Luồng 26
 *   /admin/audit-logs                          — Luồng 23
 *   /admin/security-alerts                     — Luồng 25 (Tamper Hub + Lockdown)
 *   /admin/policies/builder                    — Luồng 21+22 (Manager + Builder + Simulator)
 */
const router = createBrowserRouter([
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/auth/register', element: <RegisterPage /> },
  { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/auth/sso-callback', element: <SsoCallbackPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'projects', element: <ProjectListPage /> },
      { path: 'projects/create', element: <ProjectCreatePage /> },
      { path: 'projects/:projectId/team', element: <ProjectTeamPage /> },
      { path: 'projects/:projectId/settings', element: <ProjectSettingsPage /> },
      { path: 'projects/:projectId/folders/:folderId', element: <FolderPage /> },
      { path: 'projects/:projectId/documents/upload', element: <DocumentUploadPage /> },
      { path: 'documents/:docId/detail', element: <DocumentDetailPage /> },
      { path: 'documents/:docId/review', element: <DocumentReviewPage /> },
      { path: 'projects/:projectId/releases', element: <ReleaseListPage /> },
      { path: 'projects/:projectId/releases/:releaseId', element: <CompliancePage /> },
      { path: 'documents/diff', element: <DocumentDiffPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'profile/security', element: <SecurityPage /> },
      { path: 'users/:userId', element: <UserPublicProfilePage /> },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute adminOnly>
            <UserDirectoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/users/:userId/attributes',
        element: (
          <ProtectedRoute adminOnly>
            <AttributeAssignmentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/departments',
        element: (
          <ProtectedRoute adminOnly>
            <DepartmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/project-templates',
        element: (
          <ProtectedRoute adminOnly>
            <TemplateTreeBuilderPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/audit-logs',
        element: (
          <ProtectedRoute adminOnly>
            <AuditLedgerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/audit-logs/export',
        element: (
          <ProtectedRoute adminOnly>
            <AuditExportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/security-alerts',
        element: (
          <ProtectedRoute adminOnly>
            <TamperHubPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/policies/builder',
        element: (
          <ProtectedRoute adminOnly>
            <PolicyBuilderPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/policies/guide',
        element: (
          <ProtectedRoute adminOnly>
            <PolicyGuidePage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
