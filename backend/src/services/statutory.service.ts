// Monthly statutory filing generation: EPFO ECR file, ESIC contribution
// file, and a Labour Welfare Fund challan. Built from the same SalaryRecord
// data every payslip already comes from, aggregated per employee for one
// pay period across all of that employee's client sheets that period.
//
// The exact file layouts (ECR field order/separator, ESIC upload columns)
// follow the commonly published EPFO/ESIC formats at the time this was
// written. Government portals do tweak these periodically — verify against
// the live portal's current template before a first real filing; don't
// trust this blindly for a live submission.
import { prisma } from "../config/db";
import { CompanySettings } from "@prisma/client";

export interface StatutoryEmployeeAgg {
  employeeId: string;
  employeeCode: string;
  name: string;
  uanNo: string | null;
  esiNo: string | null;
  paidDays: number;
  grossEarnings: number;
  basic: number; // basic pay — the PF wage base fallback when a client's sheet has no PF wage column
  pfSalaryAmt: number; // PF-qualifying wage base
  epf: number; // employee-share EPF actually deducted on the sheet(s)
  esi: number; // employee-share ESI actually deducted on the sheet(s)
  lwf: number; // employee-share LWF actually deducted on the sheet(s)
}

/** Sums each employee's salary records across every client sheet in the given period into one row. */
export async function aggregateEmployeesForPeriod(periodMonth: number, periodYear: number): Promise<StatutoryEmployeeAgg[]> {
  const records = await prisma.salaryRecord.findMany({
    where: { sheet: { periodMonth, periodYear } },
    include: { employee: true },
  });

  const byEmployee = new Map<string, StatutoryEmployeeAgg>();
  for (const r of records) {
    const existing = byEmployee.get(r.employeeId);
    if (existing) {
      existing.paidDays += r.paidDays;
      existing.grossEarnings += r.grossEarnings;
      existing.basic += r.basic;
      existing.pfSalaryAmt += r.pfSalaryAmt;
      existing.epf += r.epf;
      existing.esi += r.esi;
      existing.lwf += r.lwf;
    } else {
      byEmployee.set(r.employeeId, {
        employeeId: r.employeeId,
        employeeCode: r.employee.employeeCode,
        name: r.employee.name,
        uanNo: r.employee.uanNo,
        esiNo: r.employee.esiNo,
        paidDays: r.paidDays,
        grossEarnings: r.grossEarnings,
        basic: r.basic,
        pfSalaryAmt: r.pfSalaryAmt,
        epf: r.epf,
        esi: r.esi,
        lwf: r.lwf,
      });
    }
  }
  return Array.from(byEmployee.values());
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const company = await prisma.companySettings.findFirst();
  if (company) return company;
  // No row yet (fresh install) — fall back to schema defaults without
  // requiring Settings to have been saved first.
  return prisma.companySettings.create({ data: { name: "Your Company" } });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Excel ROUND(x, 0): half rounds away from zero, with a tiny nudge so binary-float values like 1249.4999999 don't flip. */
const excelRound = (n: number) => Math.round(n + 1e-9);

// --------------------------------------------------------------------------
// Shared per-employee employer-contribution math — used by the PF/ESI/LWF
// filing builders below AND by bill.service.ts (client billing), so a
// bill's employer-contribution figures always match what actually gets
// filed for the same period instead of drifting from a second formula.
// --------------------------------------------------------------------------

/** Employer-side EPF cost for one employee this period: EPS + the EPF-proper diff + EDLI. */
export function employerEpfForRow(pfSalaryAmt: number, company: CompanySettings): {
  epsContriEmployer: number;
  epfContriEmployerDiff: number;
  edli: number;
} {
  if (pfSalaryAmt <= 0) return { epsContriEmployer: 0, epfContriEmployerDiff: 0, edli: 0 };
  const epfWages = round2(pfSalaryAmt);
  const epsWages = round2(Math.min(pfSalaryAmt, company.epsWageCeiling));
  const edliWages = round2(Math.min(pfSalaryAmt, company.epsWageCeiling));
  const employerTotal = epfWages * (company.epfEmployerTotalRate / 100);
  const epsContriEmployer = round2(epsWages * (company.epfEmployerEpsRate / 100));
  const epfContriEmployerDiff = round2(employerTotal - epsContriEmployer);
  const edli = round2(edliWages * (company.epfEdliRate / 100));
  return { epsContriEmployer, epfContriEmployerDiff, edli };
}

/** Employer-side ESI cost for one employee this period — only applies if the employee is on ESI
 * (`esiDeducted` > 0) and their gross wages are within the ESI coverage ceiling. */
export function employerEsiForRow(grossEarnings: number, esiDeducted: number, company: CompanySettings): number {
  if (esiDeducted <= 0 || grossEarnings > company.esiWageCeiling) return 0;
  return round2(grossEarnings * (company.esiEmployerRate / 100));
}

/** Employer-side LWF cost for one employee this period: % of gross wages, capped (matches buildLwfChallanRows). */
export function employerLwfForRow(grossEarnings: number, company: CompanySettings): number {
  if (grossEarnings <= 0) return 0;
  return round2(Math.min(grossEarnings * (company.lwfEmployerRate / 100), company.lwfEmployerMaxAmt));
}

/** Establishment-level EPF admin charge for a batch of members — not divisible per employee. */
export function pfAdminChargeForBatch(totalEpfWages: number, memberCount: number, company: CompanySettings): number {
  if (memberCount === 0) return 0;
  return round2(Math.max(totalEpfWages * (company.epfAdminChargeRate / 100), company.epfAdminChargeMin));
}

// --------------------------------------------------------------------------
// PF — EPFO ECR file
// --------------------------------------------------------------------------

export interface PfMemberLine {
  uan: string;
  name: string;
  grossWages: number;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  epfContriEmployee: number;
  epsContriEmployer: number;
  epfContriEmployerDiff: number;
  ncpDays: number;
  refundAdvances: number;
}

export interface PfChallanSummary {
  memberCount: number;
  skipped: { employeeCode: string; name: string; reason: string }[];
  totalEpfWages: number;
  totalEpsWages: number;
  totalEdliWages: number;
  totalEmployeeEpf: number;
  totalEmployerEps: number;
  totalEmployerEpfDiff: number;
  totalEdli: number;
  totalAdminCharge: number;
  grandTotal: number;
}

/** PF-qualifying wage for one employee. Some clients' sheets have no PF wage column mapped, so
 * `pfSalaryAmt` is 0 even though EPF was deducted — in that case fall back to basic pay capped at
 * the wage ceiling (the standard EPF wage definition), rather than filing 0 wages against a
 * non-zero contribution. */
export function pfWageForRow(row: Pick<StatutoryEmployeeAgg, "pfSalaryAmt" | "basic" | "epf">, company: CompanySettings): number {
  if (row.pfSalaryAmt > 0) return row.pfSalaryAmt;
  if (row.epf > 0) return Math.min(row.basic, company.epsWageCeiling);
  return 0;
}

const EMPLOYEE_EPF_RATE = 12; // employee EPF share is fixed by statute; only the employer split is configurable

function buildPfLines(rows: StatutoryEmployeeAgg[], company: CompanySettings) {
  const lines: PfMemberLine[] = [];
  const skipped: PfChallanSummary["skipped"] = [];

  for (const row of rows) {
    if (row.pfSalaryAmt <= 0 && row.epf <= 0) continue; // not on PF this period
    if (!row.uanNo) {
      skipped.push({ employeeCode: row.employeeCode, name: row.name, reason: "No UAN on file" });
      continue;
    }
    const pfWage = pfWageForRow(row, company);
    const epfWages = round2(pfWage);
    const epsWages = round2(Math.min(pfWage, company.epsWageCeiling));
    const edliWages = round2(Math.min(pfWage, company.epsWageCeiling));
    // Whole-rupee contributions computed from wages (as the ECR requires), not the amount the
    // client's sheet happened to deduct — so the file is internally consistent even if a sheet's
    // own EPF column was rounded differently or computed on another base.
    const epfContriEmployee = excelRound(epfWages * (EMPLOYEE_EPF_RATE / 100));
    const epsContriEmployer = excelRound(epsWages * (company.epfEmployerEpsRate / 100));
    const epfContriEmployerDiff = excelRound(epfWages * (company.epfEmployerTotalRate / 100)) - epsContriEmployer;

    lines.push({
      uan: row.uanNo,
      name: row.name,
      grossWages: round2(row.grossEarnings),
      epfWages,
      epsWages,
      edliWages,
      epfContriEmployee,
      epsContriEmployer,
      epfContriEmployerDiff,
      ncpDays: 0, // not tracked on the sheet — assumed full month; adjust manually if a member had NCP days
      refundAdvances: 0,
    });
  }

  return { lines, skipped };
}

/** EPFO ECR text file content: one member per line, fields separated by "#~#". */
export function buildPfEcrText(rows: StatutoryEmployeeAgg[], company: CompanySettings): { text: string; summary: PfChallanSummary } {
  const { lines, skipped } = buildPfLines(rows, company);

  const text = lines
    .map((l) =>
      [
        l.uan,
        l.name,
        l.grossWages.toFixed(2),
        l.epfWages.toFixed(2),
        l.epsWages.toFixed(2),
        l.edliWages.toFixed(2),
        l.epfContriEmployee.toFixed(2),
        l.epsContriEmployer.toFixed(2),
        l.epfContriEmployerDiff.toFixed(2),
        l.ncpDays,
        l.refundAdvances.toFixed(2),
      ].join("#~#")
    )
    .join("\r\n");

  const totalEpfWages = round2(lines.reduce((s, l) => s + l.epfWages, 0));
  const totalEpsWages = round2(lines.reduce((s, l) => s + l.epsWages, 0));
  const totalEdliWages = round2(lines.reduce((s, l) => s + l.edliWages, 0));
  const totalEmployeeEpf = round2(lines.reduce((s, l) => s + l.epfContriEmployee, 0));
  const totalEmployerEps = round2(lines.reduce((s, l) => s + l.epsContriEmployer, 0));
  const totalEmployerEpfDiff = round2(lines.reduce((s, l) => s + l.epfContriEmployerDiff, 0));
  const totalEdli = round2(totalEdliWages * (company.epfEdliRate / 100));
  const totalAdminCharge = lines.length > 0
    ? round2(Math.max(totalEpfWages * (company.epfAdminChargeRate / 100), company.epfAdminChargeMin))
    : 0;
  const grandTotal = round2(
    totalEmployeeEpf + totalEmployerEps + totalEmployerEpfDiff + totalEdli + totalAdminCharge
  );

  return {
    text,
    summary: {
      memberCount: lines.length,
      skipped,
      totalEpfWages,
      totalEpsWages,
      totalEdliWages,
      totalEmployeeEpf,
      totalEmployerEps,
      totalEmployerEpfDiff,
      totalEdli,
      totalAdminCharge,
      grandTotal,
    },
  };
}

/**
 * PF ECR as an Excel sheet (no header row), same layout as the monthly "<MON> PF.xlsx" working file:
 * A UAN | B Name | C Gross | D EPF wages | E EPS wages | F EDLI wages | G EE EPF | H EPS | I ER EPF diff | J NCP days | K Refund.
 * G/H/I are live formulas so the sheet stays editable (e.g. adjust a wage and the contributions follow);
 * each formula cell also carries its computed value so viewers that don't recalculate still show numbers.
 * EPS is rounded to whole rupees and the ER diff is the rounded EPF total minus EPS, so EPS + diff always
 * equals the rounded EPF total instead of drifting by a rupee.
 */
export function buildPfEcrSheetRows(rows: StatutoryEmployeeAgg[], company: CompanySettings): {
  aoa: (string | number | { t: "n"; v: number; f: string })[][];
  summary: PfChallanSummary;
} {
  const { lines, skipped } = buildPfLines(rows, company);
  const epfRate = EMPLOYEE_EPF_RATE;
  const totalRate = company.epfEmployerTotalRate;
  const epsRate = company.epfEmployerEpsRate;

  const aoa: (string | number | { t: "n"; v: number; f: string })[][] = [];
  let totalEpfWages = 0, totalEpsWages = 0, totalEdliWages = 0, totalEe = 0, totalEps = 0, totalDiff = 0;

  lines.forEach((l, i) => {
    const r = i + 1; // Excel row number — no header row
    const ee = l.epfContriEmployee;
    const eps = l.epsContriEmployer;
    const diff = l.epfContriEmployerDiff;
    totalEpfWages += l.epfWages; totalEpsWages += l.epsWages; totalEdliWages += l.edliWages;
    totalEe += ee; totalEps += eps; totalDiff += diff;
    aoa.push([
      /^\d+$/.test(l.uan) ? Number(l.uan) : l.uan,
      l.name,
      l.grossWages,
      l.epfWages,
      l.epsWages,
      l.edliWages,
      { t: "n", v: ee, f: `ROUND(D${r}*${epfRate}%,0)` },
      { t: "n", v: eps, f: `ROUND(E${r}*${epsRate}%,0)` },
      { t: "n", v: diff, f: `ROUND(D${r}*${totalRate}%,0)-H${r}` },
      l.ncpDays,
      l.refundAdvances,
    ]);
  });

  const totalEdli = round2(totalEdliWages * (company.epfEdliRate / 100));
  const totalAdminCharge = pfAdminChargeForBatch(totalEpfWages, lines.length, company);
  return {
    aoa,
    summary: {
      memberCount: lines.length,
      skipped,
      totalEpfWages: round2(totalEpfWages),
      totalEpsWages: round2(totalEpsWages),
      totalEdliWages: round2(totalEdliWages),
      totalEmployeeEpf: totalEe,
      totalEmployerEps: totalEps,
      totalEmployerEpfDiff: totalDiff,
      totalEdli,
      totalAdminCharge,
      grandTotal: round2(totalEe + totalEps + totalDiff + totalEdli + totalAdminCharge),
    },
  };
}

// --------------------------------------------------------------------------
// ESI — ESIC contribution file
// --------------------------------------------------------------------------

export interface EsiMemberLine {
  ipNumber: string;
  name: string;
  noOfDays: number;
  totalMonthlyWages: number;
  employeeContribution: number;
  employerContribution: number;
}

export interface EsiFileSummary {
  memberCount: number;
  skipped: { employeeCode: string; name: string; reason: string }[];
  totalEmployeeEsi: number;
  totalEmployerEsi: number;
  grandTotal: number;
}

export function buildEsiFileCsv(rows: StatutoryEmployeeAgg[], company: CompanySettings): { csv: string; summary: EsiFileSummary } {
  const lines: EsiMemberLine[] = [];
  const skipped: EsiFileSummary["skipped"] = [];

  for (const row of rows) {
    if (row.esi <= 0) continue; // not on ESI this period
    if (row.grossEarnings > company.esiWageCeiling) {
      skipped.push({ employeeCode: row.employeeCode, name: row.name, reason: `Gross wages above ESI ceiling (₹${company.esiWageCeiling})` });
      continue;
    }
    if (!row.esiNo) {
      skipped.push({ employeeCode: row.employeeCode, name: row.name, reason: "No ESI number on file" });
      continue;
    }
    lines.push({
      ipNumber: row.esiNo,
      name: row.name,
      noOfDays: row.paidDays,
      totalMonthlyWages: round2(row.grossEarnings),
      employeeContribution: round2(row.esi),
      employerContribution: round2(row.grossEarnings * (company.esiEmployerRate / 100)),
    });
  }

  const header = ["IP Number", "IP Name", "No of Days", "Total Monthly Wages", "Employee Contribution", "Employer Contribution"];
  const csv = [header.join(","), ...lines.map((l) =>
    [l.ipNumber, `"${l.name}"`, l.noOfDays, l.totalMonthlyWages.toFixed(2), l.employeeContribution.toFixed(2), l.employerContribution.toFixed(2)].join(",")
  )].join("\r\n");

  const totalEmployeeEsi = round2(lines.reduce((s, l) => s + l.employeeContribution, 0));
  const totalEmployerEsi = round2(lines.reduce((s, l) => s + l.employerContribution, 0));

  return {
    csv,
    summary: {
      memberCount: lines.length,
      skipped,
      totalEmployeeEsi,
      totalEmployerEsi,
      grandTotal: round2(totalEmployeeEsi + totalEmployerEsi),
    },
  };
}

// --------------------------------------------------------------------------
// LWF — Labour Welfare Fund challan (% of gross wages, capped, e.g. Tamil Nadu)
// --------------------------------------------------------------------------

export interface LwfMemberLine {
  employeeCode: string;
  name: string;
  grossWages: number;
  employeeAmt: number;
  employerAmt: number;
}

export interface LwfChallanSummary {
  memberCount: number;
  totalEmployee: number;
  totalEmployer: number;
  grandTotal: number;
}

export function buildLwfChallanRows(rows: StatutoryEmployeeAgg[], company: CompanySettings): { lines: LwfMemberLine[]; summary: LwfChallanSummary } {
  const lines: LwfMemberLine[] = rows
    .filter((row) => row.grossEarnings > 0)
    .map((row) => ({
      employeeCode: row.employeeCode,
      name: row.name,
      grossWages: round2(row.grossEarnings),
      employeeAmt: round2(Math.min(row.grossEarnings * (company.lwfEmployeeRate / 100), company.lwfEmployeeMaxAmt)),
      employerAmt: round2(Math.min(row.grossEarnings * (company.lwfEmployerRate / 100), company.lwfEmployerMaxAmt)),
    }));

  const totalEmployee = round2(lines.reduce((s, l) => s + l.employeeAmt, 0));
  const totalEmployer = round2(lines.reduce((s, l) => s + l.employerAmt, 0));

  return {
    lines,
    summary: { memberCount: lines.length, totalEmployee, totalEmployer, grandTotal: round2(totalEmployee + totalEmployer) },
  };
}
