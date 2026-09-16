import { UserRole } from "@prisma/client";

// Single source of truth for role -> permission resolution. The frontend
// never hardcodes this table — it reads the resolved list from
// GET /api/auth/me — so the two sides can't drift apart.
export const PERMISSIONS = [
  "dashboard.view",
  "clients.view",
  "employees.view",
  "history.view",
  "payslips.view",
  "advances.view",
  "reports.view",
  "statutory.view",
  "upload.run",
  "clients.manage",
  "employees.manage",
  "employees.portal_access",
  "payslips.send",
  "advances.manage",
  "history.delete",
  "settings.manage",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEW_ONLY: Permission[] = [
  "dashboard.view",
  "clients.view",
  "employees.view",
  "history.view",
  "payslips.view",
  "advances.view",
  "reports.view",
  "statutory.view",
];

const OPERATIONAL: Permission[] = [
  ...VIEW_ONLY,
  "upload.run",
  "clients.manage",
  "employees.manage",
  "employees.portal_access",
  "payslips.send",
  "advances.manage",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  PAYROLL_MANAGER: OPERATIONAL,
  ACCOUNTANT: [...VIEW_ONLY, "advances.manage"],
  VIEWER: VIEW_ONLY,
};

export function permissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}
