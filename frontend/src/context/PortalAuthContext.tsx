import { createContext, useContext, useState, ReactNode } from "react";
import { apiErrorMessage } from "../api/client";
import { portalApi } from "../api/portalClient";

interface EmployeeInfo {
  id: string;
  employeeCode: string;
  name: string;
}

interface PortalAuthContextValue {
  employee: EmployeeInfo | null;
  token: string | null;
  login: (employeeCode: string, password: string) => Promise<void>;
  logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextValue | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("portal_token"));
  const [employee, setEmployee] = useState<EmployeeInfo | null>(() => {
    const raw = localStorage.getItem("portal_employee");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(employeeCode: string, password: string) {
    try {
      const res = await portalApi.post("/portal/login", { employeeCode, password });
      setToken(res.data.token);
      setEmployee(res.data.employee);
      localStorage.setItem("portal_token", res.data.token);
      localStorage.setItem("portal_employee", JSON.stringify(res.data.employee));
    } catch (err) {
      throw new Error(apiErrorMessage(err, "Login failed"));
    }
  }

  function logout() {
    setToken(null);
    setEmployee(null);
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_employee");
  }

  return <PortalAuthContext.Provider value={{ employee, token, login, logout }}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}
