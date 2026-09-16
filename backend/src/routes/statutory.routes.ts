import { Router } from "express";
import * as XLSX from "xlsx";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  aggregateEmployeesForPeriod,
  getCompanySettings,
  buildPfEcrText,
  buildEsiFileCsv,
  buildLwfChallanRows,
} from "../services/statutory.service";

export const statutoryRouter = Router();
statutoryRouter.use(requireAuth, requirePermission("statutory.view"));

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parsePeriod(req: import("express").Request): { periodMonth: number; periodYear: number } | null {
  const periodMonth = parseInt(String(req.query.periodMonth ?? ""), 10);
  const periodYear = parseInt(String(req.query.periodYear ?? ""), 10);
  if (!periodMonth || periodMonth < 1 || periodMonth > 12 || !periodYear) return null;
  return { periodMonth, periodYear };
}

// PF — on-screen summary (totals + skipped members) before downloading the ECR file.
statutoryRouter.get("/pf/summary", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { summary } = buildPfEcrText(rows, company);
  res.json({ ...period, pfEstablishmentId: company.pfEstablishmentId, summary });
});

// PF — downloads the actual ECR text file to upload on the EPFO portal.
statutoryRouter.get("/pf/ecr-file", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { text } = buildPfEcrText(rows, company);
  const label = `${MONTH_NAMES[period.periodMonth - 1]}-${period.periodYear}`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="PF-ECR-${label}.txt"`);
  res.send(text);
});

// ESI — on-screen summary before downloading the contribution file.
statutoryRouter.get("/esi/summary", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { summary } = buildEsiFileCsv(rows, company);
  res.json({ ...period, esicEmployerCode: company.esicEmployerCode, summary });
});

// ESI — downloads the contribution CSV to upload on the ESIC portal.
statutoryRouter.get("/esi/file", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { csv } = buildEsiFileCsv(rows, company);
  const label = `${MONTH_NAMES[period.periodMonth - 1]}-${period.periodYear}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ESI-Contribution-${label}.csv"`);
  res.send(csv);
});

// LWF — on-screen summary. Note: LWF (e.g. Maharashtra) is typically remitted
// half-yearly, not every month — this computes the slab-based amount for
// whichever single period is selected; only run it for a month your
// establishment's LWF cycle is actually due for.
statutoryRouter.get("/lwf/summary", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { summary } = buildLwfChallanRows(rows, company);
  res.json({ ...period, lwfRegistrationNo: company.lwfRegistrationNo, summary });
});

// LWF — downloads an Excel challan listing every employee's slab-based contribution.
statutoryRouter.get("/lwf/challan-file", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { lines, summary } = buildLwfChallanRows(rows, company);
  const monthLabel = MONTH_NAMES[period.periodMonth - 1];

  const header = ["Employee Code", "Name", "Gross Wages", "Employee Contribution", "Employer Contribution"];
  const aoa = [
    [`Labour Welfare Fund Challan — ${monthLabel} ${period.periodYear}`],
    [`LWF Registration No: ${company.lwfRegistrationNo ?? ""}`],
    [],
    header,
    ...lines.map((l) => [l.employeeCode, l.name, l.grossWages, l.employeeAmt, l.employerAmt]),
    [],
    ["Total", "", "", summary.totalEmployee, summary.totalEmployer],
    ["Grand Total", "", "", "", summary.grandTotal],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [{ wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 20 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "LWF Challan");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="LWF-Challan-${monthLabel}-${period.periodYear}.xlsx"`);
  res.send(buffer);
});
