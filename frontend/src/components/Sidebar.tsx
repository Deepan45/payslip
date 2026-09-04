import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";

type IconProps = { className?: string };
const icon = (path: string) =>
  function Icon({ className }: IconProps) {
    return (
      <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    );
  };

const Icons = {
  dashboard: icon("M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"),
  upload: icon("M12 16V4M12 4l-4 4M12 4l4 4M4 20h16"),
  clients: icon("M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01"),
  employees: icon("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"),
  history: icon("M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2"),
  payslips: icon("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"),
  advances: icon("M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"),
  reports: icon("M3 3v18h18M8 17V10M13 17V6M18 17v-4"),
  settings: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"),
};

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof Icons;
  badge: string;
  end?: boolean;
}

const TOP_ITEM: NavItem = { to: "/", label: "Dashboard", icon: "dashboard", badge: "badge-icon-dash", end: true };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Payroll",
    items: [
      { to: "/upload", label: "Upload", icon: "upload", badge: "badge-icon-blue" },
      { to: "/clients", label: "Clients", icon: "clients", badge: "badge-icon-aqua" },
      { to: "/employees", label: "Employees", icon: "employees", badge: "badge-icon-violet" },
      { to: "/history", label: "History", icon: "history", badge: "badge-icon-amber" },
      { to: "/payslips", label: "Payslips", icon: "payslips", badge: "badge-icon-blue" },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/advances", label: "Advances", icon: "advances", badge: "badge-icon-green" },
      { to: "/reports", label: "Reports", icon: "reports", badge: "badge-icon-pink" },
    ],
  },
  {
    title: "Account",
    items: [{ to: "/settings", label: "Settings", icon: "settings", badge: "badge-icon-gray" }],
  },
];

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = Icons[item.icon];
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => (isActive ? "active" : "")}>
      <span className={`sidebar-icon-wrap ${item.badge}`}>
        <Icon />
      </span>
      {item.label}
    </NavLink>
  );
}

interface SidebarProps {
  /** Whether the mobile off-canvas drawer is open. Ignored above the mobile breakpoint, where the sidebar is always visible. */
  open?: boolean;
  /** Called when a nav link is clicked — lets the mobile drawer close itself after navigating. */
  onNavigate?: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand">
        <span className="sidebar-logo-badge">
          <img src={logo} alt="" className="sidebar-logo" />
        </span>
        <div>
          <div className="sidebar-brand-name">Himalayan</div>
          <div className="sidebar-brand-sub">Payroll</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavRow item={TOP_ITEM} onNavigate={onNavigate} />

        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-group">
            <div className="sidebar-group-title">{group.title}</div>
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">Himalayan Payroll · v1.0</span>
      </div>
    </aside>
  );
}
