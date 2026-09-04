import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile nav drawer whenever the route changes (picking a page
  // is the natural "I'm done with the menu" signal on a phone).
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      <div className="app-content">
        <TopBar onMenuClick={() => setNavOpen((v) => !v)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
