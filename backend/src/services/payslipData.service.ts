import path from "path";
import type { CompanySettings, Employee, SalaryRecord } from "@prisma/client";
import type { PayslipPdfData } from "./pdf.service";

const LOGO_DIR = path.join(__dirname, "..", "..", "storage", "logo");

// CompanySettings.logoPath was historically stored as the full absolute path
// returned by multer at upload time (see company.routes.ts) — which bakes in
// whatever environment wrote it (e.g. a container's "/app/storage/logo/...").
// Read back through a *different* environment (a local dev box against the
// same shared DB, a restored backup, etc.), that path doesn't exist on disk
// and the logo silently disappears from every payslip. Resolve by filename
// against this environment's own LOGO_DIR instead, so only the file itself
// needs to exist locally — not the exact path it was uploaded from.
export function resolveLogoPath(storedPath: string | null | undefined): string | undefined {
  if (!storedPath) return undefined;
  return path.join(LOGO_DIR, path.basename(storedPath));
}

/** Builds the payslip PDF input from stored records — shared by upload-time generation and print sheets. */
export function payslipPdfData(
  company: CompanySettings | null,
  clientName: string,
  employee: Employee,
  record: SalaryRecord,
  period: { month: number; year: number }
): PayslipPdfData {
  return {
    company: {
      name: company?.name ?? "Your Company",
      address: company?.address,
      logoPath: resolveLogoPath(company?.logoPath),
      mobile: company?.mobile,
      officePhone: company?.officePhone,
      email: company?.email,
      website: company?.website,
    },
    client: { name: clientName },
    employee: {
      employeeCode: employee.employeeCode,
      name: employee.name,
      guardianName: employee.guardianName,
      designation: employee.designation,
      department: employee.department,
      bankAccount: employee.bankAccount,
      ifscCode: employee.ifscCode,
      uanNo: employee.uanNo,
      esiNo: employee.esiNo,
    },
    period,
    attendance: { paidDays: record.paidDays, otHours: record.otHours, otAmount: record.otAmount },
    earnings: {
      basic: record.basic,
      monthlySalary: record.monthlySalary,
      hra: record.hra,
      monthlyHra: record.monthlyHra,
      otAmount: record.otAmount,
      otherEarnings: Array.isArray(record.otherEarnings) ? (record.otherEarnings as unknown as { label: string; amount: number }[]) : [],
      grossEarnings: record.grossEarnings,
    },
    deductions: {
      esi: record.esi,
      epf: record.epf,
      lwf: record.lwf,
      advance: record.advance,
      dressShoes: record.dressShoes,
      otherDeduction: record.otherDeduction,
      totalDeductions: record.totalDeductions,
    },
    netPay: record.netPay,
  };
}
