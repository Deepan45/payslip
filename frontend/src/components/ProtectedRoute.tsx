import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./PageLoader";

interface Props {
  /** If set, the route also requires this permission — otherwise redirects to the dashboard. */
  permission?: string;
}

export function ProtectedRoute({ permission }: Props) {
  const { token, admin, ready, can } = useAuth();
  const location = useLocation();

  if (!token) return <Navigate to="/login" replace />;
  if (!ready) return <PageLoader />;

  if (admin?.mustChangePassword && location.pathname !== "/my-account") {
    return <Navigate to="/my-account" replace />;
  }
  if (permission && !can(permission)) return <Navigate to="/" replace />;

  return <Outlet />;
}
