import { Navigate, Outlet } from "react-router-dom";
import { usePortalAuth } from "../context/PortalAuthContext";

export function PortalProtectedRoute() {
  const { token } = usePortalAuth();
  if (!token) return <Navigate to="/portal/login" replace />;
  return <Outlet />;
}
