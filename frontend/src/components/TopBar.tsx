import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TITLES: { prefix: string; label: string }[] = [
  { prefix: "/upload", label: "Upload Salary Sheet" },
  { prefix: "/clients", label: "Client Sites" },
  { prefix: "/employees", label: "Employees" },
  { prefix: "/history", label: "Payslip History" },
  { prefix: "/payslips", label: "Payslips" },
  { prefix: "/advances", label: "Advance Ledger" },
  { prefix: "/reports", label: "Reports" },
  { prefix: "/settings", label: "Company Settings" },
  { prefix: "/", label: "Dashboard" },
];

function pageTitle(pathname: string): string {
  return TITLES.find((t) => pathname.startsWith(t.prefix))?.label ?? "";
}

function initials(email?: string): string {
  if (!email) return "?";
  return email[0].toUpperCase();
}

export function TopBar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topbar">
      <div className="topbar-title">{pageTitle(location.pathname)}</div>
      <div className="topbar-user">
        <span className="topbar-avatar">{initials(admin?.email)}</span>
        <span className="topbar-email">{admin?.email}</span>
        <button onClick={handleLogout} className="btn-link">
          Logout
        </button>
      </div>
    </header>
  );
}
