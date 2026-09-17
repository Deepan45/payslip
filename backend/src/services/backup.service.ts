import archiver from "archiver";
import fs from "fs";
import path from "path";
import { Response } from "express";
import { prisma } from "../config/db";

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");

/**
 * Full application backup: every table's rows as one JSON file, plus the
 * entire storage/ directory (logos, payslip/salary-sheet/bill PDFs) so the
 * archive is enough on its own to restore the system.
 */
export async function streamBackup(res: Response): Promise<void> {
  const [
    users,
    companySettings,
    clients,
    siteColumnProfiles,
    employees,
    salarySheets,
    clientBills,
    salaryRecords,
    payslips,
    advanceEntries,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.companySettings.findMany(),
    prisma.client.findMany(),
    prisma.siteColumnProfile.findMany(),
    prisma.employee.findMany(),
    prisma.salarySheet.findMany(),
    prisma.clientBill.findMany(),
    prisma.salaryRecord.findMany(),
    prisma.payslip.findMany(),
    prisma.advanceEntry.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    tables: {
      users,
      companySettings,
      clients,
      siteColumnProfiles,
      employees,
      salarySheets,
      clientBills,
      salaryRecords,
      payslips,
      advanceEntries,
    },
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipFileName = `payslip-backup-${timestamp}.zip`;

  return new Promise((resolve, reject) => {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      reject(err);
      res.status(500).end();
    });
    archive.on("end", () => resolve());

    archive.pipe(res);
    archive.append(JSON.stringify(backup, null, 2), { name: "database.json" });
    if (fs.existsSync(STORAGE_DIR)) {
      archive.directory(STORAGE_DIR, "files");
    }
    archive.finalize();
  });
}
