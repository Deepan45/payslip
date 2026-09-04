import { Router } from "express";
import fs from "fs";
import { prisma } from "../config/db";
import { verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { requireEmployeeAuth, AuthedRequest } from "../middleware/auth";

export const portalRouter = Router();

// Employee self-service login: Employee Code + the password an admin issued them.
portalRouter.post("/login", async (req, res) => {
  const { employeeCode, password } = req.body as { employeeCode?: string; password?: string };
  if (!employeeCode || !password) {
    return res.status(400).json({ error: "Employee code and password are required" });
  }

  const employee = await prisma.employee.findUnique({ where: { employeeCode: employeeCode.trim() } });
  if (!employee || !employee.portalPasswordHash) {
    return res.status(401).json({ error: "Invalid employee code or password" });
  }

  const valid = await verifyPassword(password, employee.portalPasswordHash);
  if (!valid) return res.status(401).json({ error: "Invalid employee code or password" });

  const token = signToken({ role: "employee", employeeId: employee.id, employeeCode: employee.employeeCode });
  res.json({ token, employee: { id: employee.id, employeeCode: employee.employeeCode, name: employee.name } });
});

portalRouter.get("/me", requireEmployeeAuth, async (req: AuthedRequest, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.employee!.employeeId },
    include: { currentClient: { select: { name: true } } },
  });
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  const { portalPasswordHash: _omit, ...safe } = employee;
  res.json({ employee: safe });
});

// The employee's own payslip history only — never another employee's.
portalRouter.get("/payslips", requireEmployeeAuth, async (req: AuthedRequest, res) => {
  const records = await prisma.salaryRecord.findMany({
    where: { employeeId: req.employee!.employeeId },
    include: { sheet: { include: { client: { select: { name: true } } } }, payslip: true },
    orderBy: [{ sheet: { periodYear: "desc" } }, { sheet: { periodMonth: "desc" } }],
  });
  res.json({ records });
});

portalRouter.get("/payslips/:payslipId/download", requireEmployeeAuth, async (req: AuthedRequest, res) => {
  const payslip = await prisma.payslip.findUnique({
    where: { id: req.params.payslipId },
    include: { salaryRecord: { include: { employee: true, sheet: true } } },
  });
  if (!payslip) return res.status(404).json({ error: "Payslip not found" });
  if (payslip.salaryRecord.employeeId !== req.employee!.employeeId) {
    return res.status(403).json({ error: "Not your payslip" });
  }
  if (!fs.existsSync(payslip.pdfPath)) return res.status(404).json({ error: "Payslip file missing" });

  const { employee, sheet } = payslip.salaryRecord;
  res.download(payslip.pdfPath, `Payslip-${employee.employeeCode}-${sheet.periodMonth}-${sheet.periodYear}.pdf`);
});
