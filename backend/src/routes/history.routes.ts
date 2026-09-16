import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../config/db";
import { requireAuth, requirePermission } from "../middleware/auth";

export const historyRouter = Router();
historyRouter.use(requireAuth, requirePermission("history.view"));

const PAYSLIP_STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "payslips");
const SALARY_SHEET_STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "salary-sheets");
const BILL_STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "bills");

/**
 * Deletes a set of SalaryRecords (and everything hanging off them) cleanly:
 *  - their generated Payslip PDF files on disk (Payslip *rows* cascade
 *    automatically via the DB's onDelete: Cascade, but the files don't),
 *  - their AdvanceEntry rows — NOT DB-cascaded (AdvanceEntry.salaryRecordId
 *    has no onDelete: Cascade), so deleting a record with a "recovered
 *    advance" entry still attached would otherwise fail on the FK
 *    constraint,
 *  - then the SalaryRecords themselves (cascades their Payslip row).
 * Does not touch the SalarySheet row or its recordCount — callers do that.
 */
async function deleteSalaryRecordsCascade(recordIds: string[]): Promise<void> {
  if (recordIds.length === 0) return;

  const payslips = await prisma.payslip.findMany({
    where: { salaryRecordId: { in: recordIds } },
    select: { pdfPath: true },
  });

  await prisma.advanceEntry.deleteMany({ where: { salaryRecordId: { in: recordIds } } });
  await prisma.salaryRecord.deleteMany({ where: { id: { in: recordIds } } });

  for (const p of payslips) {
    fs.rm(p.pdfPath, { force: true }, () => {}); // best-effort; an already-missing file is not an error
  }
}

// List all previously uploaded salary sheets (most recent first). Optional
// clientId / periodYear / periodMonth filters, for the Payslips browse page.
historyRouter.get("/", async (req, res) => {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
  const periodYear = req.query.periodYear ? parseInt(String(req.query.periodYear), 10) : undefined;
  const periodMonth = req.query.periodMonth ? parseInt(String(req.query.periodMonth), 10) : undefined;

  const sheets = await prisma.salarySheet.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(periodYear ? { periodYear } : {}),
      ...(periodMonth ? { periodMonth } : {}),
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { uploadedAt: "desc" },
  });
  res.json({ sheets });
});

// Distinct years that have at least one uploaded sheet, for the Payslips filter.
historyRouter.get("/meta/years", async (_req, res) => {
  const sheets = await prisma.salarySheet.findMany({ select: { periodYear: true }, distinct: ["periodYear"] });
  const years = sheets.map((s) => s.periodYear).sort((a, b) => b - a);
  res.json({ years });
});

// Detail for one sheet: every employee's salary record + generated payslip for that period.
historyRouter.get("/:sheetId", async (req, res) => {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    include: {
      client: { select: { id: true, name: true } },
      salaryRecords: {
        include: { employee: true, payslip: true },
        orderBy: { employee: { name: "asc" } },
      },
      // Totals only here (not the itemized `lines` JSON) — the detail page just shows a summary
      // card + a download-PDF button, so the per-employee breakdown doesn't need to round-trip.
      clientBill: {
        select: {
          id: true,
          employeeCount: true,
          totalGrossWages: true,
          totalEmployerEpf: true,
          totalEmployerEsi: true,
          totalEmployerLwf: true,
          pfAdminCharge: true,
          billingRateUsed: true,
          serviceCharge: true,
          totalWageCost: true,
          grandTotal: true,
          generatedAt: true,
        },
      },
    },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });
  res.json({ sheet });
});

// Re-downloads the originally uploaded workbook for this sheet, exactly as uploaded — not the
// generated payslips. Only available for sheets uploaded after this feature existed (filePath set).
historyRouter.get("/:sheetId/download", async (req, res) => {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    select: { id: true, fileName: true, filePath: true },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });
  if (!sheet.filePath) {
    return res.status(404).json({ error: "The original file for this upload wasn't kept (uploaded before this feature was added)." });
  }
  const diskPath = path.join(SALARY_SHEET_STORAGE_DIR, sheet.id, sheet.filePath);
  if (!fs.existsSync(diskPath)) {
    return res.status(404).json({ error: "The original file is missing from storage." });
  }
  res.download(diskPath, sheet.fileName);
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Downloads the client bill PDF generated automatically when this sheet was uploaded. 404s for
// sheets uploaded before this feature existed, or if bill generation failed at upload time.
historyRouter.get("/:sheetId/bill/download", async (req, res) => {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    select: {
      periodMonth: true,
      periodYear: true,
      client: { select: { name: true } },
      clientBill: { select: { pdfPath: true } },
    },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });
  if (!sheet.clientBill) {
    return res.status(404).json({ error: "No bill was generated for this sheet (uploaded before this feature existed, or generation failed)." });
  }
  if (!fs.existsSync(sheet.clientBill.pdfPath)) {
    return res.status(404).json({ error: "The bill PDF is missing from storage." });
  }
  const label = `${sheet.client.name}-${MONTH_NAMES[sheet.periodMonth - 1]}-${sheet.periodYear}`.replace(/[^\w.\- ]/g, "_");
  res.download(sheet.clientBill.pdfPath, `Bill-${label}.pdf`);
});

// Bulk-delete specific payslips (salary records) within one sheet — the
// underlying employees and the sheet itself are untouched, only these rows.
historyRouter.post("/:sheetId/records/delete", requirePermission("history.delete"), async (req, res) => {
  const { recordIds } = req.body as { recordIds?: string[] };
  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    return res.status(400).json({ error: "recordIds must be a non-empty array" });
  }

  const records = await prisma.salaryRecord.findMany({
    where: { id: { in: recordIds }, sheetId: req.params.sheetId }, // scope to this sheet, ignore any stray ids
    select: { id: true },
  });
  if (records.length === 0) return res.status(404).json({ error: "None of the given records belong to this sheet" });

  await deleteSalaryRecordsCascade(records.map((r) => r.id));
  await prisma.salarySheet.update({
    where: { id: req.params.sheetId },
    data: { recordCount: { decrement: records.length } },
  });

  res.json({ deleted: records.length });
});

// Deletes one uploaded sheet — every payslip in it, and the sheet itself.
// Does not touch the employees or client it referenced. Shared by the
// single-delete route and the bulk one below.
async function deleteSheet(sheetId: string): Promise<{ ok: true } | { ok: false }> {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: sheetId },
    select: { id: true, salaryRecords: { select: { id: true } } },
  });
  if (!sheet) return { ok: false };

  await deleteSalaryRecordsCascade(sheet.salaryRecords.map((r) => r.id));
  await prisma.salarySheet.delete({ where: { id: sheet.id } });

  // Best-effort cleanup of the sheet's payslip directory (any files
  // deleteSalaryRecordsCascade missed, e.g. from a record already gone) and
  // its saved original workbook.
  fs.rm(path.join(PAYSLIP_STORAGE_DIR, sheet.id), { recursive: true, force: true }, () => {});
  fs.rm(path.join(SALARY_SHEET_STORAGE_DIR, sheet.id), { recursive: true, force: true }, () => {});
  fs.rm(path.join(BILL_STORAGE_DIR, sheet.id), { recursive: true, force: true }, () => {});

  return { ok: true };
}

historyRouter.delete("/:sheetId", requirePermission("history.delete"), async (req, res) => {
  const result = await deleteSheet(req.params.sheetId);
  if (!result.ok) return res.status(404).json({ error: "Sheet not found" });
  res.json({ ok: true });
});

// Bulk delete: removes every given sheet (each has no dependents to be
// "blocked" by — a sheet is a self-contained upload batch), and reports
// which ids didn't correspond to a real sheet.
historyRouter.post("/delete", requirePermission("history.delete"), async (req, res) => {
  const { sheetIds } = req.body as { sheetIds?: string[] };
  if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
    return res.status(400).json({ error: "sheetIds must be a non-empty array" });
  }

  const deleted: string[] = [];
  const notFound: string[] = [];
  for (const id of sheetIds) {
    const result = await deleteSheet(id);
    if (result.ok) deleted.push(id);
    else notFound.push(id);
  }

  res.json({ deleted, notFound });
});
