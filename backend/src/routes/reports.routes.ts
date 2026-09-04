import { Router } from "express";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const reportsRouter = Router();

// Per-client wage cost + employee-side statutory contribution summary for a
// pay period. Note: this totals the EMPLOYEE-side ESI/EPF/LWF deductions
// found on the uploaded sheets — it does not compute employer-side
// contributions (which aren't present in these wage sheets), so treat it as
// a wage-cost and employee-contribution summary, not a full statutory filing.
reportsRouter.get("/summary", requireAuth, async (req, res) => {
  const periodMonth = parseInt(String(req.query.periodMonth ?? ""), 10);
  const periodYear = parseInt(String(req.query.periodYear ?? ""), 10);
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;

  if (!periodMonth || !periodYear) {
    return res.status(400).json({ error: "periodMonth and periodYear query params are required" });
  }

  const sheets = await prisma.salarySheet.findMany({
    where: { periodMonth, periodYear, ...(clientId ? { clientId } : {}) },
    include: {
      client: { select: { id: true, name: true } },
      salaryRecords: true,
    },
  });

  const rows = sheets.map((sheet) => {
    const r = sheet.salaryRecords;
    const total = (key: keyof (typeof r)[number]) =>
      r.reduce((acc, rec) => acc + (typeof rec[key] === "number" ? (rec[key] as number) : 0), 0);

    return {
      client: sheet.client,
      sheetId: sheet.id,
      employeeCount: r.length,
      basic: total("basic"),
      hra: total("hra"),
      grossEarnings: total("grossEarnings"),
      esi: total("esi"),
      epf: total("epf"),
      lwf: total("lwf"),
      advance: total("advance"),
      totalDeductions: total("totalDeductions"),
      netPay: total("netPay"),
    };
  });

  const grandTotal = rows.reduce(
    (acc, row) => ({
      employeeCount: acc.employeeCount + row.employeeCount,
      basic: acc.basic + row.basic,
      hra: acc.hra + row.hra,
      grossEarnings: acc.grossEarnings + row.grossEarnings,
      esi: acc.esi + row.esi,
      epf: acc.epf + row.epf,
      lwf: acc.lwf + row.lwf,
      advance: acc.advance + row.advance,
      totalDeductions: acc.totalDeductions + row.totalDeductions,
      netPay: acc.netPay + row.netPay,
    }),
    { employeeCount: 0, basic: 0, hra: 0, grossEarnings: 0, esi: 0, epf: 0, lwf: 0, advance: 0, totalDeductions: 0, netPay: 0 }
  );

  res.json({ periodMonth, periodYear, rows, grandTotal });
});
