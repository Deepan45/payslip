import { Router } from "express";
import fs from "fs";
import { prisma } from "../config/db";
import { verifyPayslipLink } from "../utils/signedLink";

// Unauthenticated routes reachable via a signed, time-limited token only —
// used so a WhatsApp/email message can link straight to a payslip PDF
// without the recipient needing to log in.
export const publicRouter = Router();

publicRouter.get("/payslips/:payslipId", async (req, res) => {
  const { payslipId } = req.params;
  const token = String(req.query.token ?? "");
  if (!token || !verifyPayslipLink(token, payslipId)) {
    return res.status(401).json({ error: "Invalid or expired link" });
  }

  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: { salaryRecord: { include: { employee: true, sheet: true } } },
  });
  if (!payslip || !fs.existsSync(payslip.pdfPath)) return res.status(404).json({ error: "Payslip not found" });

  const { employee, sheet } = payslip.salaryRecord;
  res.download(payslip.pdfPath, `Payslip-${employee.employeeCode}-${sheet.periodMonth}-${sheet.periodYear}.pdf`);
});
