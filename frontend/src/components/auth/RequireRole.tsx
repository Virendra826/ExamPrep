import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/useAuth";
import type { Role } from "../../types/auth";

interface RequireRoleProps {
  allowedRoles: Role[];
  children?: ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        data-testid="role-loading"
        className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200"
      >
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect authenticated but unauthorized users away from admin routes
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
