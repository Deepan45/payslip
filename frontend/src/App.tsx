import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PortalAuthProvider } from "./context/PortalAuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PortalProtectedRoute } from "./components/PortalProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Upload } from "./pages/Upload";
import { Employees } from "./pages/Employees";
import { EmployeeDetail } from "./pages/EmployeeDetail";
import { History } from "./pages/History";
import { Payslips } from "./pages/Payslips";
import { HistoryDetail } from "./pages/HistoryDetail";
import { Settings } from "./pages/Settings";
import { Clients } from "./pages/Clients";
import { AdvanceLedger } from "./pages/AdvanceLedger";
import { Reports } from "./pages/Reports";
import { Statutory } from "./pages/Statutory";
import { Users } from "./pages/Users";
import { MyAccount } from "./pages/MyAccount";
import { PortalLogin } from "./pages/portal/PortalLogin";
import { PortalPayslips } from "./pages/portal/PortalPayslips";

/** Shorthand for one permission-gated leaf route, nested under the outer auth guard below. */
function guarded(permission: string, path: string, element: JSX.Element) {
  return (
    <Route element={<ProtectedRoute permission={permission} />}>
      <Route path={path} element={element} />
    </Route>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Admin app */}
      <Route
        path="/*"
        element={
          <AuthProvider>
            <Routes>
              <Route path="login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route element={<ProtectedRoute permission="dashboard.view" />}>
                    <Route index element={<Dashboard />} />
                  </Route>
                  {guarded("upload.run", "upload", <Upload />)}
                  {guarded("clients.view", "clients", <Clients />)}
                  {guarded("employees.view", "employees", <Employees />)}
                  {guarded("employees.view", "employees/:id", <EmployeeDetail />)}
                  {guarded("history.view", "history", <History />)}
                  {guarded("history.view", "history/:sheetId", <HistoryDetail />)}
                  {guarded("payslips.view", "payslips", <Payslips />)}
                  {guarded("advances.view", "advances", <AdvanceLedger />)}
                  {guarded("reports.view", "reports", <Reports />)}
                  {guarded("statutory.view", "statutory", <Statutory />)}
                  {guarded("settings.manage", "settings", <Settings />)}
                  {guarded("users.manage", "users", <Users />)}
                  <Route path="my-account" element={<MyAccount />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        }
      />

      {/* Employee self-service portal — separate auth/session from the admin app */}
      <Route
        path="/portal/*"
        element={
          <PortalAuthProvider>
            <Routes>
              <Route path="login" element={<PortalLogin />} />
              <Route element={<PortalProtectedRoute />}>
                <Route index element={<PortalPayslips />} />
              </Route>
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Routes>
          </PortalAuthProvider>
        }
      />
    </Routes>
  );
}
