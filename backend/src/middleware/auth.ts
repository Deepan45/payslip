import { NextFunction, Request, Response } from "express";
import { UserRole, UserStatus } from "@prisma/client";
import { verifyToken, EmployeeTokenPayload } from "../utils/jwt";
import { prisma } from "../config/db";
import { Permission, permissionsForRole } from "../auth/permissions";

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  permissions: Permission[];
}

export interface AuthedRequest extends Request {
  user?: AuthedUser;
  employee?: EmployeeTokenPayload;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

// Loads the current user row on every request (rather than trusting the JWT
// payload alone) so a disabled account or a role change takes effect
// immediately instead of waiting out the token's 8h expiry.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header" });
  try {
    const payload = verifyToken(token);
    if (payload.role !== "admin") return res.status(403).json({ error: "Admin access required" });

    const user = await prisma.user.findUnique({ where: { id: payload.adminId } });
    if (!user) return res.status(401).json({ error: "Invalid or expired session" });
    if (user.status === UserStatus.DISABLED) return res.status(403).json({ error: "This account has been disabled" });

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, permissions: permissionsForRole(user.role) };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Gate a route behind one or more permissions (all required). Apply after
// requireAuth so req.user is populated.
export function requirePermission(...perms: Permission[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const granted = req.user?.permissions ?? [];
    const missing = perms.filter((p) => !granted.includes(p));
    if (missing.length > 0) {
      return res.status(403).json({ error: `You don't have permission to do this (${missing.join(", ")}).` });
    }
    next();
  };
}

export function requireEmployeeAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header" });
  try {
    const payload = verifyToken(token);
    if (payload.role !== "employee") return res.status(403).json({ error: "Employee access required" });
    req.employee = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
