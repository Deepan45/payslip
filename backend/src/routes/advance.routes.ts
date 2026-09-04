import { Router } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const advanceRouter = Router();

// Excel export of the current ledger summary (one row per employee with any advance activity).
advanceRouter.get("/export", requireAuth, async (_req, res) => {
  const entries = await prisma.advanceEntry.findMany({
    include: { employee: { select: { employeeCode: true, name: true } } },
    orderBy: { date: "desc" },
  });

  const byEmployee = new Map<string, { code: string; name: string; issued: number; recovered: number }>();
  for (const e of entries) {
    const key = e.employee.employeeCode;
    const bucket = byEmployee.get(key) ?? { code: e.employee.employeeCode, name: e.employee.name, issued: 0, recovered: 0 };
    if (e.type === "ISSUED") bucket.issued += e.amount;
    else bucket.recovered += e.amount;
    byEmployee.set(key, bucket);
  }

  const rows = [
    ["Employee Code", "Employee Name", "Issued", "Recovered", "Balance"],
    ...Array.from(byEmployee.values())
      .sort((a, b) => b.issued - b.recovered - (a.issued - a.recovered))
      .map((b) => [b.code, b.name, b.issued, b.recovered, b.issued - b.recovered]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Advance Ledger");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="advance-ledger.xlsx"');
  res.send(buffer);
});

// List every employee who has at least one advance entry, with their running balance.
advanceRouter.get("/", requireAuth, async (_req, res) => {
  const entries = await prisma.advanceEntry.findMany({
    include: { employee: { select: { id: true, employeeCode: true, name: true } } },
    orderBy: { date: "desc" },
  });

  const byEmployee = new Map<
    string,
    { employee: { id: string; employeeCode: string; name: string }; issued: number; recovered: number; lastActivity: Date }
  >();

  for (const e of entries) {
    const key = e.employee.id;
    const bucket = byEmployee.get(key) ?? { employee: e.employee, issued: 0, recovered: 0, lastActivity: e.date };
    if (e.type === "ISSUED") bucket.issued += e.amount;
    else bucket.recovered += e.amount;
    if (e.date > bucket.lastActivity) bucket.lastActivity = e.date;
    byEmployee.set(key, bucket);
  }

  const summary = Array.from(byEmployee.values())
    .map((b) => ({
      employee: b.employee,
      issued: b.issued,
      recovered: b.recovered,
      balance: b.issued - b.recovered,
      lastActivity: b.lastActivity,
    }))
    .sort((a, b) => b.balance - a.balance);

  res.json({ summary });
});

// Full ledger + balance for one employee.
advanceRouter.get("/:employeeId", requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.employeeId } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const entries = await prisma.advanceEntry.findMany({
    where: { employeeId: req.params.employeeId },
    orderBy: { date: "desc" },
  });

  const balance = entries.reduce((sum, e) => sum + (e.type === "ISSUED" ? e.amount : -e.amount), 0);

  res.json({ employee, entries, balance });
});

// Edit a manually-issued advance entry. Entries auto-created from a payslip
// deduction (salaryRecordId set) are a payroll record, not editable here.
advanceRouter.put("/entries/:entryId", requireAuth, async (req, res) => {
  const existing = await prisma.advanceEntry.findUnique({ where: { id: req.params.entryId } });
  if (!existing) return res.status(404).json({ error: "Entry not found" });
  if (existing.salaryRecordId) {
    return res.status(400).json({ error: "This entry was auto-recorded from a payslip and can't be edited here." });
  }

  const { amount, date, note } = req.body as { amount?: number; date?: string; note?: string };
  if (amount !== undefined && amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  const entry = await prisma.advanceEntry.update({
    where: { id: req.params.entryId },
    data: {
      ...(amount !== undefined ? { amount } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  });
  res.json({ entry });
});

// Delete a manually-issued advance entry (same restriction as edit above).
advanceRouter.delete("/entries/:entryId", requireAuth, async (req, res) => {
  const existing = await prisma.advanceEntry.findUnique({ where: { id: req.params.entryId } });
  if (!existing) return res.status(404).json({ error: "Entry not found" });
  if (existing.salaryRecordId) {
    return res.status(400).json({ error: "This entry was auto-recorded from a payslip and can't be deleted here." });
  }
  await prisma.advanceEntry.delete({ where: { id: req.params.entryId } });
  res.json({ ok: true });
});

// Manually issue an advance (cash given outside payroll).
advanceRouter.post("/", requireAuth, async (req, res) => {
  const { employeeId, amount, date, note } = req.body as {
    employeeId?: string;
    amount?: number;
    date?: string;
    note?: string;
  };
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const entry = await prisma.advanceEntry.create({
    data: {
      employeeId,
      type: "ISSUED",
      amount,
      date: date ? new Date(date) : new Date(),
      note: note || "Manually issued advance",
    },
  });

  res.status(201).json({ entry });
});
