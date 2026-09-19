// One-time maintenance script: wipes all payroll/transactional data while
// keeping Company Settings, Clients (and their saved column mappings), and
// admin Users untouched. Meant to be run manually against a real database
// when you want to start payroll history over without losing client setup.
//
// Deletes: Employees, uploaded salary sheets, salary records, generated
// payslips, client bills, and the advance ledger — plus their files on disk
// (storage/payslips, storage/salary-sheets, storage/bills).
// Keeps: CompanySettings, Client, SiteColumnProfile, User (admin logins).
//
// Usage:
//   npm run reset-data          -- dry run, prints what would be deleted
//   npm run reset-data -- --yes -- actually deletes

import fs from "fs";
import path from "path";
import "./config/env"; // side-effect import: loads .env via dotenv before Prisma reads DATABASE_URL
import { prisma } from "./config/db";

const CONFIRMED = process.argv.includes("--yes");

const PAYSLIP_STORAGE_DIR = path.join(__dirname, "..", "storage", "payslips");
const SALARY_SHEET_STORAGE_DIR = path.join(__dirname, "..", "storage", "salary-sheets");
const BILL_STORAGE_DIR = path.join(__dirname, "..", "storage", "bills");

function clearDirContents(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (entry === ".gitkeep") continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

async function main() {
  const [employeeCount, sheetCount, recordCount, payslipCount, billCount, advanceCount] = await Promise.all([
    prisma.employee.count(),
    prisma.salarySheet.count(),
    prisma.salaryRecord.count(),
    prisma.payslip.count(),
    prisma.clientBill.count(),
    prisma.advanceEntry.count(),
  ]);
  const [clientCount, companyCount, userCount] = await Promise.all([
    prisma.client.count(),
    prisma.companySettings.count(),
    prisma.user.count(),
  ]);

  console.log("About to delete:");
  console.log(`  Employees:            ${employeeCount}`);
  console.log(`  Uploaded sheets:      ${sheetCount}`);
  console.log(`  Salary records:       ${recordCount}`);
  console.log(`  Payslips:             ${payslipCount}`);
  console.log(`  Client bills:         ${billCount}`);
  console.log(`  Advance ledger rows:  ${advanceCount}`);
  console.log("Kept untouched:");
  console.log(`  Clients:              ${clientCount}`);
  console.log(`  Company settings:     ${companyCount}`);
  console.log(`  Users (admin logins): ${userCount}`);
  console.log("");

  if (!CONFIRMED) {
    console.log("Dry run only — nothing was deleted. Re-run with --yes to actually delete:");
    console.log("  npm run reset-data -- --yes");
    return;
  }

  // AdvanceEntry has no cascade from SalaryRecord/Employee, so it must go
  // first or its FK blocks both of the deletes below.
  await prisma.advanceEntry.deleteMany({});

  // SalarySheet cascades to SalaryRecord (which cascades to Payslip) and to
  // ClientBill — one call clears all four tables.
  await prisma.salarySheet.deleteMany({});

  // Safe now that no SalaryRecord/AdvanceEntry references any employee.
  await prisma.employee.deleteMany({});

  clearDirContents(PAYSLIP_STORAGE_DIR);
  clearDirContents(SALARY_SHEET_STORAGE_DIR);
  clearDirContents(BILL_STORAGE_DIR);

  console.log("Done. Payroll data cleared; clients, company settings, and users were left as-is.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
