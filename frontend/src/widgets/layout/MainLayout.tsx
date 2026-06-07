import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../entities/session/session.store';
import { logoutRequest } from '../../features/auth-actions/api/auth.api';

const navItem =
  'px-3 py-2 rounded text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors';
const navItemActive = 'bg-viettel-red text-white';

/** Clearance level → màu chip (Phase 5 B5 redesign). */
const CLEARANCE_COLOR: Record<string, string> = {
  PUBLIC: 'bg-gray-100 text-gray-700 border-gray-300',
  INTERNAL: 'bg-blue-50 text-blue-700 border-blue-300',
  CONFIDENTIAL: 'bg-red-50 text-red-700 border-red-300',
};

export function MainLayout() {
  const user = useSessionStore((s) => s.user);
  const isAdmin = useSessionStore((s) => s.isAdmin());
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const onLogout = async () => {
    await logoutRequest();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-viettel-dark text-gray-300 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-700">
          <Link to="/dashboard" className="text-xl font-bold text-viettel-red">
            VDT DMS
          </Link>
          <p className="text-xs text-gray-400 mt-1">Zero-Trust DMS</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/projects"
            className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
          >
            Dự án
          </NavLink>
          <NavLink
            to="/documents/diff"
            className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
          >
            So sánh Diff
          </NavLink>
          {isAdmin && (
            <>
              <div className="mt-4 px-3 text-xs uppercase text-gray-500">Admin · Nhân sự</div>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
              >
                👥 User Directory
              </NavLink>
              <NavLink
                to="/admin/departments"
                className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
              >
                🏢 Phòng ban
              </NavLink>
              <NavLink
                to="/admin/project-templates"
                className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
              >
                📐 Project Templates
              </NavLink>
              <div className="mt-4 px-3 text-xs uppercase text-gray-500">Admin · An ninh</div>
              <NavLink
                to="/admin/audit-logs"
                className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
              >
                📜 Audit Logs
              </NavLink>
              <NavLink
                to="/admin/security-alerts"
                className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
              >
                🛡️ Tamper Hub
              </NavLink>
              <NavLink
                to="/admin/policies/builder"
                className={({ isActive }) => `${navItem} block ${isActive ? navItemActive : ''}`}
              >
                ⚙️ Policy Builder
              </NavLink>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-gray-700 text-xs text-gray-400">
          v0.1 — VDT Capstone
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar B5 redesign: chip role + chip department + avatar dropdown */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {user?.department && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium"
                title="Phòng ban"
              >
                <span className="text-blue-500">Phòng ban:</span> {user.department}
              </span>
            )}
            {user?.title && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium"
                title="Chức danh"
              >
                <span className="text-purple-500">Chức danh:</span> {user.title}
              </span>
            )}
            {user?.clearanceLevel && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                  CLEARANCE_COLOR[user.clearanceLevel] ?? 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
                title="Cấp độ bảo mật ABAC"
              >
                Cấp bảo mật: {user.clearanceLevel}
              </span>
            )}
          </div>

          {/* Avatar + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-viettel-red text-white flex items-center justify-center text-sm font-bold">
                {(user?.fullName ?? user?.email ?? '?').charAt(0).toUpperCase()}
              </span>
              <div className="text-left hidden md:block">
                <div className="text-sm font-medium leading-tight">
                  {user?.fullName ?? user?.email}
                </div>
                <div className="text-xs text-gray-500 leading-tight">{user?.email}</div>
              </div>
              <span className={`text-gray-400 text-xs transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <div className="font-medium text-sm">{user?.fullName ?? user?.email}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{user?.email}</div>
                  {user?.authProvider && (
                    <div className="text-xs text-gray-400 mt-1">
                      Đăng nhập qua:{' '}
                      <span className="font-mono">
                        {user.authProvider === 'GOOGLE' ? '🌐 Google SSO' : '🔐 LOCAL'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    <span>👤</span>
                    <span>Hồ sơ cá nhân</span>
                  </Link>
                  <Link
                    to="/profile/security"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    <span>🔐</span>
                    <span>An toàn tài khoản</span>
                  </Link>
                </div>
                <div className="border-t">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-red-50 w-full"
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
