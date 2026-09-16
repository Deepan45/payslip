import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, apiErrorMessage } from "../api/client";

export type UserRole = "SUPER_ADMIN" | "PAYROLL_MANAGER" | "ACCOUNTANT" | "VIEWER";

export interface AdminInfo {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  permissions: string[];
  mustChangePassword: boolean;
}

interface AuthContextValue {
  admin: AdminInfo | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("payslip_token"));
  const [admin, setAdmin] = useState<AdminInfo | null>(() => {
    const raw = localStorage.getItem("payslip_admin");
    return raw ? JSON.parse(raw) : null;
  });
  const [ready, setReady] = useState(false);

  function persist(info: AdminInfo) {
    setAdmin(info);
    localStorage.setItem("payslip_admin", JSON.stringify(info));
  }

  async function login(email: string, password: string) {
    try {
      const res = await api.post("/auth/login", { email, password });
      setToken(res.data.token);
      localStorage.setItem("payslip_token", res.data.token);
      persist(res.data.admin);
    } catch (err) {
      throw new Error(apiErrorMessage(err, "Login failed"));
    }
  }

  function logout() {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem("payslip_token");
    localStorage.removeItem("payslip_admin");
  }

  async function refreshMe() {
    const res = await api.get("/auth/me");
    persist(res.data.admin);
  }

  // Re-validate against the server on mount so a role/status change made by
  // someone else lands here instead of living on in stale localStorage.
  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    refreshMe()
      .catch(() => logout())
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function can(permission: string): boolean {
    return admin?.permissions?.includes(permission) ?? false;
  }

  return (
    <AuthContext.Provider value={{ admin, token, ready, login, logout, can, refreshMe }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
