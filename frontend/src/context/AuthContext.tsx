import { createContext, useContext, useState, ReactNode } from "react";
import { api, apiErrorMessage } from "../api/client";

interface AdminInfo {
  id: string;
  email: string;
}

interface AuthContextValue {
  admin: AdminInfo | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("payslip_token"));
  const [admin, setAdmin] = useState<AdminInfo | null>(() => {
    const raw = localStorage.getItem("payslip_admin");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, password: string) {
    try {
      const res = await api.post("/auth/login", { email, password });
      setToken(res.data.token);
      setAdmin(res.data.admin);
      localStorage.setItem("payslip_token", res.data.token);
      localStorage.setItem("payslip_admin", JSON.stringify(res.data.admin));
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

  return <AuthContext.Provider value={{ admin, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
