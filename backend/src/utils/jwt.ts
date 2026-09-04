import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AdminTokenPayload {
  role: "admin";
  adminId: string;
  email: string;
}

export interface EmployeeTokenPayload {
  role: "employee";
  employeeId: string;
  employeeCode: string;
}

export type TokenPayload = AdminTokenPayload | EmployeeTokenPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
