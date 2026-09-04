import { Router } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const reportsRouter = Router();

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ReportRow {
  client: { id: string; name: string };
  sheetId: string;
  employeeCount: number;
  basic: number;
  hra: number;
  grossEarnings: number;
  esi: number;
  epf: number;
  lwf: number;
  advance: number;
  totalDeductions: number;
  netPay: number;
}

/** Shared by /summary and /export so the two can never drift apart. */
async function buildReport(periodMonth: number, periodYear: number, clientId?: string) {
  const sheets = await prisma.salarySheet.findMany({
    where: { periodMonth, periodYear, ...(clientId ? { clientId } : {}) },
    include: {
      client: { select: { id: true, name: true } },
      salaryRecords: true,
    },
  });

  const rows: ReportRow[] = sheets.map((sheet) => {
    const r = sheet.salaryRecords;
    const total = (key: keyof (typeof r)[number]) =>
      r.reduce((acc, rec) => acc + (typeof rec[key] === "number" ? (rec[key] as number) : 0), 0);

    return {
      client: sheet.client,
      sheetId: sheet.id,
      employeeCount: r.length,
      basic: total("basic"),
      hra: total("hra"),
      grossEarnings: total("grossEarnings"),
      esi: total("esi"),
      epf: total("epf"),
      lwf: total("lwf"),
      advance: total("advance"),
      totalDeductions: total("totalDeductions"),
      netPay: total("netPay"),
    };
  });

  const grandTotal = rows.reduce(
    (acc, row) => ({
      employeeCount: acc.employeeCount + row.employeeCount,
      basic: acc.basic + row.basic,
      hra: acc.hra + row.hra,
      grossEarnings: acc.grossEarnings + row.grossEarnings,
      esi: acc.esi + row.esi,
      epf: acc.epf + row.epf,
      lwf: acc.lwf + row.lwf,
      advance: acc.advance + row.advance,
      totalDeductions: acc.totalDeductions + row.totalDeductions,
      netPay: acc.netPay + row.netPay,
    }),
    { employeeCount: 0, basic: 0, hra: 0, grossEarnings: 0, esi: 0, epf: 0, lwf: 0, advance: 0, totalDeductions: 0, netPay: 0 }
  );

  return { rows, grandTotal };
}

// Per-client wage cost + employee-side statutory contribution summary for a
// pay period. Note: this totals the EMPLOYEE-side ESI/EPF/LWF deductions
// found on the uploaded sheets — it does not compute employer-side
// contributions (which aren't present in these wage sheets), so treat it as
// a wage-cost and employee-contribution summary, not a full statutory filing.
reportsRouter.get("/summary", requireAuth, async (req, res) => {
  const periodMonth = parseInt(String(req.query.periodMonth ?? ""), 10);
  const periodYear = parseInt(String(req.query.periodYear ?? ""), 10);
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;

  if (!periodMonth || !periodYear) {
    return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  }

  const { rows, grandTotal } = await buildReport(periodMonth, periodYear, clientId);
  res.json({ periodMonth, periodYear, rows, grandTotal });
});

// Excel export of the same summary — same filters (periodMonth, periodYear,
// optional clientId), so what's on screen is exactly what gets downloaded.
reportsRouter.get("/export", requireAuth, async (req, res) => {
  const periodMonth = parseInt(String(req.query.periodMonth ?? ""), 10);
  const periodYear = parseInt(String(req.query.periodYear ?? ""), 10);
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;

  if (!periodMonth || !periodYear) {
    return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  }

  const { rows, grandTotal } = await buildReport(periodMonth, periodYear, clientId);

  const header = ["Client", "Employees", "Basic", "HRA", "Gross", "ESI", "EPF", "LWF", "Advance", "Total Deduction", "Net Pay"];
  const toRow = (r: ReportRow | typeof grandTotal, label?: string) => [
    label ?? ("client" in r ? r.client.name : ""),
    r.employeeCount, r.basic, r.hra, r.grossEarnings, r.esi, r.epf, r.lwf, r.advance, r.totalDeductions, r.netPay,
  ];
  const aoa = [header, ...rows.map((r) => toRow(r)), ...(rows.length > 1 ? [toRow(grandTotal, "Total")] : [])];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 24 }, { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 15 }, { wch: 13 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Summary");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const monthLabel = MONTH_NAMES[periodMonth - 1] ?? periodMonth;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="payroll-report-${monthLabel}-${periodYear}.xlsx"`);
  res.send(buffer);
});
