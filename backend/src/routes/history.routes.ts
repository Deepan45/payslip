import { Router } from "express";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const historyRouter = Router();

// List all previously uploaded salary sheets (most recent first). Optional
// clientId / periodYear / periodMonth filters, for the Payslips browse page.
historyRouter.get("/", requireAuth, async (req, res) => {
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
historyRouter.get("/meta/years", requireAuth, async (_req, res) => {
  const sheets = await prisma.salarySheet.findMany({ select: { periodYear: true }, distinct: ["periodYear"] });
  const years = sheets.map((s) => s.periodYear).sort((a, b) => b - a);
  res.json({ years });
});

// Detail for one sheet: every employee's salary record + generated payslip for that period.
historyRouter.get("/:sheetId", requireAuth, async (req, res) => {
  const sheet = await prisma.salarySheet.findUnique({
    where: { id: req.params.sheetId },
    include: {
      client: { select: { id: true, name: true } },
      salaryRecords: {
        include: { employee: true, payslip: true },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });
  if (!sheet) return res.status(404).json({ error: "Sheet not found" });
  res.json({ sheet });
});
