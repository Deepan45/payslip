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

interface TopBarProps {
  /** Toggles the mobile nav drawer (Sidebar) — the button that calls this only renders below the mobile breakpoint. */
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div className="topbar-title">{pageTitle(location.pathname)}</div>
      </div>
      <div className="topbar-user">
        <span className="topbar-avatar">{initials(admin?.email)}</span>
        <span className="topbar-email">{admin?.email}</span>
        <span className="topbar-divider" />
        <button onClick={handleLogout} className="topbar-logout" title="Log out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
