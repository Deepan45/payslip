import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface PayslipLinkPayload {
  purpose: "payslip-download";
  payslipId: string;
}

/** Signs a time-limited token for the unauthenticated public payslip-download link. */
export function signPayslipLink(payslipId: string): string {
  return jwt.sign({ purpose: "payslip-download", payslipId } as PayslipLinkPayload, env.jwtSecret, {
    expiresIn: "30d",
  });
}

export function verifyPayslipLink(token: string, payslipId: string): boolean {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as PayslipLinkPayload;
    return payload.purpose === "payslip-download" && payload.payslipId === payslipId;
  } catch {
    return false;
  }
}

export function buildPayslipPublicUrl(payslipId: string): string {
  const token = signPayslipLink(payslipId);
  return `${env.publicBaseUrl}/api/public/payslips/${payslipId}?token=${encodeURIComponent(token)}`;
}
