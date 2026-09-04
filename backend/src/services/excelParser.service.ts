import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Site Profile column mapping
//
// Real wage sheets from different client sites have genuinely different
// layouts: different header wording, different column order, and often a
// 2-row merged header block (a group label on one row, sub-labels on the
// next). Header *names* alone aren't reliable either — some sheets repeat
// the same label ("Basic") for two different columns with different
// meanings (e.g. full monthly entitlement vs. the actual prorated earning).
//
// So instead of guessing from header text on every upload, each Client gets
// a saved SiteColumnProfile: a positional mapping (column index -> field)
// built once via a mapping screen, with a header-text "fingerprint" per
// column so a later upload can detect if the layout drifted (columns
// inserted/reordered) and ask to re-map rather than silently reading the
// wrong column.
// ---------------------------------------------------------------------------

export type TextField =
  | "employeeCode"
  | "name"
  | "guardianName"
  | "gender"
  | "designation"
  | "department"
  | "bankAccount"
  | "ifscCode"
  | "uanNo"
  | "esiNo"
  | "email"
  | "phone";

export type NumericField =
  | "paidDays"
  | "otHours"
  | "otAmount"
  | "basic"
  | "hra"
  | "incentive"
  | "grossEarnings"
  | "esi"
  | "epf"
  | "lwf"
  | "advance"
  | "dressShoes"
  | "otherDeduction"
  | "totalDeductions"
  | "netPay";

export type CanonicalField = TextField | NumericField;

export const TEXT_FIELDS: TextField[] = [
  "employeeCode", "name", "guardianName", "gender", "designation", "department",
  "bankAccount", "ifscCode", "uanNo", "esiNo", "email", "phone",
];

export const NUMERIC_FIELDS: NumericField[] = [
  "paidDays", "otHours", "otAmount", "basic", "hra", "incentive", "grossEarnings",
  "esi", "epf", "lwf", "advance", "dressShoes", "otherDeduction", "totalDeductions", "netPay",
];

export const REQUIRED_FIELDS: CanonicalField[] = ["employeeCode", "name"];

export interface ColumnRef {
  index: number;
  fingerprint: string; // header text seen at this column, for drift detection
}

export interface ColumnMapping {
  headerRowStart: number; // 0-based, inclusive
  headerRowEnd: number; // 0-based, inclusive — usually headerRowStart or +1
  dataStartRow: number; // 0-based, first data row
  // Numeric fields may sum multiple source columns (e.g. Arrear + Sunday
  // Allowance both folded into "incentive"). Text fields use the first
  // non-empty candidate.
  columns: Partial<Record<CanonicalField, ColumnRef[]>>;
}

// Alias table used only for SUGGESTING a mapping (never for silently
// resolving one at parse time — that always uses the saved positional
// mapping). Matching is case-insensitive, alphanumeric-only.
const HEADER_ALIASES: Record<string, CanonicalField> = {
  employeeid: "employeeCode", empid: "employeeCode", employeecode: "employeeCode",
  empcode: "employeeCode", code: "employeeCode", tokenno: "employeeCode",

  name: "name", empname: "name", employeename: "name", nameofemployee: "name",

  guardianname: "guardianName", fathersname: "guardianName", gaurdianname: "guardianName",

  gender: "gender", genger: "gender",

  designation: "designation", rank: "designation", title: "designation",

  department: "department", dept: "department", plant: "department", site: "department",

  bankaccount: "bankAccount", bankaccountno: "bankAccount", bankac: "bankAccount",
  accountno: "bankAccount", accountn: "bankAccount", bankacno: "bankAccount",

  ifsccode: "ifscCode", ifsc: "ifscCode",

  uanno: "uanNo", uan: "uanNo",

  esino: "esiNo", esicno: "esiNo",

  email: "email", emailid: "email",
  phone: "phone", mobile: "phone", mobileno: "phone", contactno: "phone",

  paiddays: "paidDays", days: "paidDays", noofpaiddays: "paidDays",

  othours: "otHours", othrs: "otHours", actualot: "otHours", otamount: "otAmount",

  basic: "basic", basicsalary: "basic", basicpay: "basic",

  hra: "hra", houserentallowance: "hra",

  incentive: "incentive", incentiveamt: "incentive", goodworkaward: "incentive",
  goodworkpoints: "incentive", attendaward: "incentive", arrear: "incentive",

  gross: "grossEarnings", grosssalary: "grossEarnings", grossearnings: "grossEarnings",
  totalgross: "grossEarnings", salaryearning: "grossEarnings", earngross: "grossEarnings",

  esi: "esi", esic: "esi",
  epf: "epf", pf: "epf", pfwages: "epf", providentfund: "epf",
  lwf: "lwf",

  advance: "advance", adv: "advance", advded: "advance",

  dressshoes: "dressShoes", dressandshoes: "dressShoes",

  otherdeduction: "otherDeduction", otherdeductions: "otherDeduction",
  canteendeduction: "otherDeduction", food: "otherDeduction", lunch: "otherDeduction",

  totaldeduction: "totalDeductions", totaldeductions: "totalDeductions", tded: "totalDeductions",

  netpay: "netPay", netsalary: "netPay", npay: "netPay", netpayable: "netPay", takehome: "netPay",
};

function normalizeHeader(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Looks up a header's canonical field, falling back to stripping a trailing
 * digit run before retrying. Real sheets commonly suffix a rate onto the
 * label ("ESI @ 0.75%" -> "esi075", "EPF @ 12%" -> "epf12", "LWF @ 0.2%" ->
 * "lwf02") — none of which can be enumerated up front, since the rate
 * varies by sheet. An exact match always wins first, so this can't
 * misclassify a field like "ESI No" ("esino" has no trailing digit, so the
 * fallback never fires for it).
 */
function lookupAlias(text: string): CanonicalField | undefined {
  const norm = normalizeHeader(text);
  if (HEADER_ALIASES[norm]) return HEADER_ALIASES[norm];
  const stripped = norm.replace(/\d+$/, "");
  if (stripped !== norm && HEADER_ALIASES[stripped]) return HEADER_ALIASES[stripped];
  return undefined;
}

function cellText(row: unknown[] | undefined, index: number): string {
  if (!row) return "";
  const v = row[index];
  return v === undefined || v === null ? "" : String(v).trim();
}

/** Reads a workbook Buffer into a raw grid (array of rows of cells). */
export function readSheetGrid(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
}

function fingerprintAt(grid: unknown[][], headerRowStart: number, headerRowEnd: number, columnIndex: number): string {
  const parts: string[] = [];
  for (let r = headerRowStart; r <= headerRowEnd; r++) {
    const t = cellText(grid[r], columnIndex);
    if (t) parts.push(t);
  }
  return parts.join(" > ");
}

function maxColumnCount(grid: unknown[][], fromRow: number, sampleRows = 6): number {
  let max = 0;
  for (let r = fromRow; r < Math.min(grid.length, fromRow + sampleRows); r++) {
    max = Math.max(max, grid[r]?.length ?? 0);
  }
  return max;
}

/**
 * Scores how "header-like" a 2-row block starting at `startRow` looks, by
 * counting how many columns' text (in either row of the block) matches a
 * known alias.
 */
function scoreHeaderBlock(grid: unknown[][], startRow: number, cols: number): number {
  let score = 0;
  for (let c = 0; c < cols; c++) {
    const a = cellText(grid[startRow], c);
    const b = cellText(grid[startRow + 1], c);
    if ((a && lookupAlias(a)) || (b && lookupAlias(b))) score++;
  }
  return score;
}

export interface MappingSuggestion {
  headerRowStart: number;
  headerRowEnd: number;
  dataStartRow: number;
  columns: Partial<Record<CanonicalField, ColumnRef[]>>;
  /** All candidate columns per field, for the mapping screen to offer as alternatives. */
  candidates: Partial<Record<CanonicalField, ColumnRef[]>>;
  grid: unknown[][]; // first several rows, for the mapping screen to render
}

/**
 * Suggests a header row and a field->column mapping by scanning the first
 * few rows for the best-scoring header block, then matching each column's
 * header text (across that block) against known aliases. Never applied
 * automatically — always returned for a human to confirm via the mapping
 * screen.
 */
export function suggestColumnMapping(grid: unknown[][]): MappingSuggestion {
  const cols = maxColumnCount(grid, 0, Math.min(grid.length, 8));

  let bestRow = 0;
  let bestScore = -1;
  for (let r = 0; r < Math.min(grid.length - 1, 8); r++) {
    const score = scoreHeaderBlock(grid, r, cols);
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  const headerRowStart = bestRow;
  const headerRowEnd = Math.min(bestRow + 1, grid.length - 1);
  const dataStartRow = headerRowEnd + 1;

  const candidates: Partial<Record<CanonicalField, ColumnRef[]>> = {};
  for (let c = 0; c < cols; c++) {
    const rowsInBlock = [cellText(grid[headerRowStart], c), cellText(grid[headerRowEnd], c)];
    for (const text of rowsInBlock) {
      const field = lookupAlias(text);
      if (!field) continue;
      const fp = fingerprintAt(grid, headerRowStart, headerRowEnd, c);
      const list = (candidates[field] ??= []);
      if (!list.some((x) => x.index === c)) list.push({ index: c, fingerprint: fp });
    }
  }

  // Default selection: last candidate per field (in these real sheets, a
  // repeated label's later occurrence is consistently the "earned/actual"
  // figure, not the base entitlement) — shown pre-selected but always
  // overridable on the mapping screen.
  const columns: Partial<Record<CanonicalField, ColumnRef[]>> = {};
  for (const [field, list] of Object.entries(candidates) as [CanonicalField, ColumnRef[]][]) {
    columns[field] = [list[list.length - 1]];
  }

  return {
    headerRowStart,
    headerRowEnd,
    dataStartRow,
    columns,
    candidates,
    grid: grid.slice(0, Math.min(grid.length, 10)),
  };
}

/** Recomputes fingerprints for a saved mapping against a new grid and reports any drift. */
export function checkMappingDrift(grid: unknown[][], mapping: ColumnMapping): { ok: boolean; drifted: CanonicalField[] } {
  const drifted: CanonicalField[] = [];
  for (const [field, refs] of Object.entries(mapping.columns) as [CanonicalField, ColumnRef[]][]) {
    for (const ref of refs) {
      const current = fingerprintAt(grid, mapping.headerRowStart, mapping.headerRowEnd, ref.index);
      if (normalizeHeader(current) !== normalizeHeader(ref.fingerprint)) {
        drifted.push(field);
        break;
      }
    }
  }
  return { ok: drifted.length === 0, drifted };
}

function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export interface ParsedSalaryRow {
  employeeCode: string;
  name: string;
  guardianName?: string;
  gender?: string;
  designation?: string;
  department?: string;
  bankAccount?: string;
  ifscCode?: string;
  uanNo?: string;
  esiNo?: string;
  email?: string;
  phone?: string;
  paidDays: number;
  otHours: number;
  otAmount: number;
  basic: number;
  hra: number;
  incentive: number;
  grossEarnings: number;
  esi: number;
  epf: number;
  lwf: number;
  advance: number;
  dressShoes: number;
  otherDeduction: number;
  totalDeductions: number;
  netPay: number;
  extra: Record<string, unknown>;
  rowNumber: number;
}

export interface ParseResult {
  rows: ParsedSalaryRow[];
  errors: { rowNumber: number; message: string }[];
}

/** Parses a raw grid using a confirmed Site Column Profile mapping. */
export function parseWithMapping(grid: unknown[][], mapping: ColumnMapping): ParseResult {
  const rows: ParsedSalaryRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  const mappedIndexes = new Set<number>();
  for (const refs of Object.values(mapping.columns)) {
    for (const ref of refs ?? []) mappedIndexes.add(ref.index);
  }

  const textOf = (field: TextField, row: unknown[]): string | undefined => {
    for (const ref of mapping.columns[field] ?? []) {
      const t = cellText(row, ref.index);
      if (t) return t;
    }
    return undefined;
  };
  const numOf = (field: NumericField, row: unknown[]): number =>
    (mapping.columns[field] ?? []).reduce((sum, ref) => sum + toNumber(row[ref.index]), 0);
  const providedRaw = (field: NumericField, row: unknown[]): string => {
    for (const ref of mapping.columns[field] ?? []) {
      const t = cellText(row, ref.index);
      if (t) return t;
    }
    return "";
  };

  for (let r = mapping.dataStartRow; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const rowNumber = r + 1; // 1-indexed for user-facing messages

    const employeeCode = (textOf("employeeCode", row) ?? "").trim();
    const name = (textOf("name", row) ?? "").trim();
    if (!employeeCode || !name) {
      // Skip fully blank trailing rows silently; report genuinely partial rows.
      const hasAnyData = row.some((c) => String(c ?? "").trim() !== "");
      if (hasAnyData) {
        errors.push({ rowNumber, message: "Missing Employee Code or Name — row skipped" });
      }
      continue;
    }

    const basic = numOf("basic", row);
    const hra = numOf("hra", row);
    const incentive = numOf("incentive", row);
    const otAmount = numOf("otAmount", row);
    const esi = numOf("esi", row);
    const epf = numOf("epf", row);
    const lwf = numOf("lwf", row);
    const advance = numOf("advance", row);
    const dressShoes = numOf("dressShoes", row);
    const otherDeduction = numOf("otherDeduction", row);

    const computedGross = basic + hra + incentive + otAmount;
    const computedDeductions = esi + epf + lwf + advance + dressShoes + otherDeduction;
    const grossEarnings = providedRaw("grossEarnings", row) !== "" ? numOf("grossEarnings", row) : computedGross;
    const totalDeductions =
      providedRaw("totalDeductions", row) !== "" ? numOf("totalDeductions", row) : computedDeductions;
    const netPay = providedRaw("netPay", row) !== "" ? numOf("netPay", row) : grossEarnings - totalDeductions;

    const extra: Record<string, unknown> = {};
    row.forEach((value, idx) => {
      if (mappedIndexes.has(idx)) return;
      const text = String(value ?? "").trim();
      if (!text) return;
      const header = fingerprintAt(grid, mapping.headerRowStart, mapping.headerRowEnd, idx) || `col${idx}`;
      extra[header] = value;
    });

    rows.push({
      employeeCode,
      name,
      guardianName: textOf("guardianName", row),
      gender: textOf("gender", row),
      designation: textOf("designation", row),
      department: textOf("department", row),
      bankAccount: textOf("bankAccount", row),
      ifscCode: textOf("ifscCode", row),
      uanNo: textOf("uanNo", row),
      esiNo: textOf("esiNo", row),
      email: textOf("email", row),
      phone: textOf("phone", row),
      paidDays: numOf("paidDays", row),
      otHours: numOf("otHours", row),
      otAmount,
      basic,
      hra,
      incentive,
      grossEarnings,
      esi,
      epf,
      lwf,
      advance,
      dressShoes,
      otherDeduction,
      totalDeductions,
      netPay,
      extra,
      rowNumber,
    });
  }

  return { rows, errors };
}
