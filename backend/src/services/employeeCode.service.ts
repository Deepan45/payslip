import { prisma } from "../config/db";
import type { ParsedSalaryRow } from "./excelParser.service";

export interface RowNotice {
  rowNumber: number;
  message: string;
}

const slug = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sameText = (a?: string | null, b?: string | null) => (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();

/**
 * Fills in `employeeCode` for rows whose sheet code cell was blank, using the employee's name:
 *
 * 1. An existing employee with the same name (and F/H name, when both sides have one) → reuse
 *    their code, so a worker whose code was left out one month keeps a single history.
 * 2. No such employee → a code built from the name, "NC-<NAME>" (adding "-<F/H NAME>" if that
 *    code already belongs to a different person). It's deterministic, so the same name maps to the
 *    same employee again next month instead of creating a new one each upload.
 * 3. Several matches → ambiguous, so the row is skipped and reported.
 *
 * Returns the rows to import plus notices: `warnings` for codes filled in (the row is imported),
 * `errors` for rows skipped.
 */
export async function resolveMissingEmployeeCodes(
  rows: ParsedSalaryRow[]
): Promise<{ rows: ParsedSalaryRow[]; warnings: RowNotice[]; errors: RowNotice[] }> {
  const warnings: RowNotice[] = [];
  const errors: RowNotice[] = [];
  const usedCodes = new Set(rows.filter((r) => r.employeeCode).map((r) => r.employeeCode));
  const kept: ParsedSalaryRow[] = [];

  for (const row of rows) {
    if (row.employeeCode) {
      kept.push(row);
      continue;
    }

    const byName = await prisma.employee.findMany({
      where: { name: { equals: row.name, mode: "insensitive" } },
      select: { employeeCode: true, guardianName: true },
    });
    const matches = byName.filter((e) => !row.guardianName || !e.guardianName || sameText(e.guardianName, row.guardianName));

    let code: string;
    let how: string;
    if (matches.length > 1) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Employee Code is empty for ${row.name}, and ${matches.length} employees have that name (${matches
          .map((m) => m.employeeCode)
          .join(", ")}) — enter the right code in the sheet. Row skipped`,
      });
      continue;
    } else if (matches.length === 1) {
      code = matches[0].employeeCode;
      how = `matched to existing employee ${code} by name`;
    } else {
      code = `NC-${slug(row.name)}`;
      const holder = await prisma.employee.findUnique({ where: { employeeCode: code }, select: { guardianName: true } });
      if (holder && row.guardianName) code = `${code}-${slug(row.guardianName)}`;
      how = `new code ${code} created from the name`;
    }

    if (usedCodes.has(code)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Employee Code is empty for ${row.name}, and code ${code} is already used by another row in this sheet — enter a code. Row skipped`,
      });
      continue;
    }
    usedCodes.add(code);
    warnings.push({ rowNumber: row.rowNumber, message: `Employee Code was empty for ${row.name} — ${how}` });
    kept.push({ ...row, employeeCode: code });
  }

  return { rows: kept, warnings, errors };
}
