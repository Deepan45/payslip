import { Response } from "express";
import path from "path";
import fs from "fs";
import { prisma } from "../config/db";
import { AuthedRequest } from "../middleware/auth";
import {
  readSheetGrid,
  readSheetMerges,
  suggestColumnMapping,
  checkMappingDrift,
  parseWithMapping,
  ColumnMapping,
} from "../services/excelParser.service";
import { generatePayslipPdf, generateClientBillPdf } from "../services/pdf.service";
import { buildSalarySheetTemplate } from "../services/template.service";
import { computeClientBillForSheet } from "../services/bill.service";
import { pfWageForRow } from "../services/statutory.service";
import { Prisma } from "@prisma/client";
import { mapWithConcurrency } from "../utils/concurrency";

// How many rows to process in parallel against the database during upload.
// The DB is remote, so per-row latency dominates a sequential loop —
// running rows concurrently hides most of that latency. High enough to
// matter for large sheets (some real sheets run 1000+ rows), low enough
// not to overwhelm the connection pool.
const UPLOAD_CONCURRENCY = 20;

const PAYSLIP_STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "payslips");
const LOGO_DIR = path.join(__dirname, "..", "..", "storage", "logo");
const SALARY_SHEET_STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "salary-sheets");
const BILL_STORAGE_DIR = path.join(__dirname, "..", "..", "storage", "bills");

// CompanySettings.logoPath was historically stored as the full absolute path
// returned by multer at upload time (see company.routes.ts) — which bakes in
// whatever environment wrote it (e.g. a container's "/app/storage/logo/...").
// Read back through a *different* environment (a local dev box against the
// same shared DB, a restored backup, etc.), that path doesn't exist on disk
// and the logo silently disappears from every payslip. Resolve by filename
// against this environment's own LOGO_DIR instead, so only the file itself
// needs to exist locally — not the exact path it was uploaded from.
function resolveLogoPath(storedPath: string | null | undefined): string | undefined {
  if (!storedPath) return undefined;
  return path.join(LOGO_DIR, path.basename(storedPath));
}

export function downloadSalarySheetTemplate(_req: AuthedRequest, res: Response) {
  const buffer = buildSalarySheetTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="Salary-Sheet-Template.xlsx"');
  res.send(buffer);
}

/**
 * Step 1 of upload: read the file and report whether the client's saved
 * column mapping still applies, or whether a (re-)mapping is needed. Never
 * writes anything — purely diagnostic, so the frontend can show a mapping
 * screen only when actually necessary.
 */
export async function analyzeSalarySheet(req: AuthedRequest, res: Response) {
  const file = req.file;
  const { clientId, forceRemap } = req.body as { clientId?: string; forceRemap?: string };
  if (!file) return res.status(400).json({ error: "No file uploaded. Attach an Excel file as 'file'." });
  if (!clientId) return res.status(400).json({ error: "clientId is required" });

  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { columnProfile: true } });
  if (!client) return res.status(404).json({ error: "Client not found" });

  const grid = readSheetGrid(file.buffer);
  if (grid.length === 0) return res.status(400).json({ error: "Workbook has no sheets or is empty" });
  const merges = readSheetMerges(file.buffer);

  const preview = grid.slice(0, 10);

  if (client.columnProfile) {
    const mapping = client.columnProfile.mapping as unknown as ColumnMapping;
    const drift = checkMappingDrift(grid, mapping);
    if (drift.ok && forceRemap !== "true") {
      return res.json({ status: "ready", mapping, preview });
    }
    // A voluntary re-map (no header drift, just requested) starts from a
    // fresh suggestion — so a canonical field added to the system after
    // this client was mapped (e.g. pfSalaryAmt) shows up for review — then
    // lets the client's already-confirmed mapping win for every field it
    // already covers, so a manually added extra source column isn't lost
    // just because the auto-suggester wouldn't have found it on its own.
    const suggestion = suggestColumnMapping(grid, merges);
    if (drift.ok) {
      suggestion.headerRowStart = mapping.headerRowStart;
      suggestion.headerRowEnd = mapping.headerRowEnd;
      suggestion.dataStartRow = mapping.dataStartRow;
      suggestion.columns = { ...suggestion.columns, ...mapping.columns };
      return res.json({ status: "needs_mapping", suggestion, preview });
    }
    return res.json({ status: "drift", drifted: drift.drifted, previousMapping: mapping, suggestion, preview });
  }

  const suggestion = suggestColumnMapping(grid, merges);
  return res.json({ status: "needs_mapping", suggestion, preview });
}

export async function uploadSalarySheet(req: AuthedRequest, res: Response) {
  const file = req.file;
  const { periodMonth, periodYear, clientId, mapping: mappingRaw, saveMapping } = req.body as {
    periodMonth?: string;
    periodYear?: string;
    clientId?: string;
    mapping?: string;
    saveMapping?: string;
  };

  if (!file) return res.status(400).json({ error: "No file uploaded. Attach an Excel file as 'file'." });
  if (!clientId) return res.status(400).json({ error: "clientId is required" });

  const month = parseInt(periodMonth ?? "", 10);
  const year = parseInt(periodYear ?? "", 10);
  if (!month || month < 1 || month > 12 || !year || year < 2000) {
    return res.status(400).json({ error: "Valid periodMonth (1-12) and periodYear are required." });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { columnProfile: true } });
  if (!client) return res.status(404).json({ error: "Client not found" });

  let mapping: ColumnMapping;
  if (mappingRaw) {
    try {
      mapping = JSON.parse(mappingRaw);
    } catch {
      return res.status(400).json({ error: "mapping must be valid JSON" });
    }
    if (saveMapping !== "0") {
      await prisma.siteColumnProfile.upsert({
        where: { clientId },
        create: { clientId, headerRow: mapping.headerRowStart, mapping: mapping as unknown as Prisma.InputJsonValue },
        update: { headerRow: mapping.headerRowStart, mapping: mapping as unknown as Prisma.InputJsonValue },
      });
    }
  } else if (client.columnProfile) {
    mapping = client.columnProfile.mapping as unknown as ColumnMapping;
  } else {
    return res.status(400).json({
      error: "No column mapping configured for this client yet. Call /api/uploads/analyze first and confirm a mapping.",
    });
  }

  const grid = readSheetGrid(file.buffer);
  const { rows, errors } = parseWithMapping(grid, mapping);
  if (rows.length === 0) {
    return res.status(400).json({ error: "No valid rows found in the sheet.", rowErrors: errors });
  }

  const company = await prisma.companySettings.findFirst();

  const sheet = await prisma.salarySheet.create({
    data: {
      clientId,
      fileName: file.originalname,
      periodMonth: month,
      periodYear: year,
      recordCount: rows.length,
    },
  });

  // Keep the originally uploaded workbook on disk (per sheet, in its own subfolder) so it can be
  // re-downloaded later from History — best-effort: a failure here shouldn't fail the whole upload,
  // since the parsed data and payslips are already what actually matters.
  try {
    const safeFileName = path.basename(file.originalname).replace(/[^\w.\- ]/g, "_") || "salary-sheet.xlsx";
    const sheetFileDir = path.join(SALARY_SHEET_STORAGE_DIR, sheet.id);
    fs.mkdirSync(sheetFileDir, { recursive: true });
    fs.writeFileSync(path.join(sheetFileDir, safeFileName), file.buffer);
    await prisma.salarySheet.update({ where: { id: sheet.id }, data: { filePath: safeFileName } });
  } catch (err) {
    console.error("Failed to persist original salary sheet file:", err);
  }

  const generated: { employeeCode: string; name: string; payslipId: string }[] = [];
  const generationErrors: { employeeCode: string; message: string }[] = [];

  await mapWithConcurrency(rows, UPLOAD_CONCURRENCY, async (row) => {
    try {
      const employee = await prisma.employee.upsert({
        where: { employeeCode: row.employeeCode },
        update: {
          name: row.name,
          guardianName: row.guardianName,
          gender: row.gender,
          designation: row.designation,
          department: row.department,
          bankAccount: row.bankAccount,
          ifscCode: row.ifscCode,
          uanNo: row.uanNo,
          esiNo: row.esiNo,
          email: row.email,
          phone: row.phone,
          currentClientId: clientId,
        },
        create: {
          employeeCode: row.employeeCode,
          name: row.name,
          guardianName: row.guardianName,
          gender: row.gender,
          designation: row.designation,
          department: row.department,
          bankAccount: row.bankAccount,
          ifscCode: row.ifscCode,
          uanNo: row.uanNo,
          esiNo: row.esiNo,
          email: row.email,
          phone: row.phone,
          currentClientId: clientId,
        },
      });

      const salaryRecord = await prisma.salaryRecord.create({
        data: {
          sheetId: sheet.id,
          employeeId: employee.id,
          paidDays: row.paidDays,
          otHours: row.otHours,
          otAmount: row.otAmount,
          basic: row.basic,
          monthlySalary: row.monthlySalary,
          hra: row.hra,
          monthlyHra: row.monthlyHra,
          incentive: row.incentive,
          otherEarnings: row.otherEarnings.length > 0 ? (row.otherEarnings as unknown as Prisma.InputJsonValue) : undefined,
          grossEarnings: row.grossEarnings,
          // Sheets with no PF wage column mapped come through as 0 even though EPF was deducted —
          // store the derived wage so PF filings and client bills see it instead of a 0 base.
          pfSalaryAmt: company ? pfWageForRow(row, company) : row.pfSalaryAmt,
          esi: row.esi,
          epf: row.epf,
          lwf: row.lwf,
          advance: row.advance,
          dressShoes: row.dressShoes,
          otherDeduction: row.otherDeduction,
          totalDeductions: row.totalDeductions,
          netPay: row.netPay,
          extra: Object.keys(row.extra).length > 0 ? (row.extra as Prisma.InputJsonValue) : undefined,
        },
      });

      if (row.advance > 0) {
        await prisma.advanceEntry.create({
          data: {
            employeeId: employee.id,
            type: "RECOVERED",
            amount: row.advance,
            salaryRecordId: salaryRecord.id,
            note: `Recovered via ${month}/${year} payslip`,
          },
        });
      }

      const pdfFileName = `${employee.employeeCode}.pdf`;
      const pdfOutputPath = path.join(PAYSLIP_STORAGE_DIR, sheet.id, pdfFileName);

      await generatePayslipPdf(
        {
          company: {
            name: company?.name ?? "Your Company",
            address: company?.address,
            logoPath: resolveLogoPath(company?.logoPath),
            mobile: company?.mobile,
            officePhone: company?.officePhone,
            email: company?.email,
            website: company?.website,
          },
          client: { name: client.name },
          employee: {
            employeeCode: employee.employeeCode,
            name: employee.name,
            guardianName: employee.guardianName,
            designation: employee.designation,
            department: employee.department,
            bankAccount: employee.bankAccount,
            ifscCode: employee.ifscCode,
            uanNo: employee.uanNo,
            esiNo: employee.esiNo,
          },
          period: { month, year },
          attendance: { paidDays: row.paidDays, otHours: row.otHours, otAmount: row.otAmount },
          earnings: {
            basic: row.basic,
            monthlySalary: row.monthlySalary,
            hra: row.hra,
            monthlyHra: row.monthlyHra,
            otAmount: row.otAmount,
            otherEarnings: row.otherEarnings,
            grossEarnings: row.grossEarnings,
          },
          deductions: {
            esi: row.esi,
            epf: row.epf,
            lwf: row.lwf,
            advance: row.advance,
            dressShoes: row.dressShoes,
            otherDeduction: row.otherDeduction,
            totalDeductions: row.totalDeductions,
          },
          netPay: row.netPay,
        },
        pdfOutputPath
      );

      const payslip = await prisma.payslip.create({
        data: { salaryRecordId: salaryRecord.id, pdfPath: pdfOutputPath },
      });

      generated.push({ employeeCode: employee.employeeCode, name: employee.name, payslipId: payslip.id });
    } catch (err) {
      generationErrors.push({
        employeeCode: row.employeeCode,
        message: err instanceof Error ? err.message : "Unknown error generating payslip",
      });
    }
  });

  // Client bill: computed from the SalaryRecords just written, then persisted as a PDF alongside
  // the payslips — best-effort, same stance as the original-workbook save above, since the
  // payslips already generated are what actually matters if this fails.
  let bill: { id: string; grandTotal: number; employeeCount: number; serviceCharge: number; billingRateUsed: number | null } | null = null;
  try {
    const computed = await computeClientBillForSheet(sheet.id);
    if (computed) {
      const billNo = `BILL-${year}${String(month).padStart(2, "0")}-${sheet.id.slice(-8).toUpperCase()}`;
      const pdfOutputPath = path.join(BILL_STORAGE_DIR, sheet.id, "bill.pdf");
      await generateClientBillPdf(
        {
          company: {
            name: company?.name ?? "Your Company",
            address: company?.address,
            logoPath: resolveLogoPath(company?.logoPath),
            mobile: company?.mobile,
            officePhone: company?.officePhone,
            email: company?.email,
            website: company?.website,
            gstin: company?.gstin,
            bankName: company?.bankName,
            bankAccountNo: company?.bankAccountNo,
            bankIfscCode: company?.bankIfscCode,
            billingTerms: company?.billingTerms,
          },
          client: { name: client.name, address: client.address },
          period: { month, year },
          billNo,
          lines: computed.lines,
          totals: computed.totals,
        },
        pdfOutputPath
      );
      const created = await prisma.clientBill.create({
        data: {
          sheetId: sheet.id,
          clientId,
          periodMonth: month,
          periodYear: year,
          employeeCount: computed.totals.employeeCount,
          totalGrossWages: computed.totals.totalGrossWages,
          totalEmployerEpf: computed.totals.totalEmployerEpf,
          totalEmployerEsi: computed.totals.totalEmployerEsi,
          totalEmployerLwf: computed.totals.totalEmployerLwf,
          pfAdminCharge: computed.totals.pfAdminCharge,
          billingRateUsed: computed.totals.billingRateUsed,
          serviceCharge: computed.totals.serviceCharge,
          totalWageCost: computed.totals.totalWageCost,
          grandTotal: computed.totals.grandTotal,
          lines: computed.lines as unknown as Prisma.InputJsonValue,
          pdfPath: pdfOutputPath,
        },
      });
      bill = {
        id: created.id,
        grandTotal: created.grandTotal,
        employeeCount: created.employeeCount,
        serviceCharge: created.serviceCharge,
        billingRateUsed: created.billingRateUsed,
      };
    }
  } catch (err) {
    console.error("Failed to generate client bill for sheet", sheet.id, err);
  }

  res.status(201).json({
    sheet: { id: sheet.id, fileName: sheet.fileName, periodMonth: month, periodYear: year },
    generatedCount: generated.length,
    rowErrors: errors,
    generationErrors,
    generated,
    bill,
  });
}
