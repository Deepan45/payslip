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
import { PortalLogin } from "./pages/portal/PortalLogin";
import { PortalPayslips } from "./pages/portal/PortalPayslips";

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
                  <Route index element={<Dashboard />} />
                  <Route path="upload" element={<Upload />} />
                  <Route path="clients" element={<Clients />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="employees/:id" element={<EmployeeDetail />} />
                  <Route path="history" element={<History />} />
                  <Route path="history/:sheetId" element={<HistoryDetail />} />
                  <Route path="payslips" element={<Payslips />} />
                  <Route path="advances" element={<AdvanceLedger />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
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
