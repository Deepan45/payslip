import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { hashPassword } from "../utils/password";

export const employeeRouter = Router();

employeeRouter.get("/", requireAuth, async (req, res) => {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
  const employees = await prisma.employee.findMany({
    where: clientId ? { currentClientId: clientId } : undefined,
    include: { currentClient: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ employees });
});

employeeRouter.get("/:id", requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: {
      currentClient: { select: { id: true, name: true } },
      salaryRecords: {
        include: { sheet: { include: { client: { select: { name: true } } } }, payslip: true },
        orderBy: [{ sheet: { periodYear: "desc" } }, { sheet: { periodMonth: "desc" } }],
      },
    },
  });
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  const { portalPasswordHash, ...safe } = employee;
  res.json({ employee: { ...safe, portalAccessEnabled: Boolean(portalPasswordHash) } });
});

employeeRouter.put("/:id", requireAuth, async (req, res) => {
  const { email, phone } = req.body as { email?: string; phone?: string };
  try {
    const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { email, phone } });
    res.json({ employee });
  } catch {
    res.status(404).json({ error: "Employee not found" });
  }
});

// Delete an employee. Blocked if they have any salary/payslip history or
// advance activity — that's payroll and statutory data, not something a
// stray click should be able to erase. Only an employee with none yet
// (e.g. added by mistake, never on a payslip) can be deleted directly.
employeeRouter.delete("/:id", requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { salaryRecords: true, advanceEntries: true } } },
  });
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (employee._count.salaryRecords > 0) {
    return res.status(409).json({
      error: `${employee.name} has ${employee._count.salaryRecords} payslip record(s). Delete those uploaded sheets from History first.`,
    });
  }
  if (employee._count.advanceEntries > 0) {
    return res.status(409).json({
      error: `${employee.name} has advance ledger entries. Delete those from the Advance Ledger first.`,
    });
  }

  await prisma.employee.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Enables (or resets) self-service portal access for one employee, returning
// a freshly generated temporary password ONCE — it is not recoverable after
// this response, only reset-able.
employeeRouter.post("/:id/portal-access", requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const tempPassword = crypto.randomBytes(4).toString("hex"); // 8 hex chars, easy to relay verbally
  const portalPasswordHash = await hashPassword(tempPassword);
  await prisma.employee.update({ where: { id: employee.id }, data: { portalPasswordHash } });

  res.json({ employeeCode: employee.employeeCode, temporaryPassword: tempPassword });
});
