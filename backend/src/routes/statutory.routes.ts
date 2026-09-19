import { Router } from "express";
import * as XLSX from "xlsx";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  aggregateEmployeesForPeriod,
  getCompanySettings,
  buildPfEcrText,
  buildPfEcrSheetRows,
  buildEsiFileCsv,
  buildLwfChallanRows,
} from "../services/statutory.service";
import { buildLwfWorkerFileRows, LWF_WORKER_FILE_HEADER } from "../services/lwfWorkerFile.service";

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

// PF — the same ECR data as an Excel working sheet ("AUG PF.xlsx" layout: no header row,
// EE/EPS/ER contribution columns as live formulas), for review/adjustment before filing.
statutoryRouter.get("/pf/ecr-xlsx", async (req, res) => {
  const period = parsePeriod(req);
  if (!period) return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  const [rows, company] = await Promise.all([
    aggregateEmployeesForPeriod(period.periodMonth, period.periodYear),
    getCompanySettings(),
  ]);
  const { aoa } = buildPfEcrSheetRows(rows, company);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [{ wch: 15 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const monthAbbr = MONTH_NAMES[period.periodMonth - 1].slice(0, 3).toUpperCase();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${monthAbbr} PF.xlsx"`);
  res.send(buffer);
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

// LWF — on-screen summary. Note: LWF is typically remitted half-yearly or
// annually depending on the state, not every month — this computes the
// percentage-based amount for whichever single period is selected; only run
// it for a month your establishment's LWF cycle is actually due for.
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

// LWF Worker Data File — the annual Haryana LWF portal bulk-worker-upload
// template, built from current Employee records (not period-specific — this
// is the whole current roster, unlike the monthly PF/ESI/LWF challan files).
statutoryRouter.get("/lwf/worker-data-summary", async (_req, res) => {
  const { summary, rows } = await buildLwfWorkerFileRows();
  const incompleteEmployees = rows.filter((r) => r.missing.length > 0).map((r) => ({
    employeeCode: r.employeeCode,
    name: r.name,
    missing: r.missing,
  }));
  res.json({ summary, incompleteEmployees });
});

statutoryRouter.get("/lwf/worker-data-file", async (_req, res) => {
  const { rows } = await buildLwfWorkerFileRows();
  const aoa = [LWF_WORKER_FILE_HEADER, ...rows.map((r) => r.cells)];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = LWF_WORKER_FILE_HEADER.map(() => ({ wch: 20 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "LWF Worker Data");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="LWF-Worker-Data-File-${new Date().getFullYear()}.xlsx"`);
  res.send(buffer);
});
