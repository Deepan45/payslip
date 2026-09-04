import { NextFunction, Request, Response } from "express";
import { verifyToken, AdminTokenPayload, EmployeeTokenPayload } from "../utils/jwt";

export interface AuthedRequest extends Request {
  admin?: AdminTokenPayload;
  employee?: EmployeeTokenPayload;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header" });
  try {
    const payload = verifyToken(token);
    if (payload.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
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
