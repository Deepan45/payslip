import * as XLSX from "xlsx";

// The master salary-sheet template. Column headers here are the "clean"
// aliases that excelParser.service.ts recognizes directly (see
// HEADER_ALIASES) — keeping this in sync with that file is important.
const TEMPLATE_HEADERS = [
  "Employee Code",
  "Name",
  "Guardian Name",
  "Gender",
  "Designation",
  "Department",
  "Bank Account",
  "IFSC Code",
  "UAN No",
  "ESI No",
  "Paid Days",
  "OT Hours",
  "OT Amount",
  "Basic",
  "HRA",
  "Incentive",
  "Gross Earnings",
  "ESI",
  "EPF",
  "LWF",
  "Advance",
  "Dress Shoes",
  "Other Deduction",
  "Total Deduction",
  "Net Pay",
];

const SAMPLE_ROW = [
  "EMP001",
  "John Doe",
  "Richard Doe",
  "Male",
  "Machine Operator",
  "Production",
  "123456789012",
  "SBIN0000123",
  "100123456789",
  "1234567890",
  26,
  10,
  500,
  15000,
  1500,
  0,
  0, // Gross Earnings — leave blank/0 to auto-calculate from Basic+HRA+Incentive+OT Amount
  113,
  1980,
  33,
  0,
  0,
  0,
  0, // Total Deduction — leave blank/0 to auto-calculate from ESI+EPF+LWF+Advance+Dress Shoes+Other Deduction
  0, // Net Pay — leave blank/0 to auto-calculate as Gross Earnings - Total Deduction
];

/**
 * Builds the master salary-sheet Excel template as a Buffer, ready to
 * stream as a file download.
 */
export function buildSalarySheetTemplate(): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, SAMPLE_ROW]);
  worksheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 16 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Salary Sheet");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
