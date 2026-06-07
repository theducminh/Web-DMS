import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '../entities/session/session.store';

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const location = useLocation();
  const token = useSessionStore((s) => s.accessToken);
  const isAdmin = useSessionStore((s) => s.isAdmin());

  if (!token) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
