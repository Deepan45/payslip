import { Router } from "express";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, async (_req, res) => {
  const [totalEmployees, totalClients, totalSheets, latestSheet] = await Promise.all([
    prisma.employee.count(),
    prisma.client.count(),
    prisma.salarySheet.count(),
    prisma.salarySheet.findFirst({ orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] }),
  ]);

  let latestPeriod: { month: number; year: number } | null = null;
  let payrollByClient: {
    clientId: string;
    clientName: string;
    netPay: number;
    grossEarnings: number;
    employeeCount: number;
    esi: number;
    epf: number;
    lwf: number;
    advance: number;
  }[] = [];
  let latestTotals = { grossEarnings: 0, netPay: 0, employeeCount: 0, esi: 0, epf: 0, lwf: 0, advance: 0 };

  if (latestSheet) {
    latestPeriod = { month: latestSheet.periodMonth, year: latestSheet.periodYear };
    const sheets = await prisma.salarySheet.findMany({
      where: { periodMonth: latestSheet.periodMonth, periodYear: latestSheet.periodYear },
      include: { client: { select: { id: true, name: true } }, salaryRecords: true },
    });
    payrollByClient = sheets
      .map((s) => ({
        clientId: s.client.id,
        clientName: s.client.name,
        netPay: s.salaryRecords.reduce((sum, r) => sum + r.netPay, 0),
        grossEarnings: s.salaryRecords.reduce((sum, r) => sum + r.grossEarnings, 0),
        employeeCount: s.salaryRecords.length,
        esi: s.salaryRecords.reduce((sum, r) => sum + r.esi, 0),
        epf: s.salaryRecords.reduce((sum, r) => sum + r.epf, 0),
        lwf: s.salaryRecords.reduce((sum, r) => sum + r.lwf, 0),
        advance: s.salaryRecords.reduce((sum, r) => sum + r.advance, 0),
      }))
      .sort((a, b) => b.netPay - a.netPay);
    latestTotals = payrollByClient.reduce(
      (acc, row) => ({
        grossEarnings: acc.grossEarnings + row.grossEarnings,
        netPay: acc.netPay + row.netPay,
        employeeCount: acc.employeeCount + row.employeeCount,
        esi: acc.esi + row.esi,
        epf: acc.epf + row.epf,
        lwf: acc.lwf + row.lwf,
        advance: acc.advance + row.advance,
      }),
      { grossEarnings: 0, netPay: 0, employeeCount: 0, esi: 0, epf: 0, lwf: 0, advance: 0 }
    );
  }

  const advanceEntries = await prisma.advanceEntry.findMany();
  const outstandingAdvances = advanceEntries.reduce((sum, e) => sum + (e.type === "ISSUED" ? e.amount : -e.amount), 0);

  const recentUploads = await prisma.salarySheet.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 6,
    include: { client: { select: { name: true } } },
  });

  res.json({
    totalEmployees,
    totalClients,
    totalSheets,
    latestPeriod,
    latestTotals,
    payrollByClient,
    outstandingAdvances,
    recentUploads: recentUploads.map((s) => ({
      id: s.id,
      clientName: s.client.name,
      periodMonth: s.periodMonth,
      periodYear: s.periodYear,
      fileName: s.fileName,
      recordCount: s.recordCount,
      uploadedAt: s.uploadedAt,
    })),
  });
});
