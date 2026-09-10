// Client billing: computes what to charge a client for one uploaded salary sheet — the wage
// cost of everyone deployed there (Gross Earnings + the employer's share of PF/ESI/LWF, since
// the agency fronts those) plus a per-employee service charge from Client.billingRate. Generated
// automatically right after that sheet's payslips are (see upload.controller.ts) and persisted
// (ClientBill) so the figures are a snapshot, not a live recomputation — a bill already handed to
// a client shouldn't silently change if CompanySettings' contribution rates are edited later.
import { prisma } from "../config/db";
import { CompanySettings } from "@prisma/client";
import { employerEpfForRow, employerEsiForRow, employerLwfForRow, pfAdminChargeForBatch, getCompanySettings } from "./statutory.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ClientBillLine {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  paidDays: number;
  grossEarnings: number;
  employerEpf: number; // EPS + EPF-diff + EDLI, combined
  employerEsi: number;
  employerLwf: number;
  wageCost: number; // grossEarnings + employerEpf + employerEsi + employerLwf
}

export interface ClientBillTotals {
  employeeCount: number;
  totalGrossWages: number;
  totalEmployerEpf: number;
  totalEmployerEsi: number;
  totalEmployerLwf: number;
  pfAdminCharge: number;
  billingRateUsed: number | null;
  serviceCharge: number;
  totalWageCost: number;
  grandTotal: number;
}

/** Computes (without persisting) the bill for one uploaded sheet from its SalaryRecords. */
export async function computeClientBillForSheet(
  sheetId: string
): Promise<{ clientId: string; clientName: string; periodMonth: number; periodYear: number; lines: ClientBillLine[]; totals: ClientBillTotals } | null> {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: sheetId },
    include: {
      client: { select: { id: true, name: true, billingRate: true } },
      salaryRecords: { include: { employee: true }, orderBy: { employee: { name: "asc" } } },
    },
  });
  if (!sheet) return null;

  const company: CompanySettings = await getCompanySettings();

  let totalEpfWagesForAdmin = 0;
  let pfMemberCount = 0;

  const lines: ClientBillLine[] = sheet.salaryRecords.map((r) => {
    const { epsContriEmployer, epfContriEmployerDiff, edli } = employerEpfForRow(r.pfSalaryAmt, company);
    const employerEpf = round2(epsContriEmployer + epfContriEmployerDiff + edli);
    const employerEsi = employerEsiForRow(r.grossEarnings, r.esi, company);
    const employerLwf = employerLwfForRow(r.grossEarnings, company);
    if (r.pfSalaryAmt > 0) {
      totalEpfWagesForAdmin += r.pfSalaryAmt;
      pfMemberCount += 1;
    }
    return {
      employeeId: r.employeeId,
      employeeCode: r.employee.employeeCode,
      name: r.employee.name,
      designation: r.employee.designation,
      paidDays: r.paidDays,
      grossEarnings: round2(r.grossEarnings),
      employerEpf,
      employerEsi,
      employerLwf,
      wageCost: round2(r.grossEarnings + employerEpf + employerEsi + employerLwf),
    };
  });

  const totalGrossWages = round2(lines.reduce((s, l) => s + l.grossEarnings, 0));
  const totalEmployerEpf = round2(lines.reduce((s, l) => s + l.employerEpf, 0));
  const totalEmployerEsi = round2(lines.reduce((s, l) => s + l.employerEsi, 0));
  const totalEmployerLwf = round2(lines.reduce((s, l) => s + l.employerLwf, 0));
  const pfAdminCharge = pfAdminChargeForBatch(totalEpfWagesForAdmin, pfMemberCount, company);
  const billingRateUsed = sheet.client.billingRate ?? null;
  const serviceCharge = round2((billingRateUsed ?? 0) * lines.length);
  const totalWageCost = round2(totalGrossWages + totalEmployerEpf + totalEmployerEsi + totalEmployerLwf + pfAdminCharge);
  const grandTotal = round2(totalWageCost + serviceCharge);

  return {
    clientId: sheet.client.id,
    clientName: sheet.client.name,
    periodMonth: sheet.periodMonth,
    periodYear: sheet.periodYear,
    lines,
    totals: {
      employeeCount: lines.length,
      totalGrossWages,
      totalEmployerEpf,
      totalEmployerEsi,
      totalEmployerLwf,
      pfAdminCharge,
      billingRateUsed,
      serviceCharge,
      totalWageCost,
      grandTotal,
    },
  };
}
