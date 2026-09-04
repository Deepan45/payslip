export const TEXT_FIELDS = [
  "employeeCode", "name", "guardianName", "gender", "designation", "department",
  "bankAccount", "ifscCode", "uanNo", "esiNo", "email", "phone",
] as const;

export const NUMERIC_FIELDS = [
  "paidDays", "otHours", "otAmount", "basic", "hra", "incentive", "grossEarnings",
  "esi", "epf", "lwf", "advance", "dressShoes", "otherDeduction", "totalDeductions", "netPay",
] as const;

export type TextField = (typeof TEXT_FIELDS)[number];
export type NumericField = (typeof NUMERIC_FIELDS)[number];
export type CanonicalField = TextField | NumericField;

export const FIELD_LABELS: Record<CanonicalField, string> = {
  employeeCode: "Employee Code *",
  name: "Name *",
  guardianName: "Guardian's Name",
  gender: "Gender",
  designation: "Designation",
  department: "Department / Site",
  bankAccount: "Bank Account No",
  ifscCode: "IFSC Code",
  uanNo: "UAN No",
  esiNo: "ESI No",
  email: "Email",
  phone: "Phone",
  paidDays: "Paid Days",
  otHours: "OT Hours",
  otAmount: "OT Amount",
  basic: "Basic",
  hra: "HRA",
  incentive: "Incentive / Other Earnings",
  grossEarnings: "Gross Earnings (optional — auto-computed if unmapped)",
  esi: "ESI",
  epf: "EPF",
  lwf: "LWF",
  advance: "Advance",
  dressShoes: "Dress & Shoes",
  otherDeduction: "Other Deduction",
  totalDeductions: "Total Deductions (optional — auto-computed if unmapped)",
  netPay: "Net Pay (optional — auto-computed if unmapped)",
};

export const FIELD_GROUPS: { title: string; fields: CanonicalField[] }[] = [
  { title: "Identity", fields: ["employeeCode", "name", "guardianName", "gender", "designation", "department"] },
  { title: "Bank & Statutory IDs", fields: ["bankAccount", "ifscCode", "uanNo", "esiNo", "email", "phone"] },
  { title: "Attendance", fields: ["paidDays", "otHours", "otAmount"] },
  { title: "Earnings", fields: ["basic", "hra", "incentive", "grossEarnings"] },
  { title: "Deductions", fields: ["esi", "epf", "lwf", "advance", "dressShoes", "otherDeduction", "totalDeductions"] },
  { title: "Result", fields: ["netPay"] },
];

export interface ColumnRef {
  index: number;
  fingerprint: string;
}

export interface ColumnMapping {
  headerRowStart: number;
  headerRowEnd: number;
  dataStartRow: number;
  columns: Partial<Record<CanonicalField, ColumnRef[]>>;
}

export interface MappingSuggestion extends ColumnMapping {
  candidates: Partial<Record<CanonicalField, ColumnRef[]>>;
  grid: unknown[][];
}

export type AnalyzeResponse =
  | { status: "ready"; mapping: ColumnMapping; preview: unknown[][] }
  | { status: "needs_mapping"; suggestion: MappingSuggestion; preview: unknown[][] }
  | { status: "drift"; drifted: CanonicalField[]; previousMapping: ColumnMapping; suggestion: MappingSuggestion; preview: unknown[][] };

/**
 * Raw fingerprint for a column — must exactly match the backend's
 * `fingerprintAt` (simple concatenation of the header-row cells, no
 * lookback). This is what gets sent back as each column's stored
 * fingerprint; drift detection recomputes it the same way on a later
 * upload, so any mismatch here would show up as permanent false-positive
 * drift. Use `columnLabel` (below) for anything shown to the user instead.
 */
export function rawFingerprint(grid: unknown[][], headerRowStart: number, headerRowEnd: number, index: number): string {
  const parts: string[] = [];
  for (let r = headerRowStart; r <= headerRowEnd; r++) {
    const t = String(grid[r]?.[index] ?? "").trim();
    if (t) parts.push(t);
  }
  return parts.join(" > ");
}

/** Derives a human-readable label for a column from the raw grid, looking back for a merged group label when the cell at this column is blank. */
export function columnLabel(grid: unknown[][], headerRowStart: number, headerRowEnd: number, index: number): string {
  const cell = (r: number, c: number) => String(grid[r]?.[c] ?? "").trim();

  const top = cell(headerRowStart, index);
  const sub = headerRowEnd !== headerRowStart ? cell(headerRowEnd, index) : "";

  let group = "";
  if (!top) {
    for (let c = index - 1; c >= 0; c--) {
      const t = cell(headerRowStart, c);
      if (t) {
        group = t;
        break;
      }
    }
  }

  const parts = [group, top, sub].filter(Boolean);
  return parts.length > 0 ? parts.join(" > ") : `Column ${index + 1}`;
}
