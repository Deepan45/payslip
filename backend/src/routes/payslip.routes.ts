import { Router } from "express";
import fs from "fs";
import { prisma } from "../config/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { streamZip } from "../services/zip.service";
import {
  isEmailConfigured,
  isWhatsappConfigured,
  sendPayslipEmail,
  sendPayslipWhatsApp,
} from "../services/notification.service";
import { payslipFileName } from "../utils/payslipFileName";
import { isPayslipsPerPage, streamPayslipPrintSheet } from "../services/pdf.service";
import { payslipPdfData } from "../services/payslipData.service";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const payslipRouter = Router();
payslipRouter.use(requireAuth);

// Download (or print, via browser print dialog on the PDF) a single payslip.
payslipRouter.get("/:payslipId/download", requirePermission("payslips.view"), async (req, res) => {
  const payslip = await prisma.payslip.findUnique({
    where: { id: req.params.payslipId },
    include: { salaryRecord: { include: { employee: true, sheet: true } } },
  });
  if (!payslip || !fs.existsSync(payslip.pdfPath)) {
    return res.status(404).json({ error: "Payslip not found" });
  }

  const { employee, sheet } = payslip.salaryRecord;
  res.download(payslip.pdfPath, payslipFileName(employee.employeeCode, employee.name, sheet.periodMonth, sheet.periodYear));
});

// Bulk download all payslips for one uploaded sheet (pay period) as a zip.
payslipRouter.get("/sheet/:sheetId/download-all", requirePermission("payslips.view"), async (req, res) => {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    include: {
      salaryRecords: {
        include: { employee: true, payslip: true },
      },
    },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });

  const entries = sheet.salaryRecords
    .filter((r) => r.payslip && fs.existsSync(r.payslip.pdfPath))
    .map((r) => ({
      filePath: r.payslip!.pdfPath,
      nameInZip: payslipFileName(r.employee.employeeCode, r.employee.name, sheet.periodMonth, sheet.periodYear),
    }));

  if (entries.length === 0) {
    return res.status(404).json({ error: "No payslips available for this sheet" });
  }

  try {
    await streamZip(res, `Payslips-${sheet.periodMonth}-${sheet.periodYear}.zip`, entries);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Failed to build zip archive" });
  }
});

// One combined PDF of a sheet's payslips, 1/2/3 per A4 page, for printing on paper.
// ?perPage=1|2|3 overrides CompanySettings.payslipsPerPage; ?recordIds=a,b,c limits it to
// selected rows. Rendered fresh from the stored salary records: amounts are exactly as uploaded,
// but employee details (bank a/c, UAN, ...) are the current ones if edited since.
payslipRouter.get("/sheet/:sheetId/print", requirePermission("payslips.view"), async (req, res) => {
  const company = await prisma.companySettings.findFirst();
  const perPage = req.query.perPage !== undefined ? Number(req.query.perPage) : company?.payslipsPerPage ?? 3;
  if (!isPayslipsPerPage(perPage)) {
    return res.status(400).json({ error: "perPage must be 1, 2 or 3" });
  }
  const recordIds =
    typeof req.query.recordIds === "string" && req.query.recordIds
      ? req.query.recordIds.split(",").filter(Boolean)
      : undefined;

  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    include: {
      client: true,
      salaryRecords: {
        where: recordIds ? { id: { in: recordIds } } : undefined,
        include: { employee: true },
      },
    },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });
  if (sheet.salaryRecords.length === 0) {
    return res.status(404).json({ error: "No payslips to print for this sheet" });
  }

  const period = { month: sheet.periodMonth, year: sheet.periodYear };
  const items = sheet.salaryRecords
    .sort((a, b) => a.employee.employeeCode.localeCompare(b.employee.employeeCode, undefined, { numeric: true }))
    .map((r) => payslipPdfData(company, sheet.client.name, r.employee, r, period));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="Payslips-${sheet.periodMonth}-${sheet.periodYear}-${perPage}-per-page.pdf"`
  );
  try {
    await streamPayslipPrintSheet(items, perPage, res);
  } catch (err) {
    console.error("Failed to build payslip print sheet", sheet.id, err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to build print PDF" });
    else res.end();
  }
});

// Bulk-email every payslip in a sheet to employees who have an email on file.
payslipRouter.post("/sheet/:sheetId/send-email", requirePermission("payslips.send"), async (req, res) => {
  if (!isEmailConfigured()) {
    return res.status(503).json({ error: "Email delivery is not configured. Set SMTP_* in backend/.env." });
  }

  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    include: { salaryRecords: { include: { employee: true, payslip: true } } },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });

  const periodLabel = `${MONTH_NAMES[sheet.periodMonth - 1] ?? sheet.periodMonth} ${sheet.periodYear}`;
  const results: { employeeCode: string; name: string; ok: boolean; reason?: string }[] = [];

  for (const r of sheet.salaryRecords) {
    if (!r.payslip) {
      results.push({ employeeCode: r.employee.employeeCode, name: r.employee.name, ok: false, reason: "No payslip generated" });
      continue;
    }
    if (!r.employee.email) {
      results.push({ employeeCode: r.employee.employeeCode, name: r.employee.name, ok: false, reason: "No email on file" });
      continue;
    }
    const result = await sendPayslipEmail(r.employee.email, r.employee.name, periodLabel, r.payslip.pdfPath);
    if (result.ok) await prisma.payslip.update({ where: { id: r.payslip.id }, data: { emailedAt: new Date() } });
    results.push({ employeeCode: r.employee.employeeCode, name: r.employee.name, ok: result.ok, reason: result.reason });
  }

  res.json({ sent: results.filter((r) => r.ok).length, total: results.length, results });
});

// Bulk-WhatsApp every payslip in a sheet (as a download link) to employees who have a phone on file.
payslipRouter.post("/sheet/:sheetId/send-whatsapp", requirePermission("payslips.send"), async (req, res) => {
  if (!isWhatsappConfigured()) {
    return res.status(503).json({ error: "WhatsApp delivery is not configured. Set TWILIO_* in backend/.env." });
  }

  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    include: { salaryRecords: { include: { employee: true, payslip: true } } },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });

  const periodLabel = `${MONTH_NAMES[sheet.periodMonth - 1] ?? sheet.periodMonth} ${sheet.periodYear}`;
  const results: { employeeCode: string; name: string; ok: boolean; reason?: string }[] = [];

  for (const r of sheet.salaryRecords) {
    if (!r.payslip) {
      results.push({ employeeCode: r.employee.employeeCode, name: r.employee.name, ok: false, reason: "No payslip generated" });
      continue;
    }
    if (!r.employee.phone) {
      results.push({ employeeCode: r.employee.employeeCode, name: r.employee.name, ok: false, reason: "No phone on file" });
      continue;
    }
    const result = await sendPayslipWhatsApp(r.employee.phone, r.employee.name, periodLabel, r.payslip.id);
    if (result.ok) await prisma.payslip.update({ where: { id: r.payslip.id }, data: { whatsappedAt: new Date() } });
    results.push({ employeeCode: r.employee.employeeCode, name: r.employee.name, ok: result.ok, reason: result.reason });
  }

  res.json({ sent: results.filter((r) => r.ok).length, total: results.length, results });
});
