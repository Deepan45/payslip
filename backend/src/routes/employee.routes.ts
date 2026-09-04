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

// Tries to delete one employee. Blocked if they have any salary/payslip
// history or advance activity — that's payroll and statutory data, not
// something a stray click should be able to erase. Only an employee with
// none yet (e.g. added by mistake, never on a payslip) can be deleted
// directly. Shared by both the single-delete route and the bulk one below.
async function tryDeleteEmployee(id: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { _count: { select: { salaryRecords: true, advanceEntries: true } } },
  });
  if (!employee) return { ok: false, status: 404, error: "Employee not found" };

  if (employee._count.salaryRecords > 0) {
    return {
      ok: false,
      status: 409,
      error: `${employee.name} has ${employee._count.salaryRecords} payslip record(s). Delete those uploaded sheets from History first.`,
    };
  }
  if (employee._count.advanceEntries > 0) {
    return { ok: false, status: 409, error: `${employee.name} has advance ledger entries. Delete those from the Advance Ledger first.` };
  }

  await prisma.employee.delete({ where: { id } });
  return { ok: true };
}

employeeRouter.delete("/:id", requireAuth, async (req, res) => {
  const result = await tryDeleteEmployee(req.params.id);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

// Bulk delete: attempts every id independently and reports per-id outcome
// rather than failing the whole batch on the first blocked one.
employeeRouter.post("/delete", requireAuth, async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids must be a non-empty array" });

  const deleted: string[] = [];
  const blocked: { id: string; error: string }[] = [];
  for (const id of ids) {
    const result = await tryDeleteEmployee(id);
    if (result.ok) deleted.push(id);
    else blocked.push({ id, error: result.error });
  }

  res.json({ deleted, blocked });
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
