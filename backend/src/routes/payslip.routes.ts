import { Router } from "express";
import fs from "fs";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { streamZip } from "../services/zip.service";
import {
  isEmailConfigured,
  isWhatsappConfigured,
  sendPayslipEmail,
  sendPayslipWhatsApp,
} from "../services/notification.service";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const payslipRouter = Router();

// Download (or print, via browser print dialog on the PDF) a single payslip.
payslipRouter.get("/:payslipId/download", requireAuth, async (req, res) => {
  const payslip = await prisma.payslip.findUnique({
    where: { id: req.params.payslipId },
    include: { salaryRecord: { include: { employee: true, sheet: true } } },
  });
  if (!payslip || !fs.existsSync(payslip.pdfPath)) {
    return res.status(404).json({ error: "Payslip not found" });
  }

  const { employee, sheet } = payslip.salaryRecord;
  const fileName = `Payslip-${employee.employeeCode}-${sheet.periodMonth}-${sheet.periodYear}.pdf`;
  res.download(payslip.pdfPath, fileName);
});

// Bulk download all payslips for one uploaded sheet (pay period) as a zip.
payslipRouter.get("/sheet/:sheetId/download-all", requireAuth, async (req, res) => {
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
      nameInZip: `${r.employee.employeeCode}-${r.employee.name}.pdf`,
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

// Bulk-email every payslip in a sheet to employees who have an email on file.
payslipRouter.post("/sheet/:sheetId/send-email", requireAuth, async (req, res) => {
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
payslipRouter.post("/sheet/:sheetId/send-whatsapp", requireAuth, async (req, res) => {
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
