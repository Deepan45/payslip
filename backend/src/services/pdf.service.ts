import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Brand palette — exact colors sampled from the Himalayan logo (navy
// wordmark, orange/red flame), not approximated.
const NAVY = "#1b1c48";
const NAVY_MUTED = "#4d4e77";
const LIGHT_FILL = "#eef1f8";
const LIGHT_FILL_STRONG = "#dde3f3";
const FLAME_ORANGE = "#ffa801";
const FLAME_RED = "#fe340c";
const GRAY = "#6b7280";
const WHITE = "#ffffff";

const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const MID_GAP = 14;
const COL_WIDTH = (PAGE_WIDTH - MID_GAP) / 2;
const RIGHT_COL_X = PAGE_LEFT + COL_WIDTH + MID_GAP;

// Where the header's right-hand "PAYSLIP" block starts. Tied to one number
// (rather than sizing the company-info block and the PAYSLIP block from two
// unrelated constants) so the two are always flush against each other with
// a fixed gutter, instead of leaving a leftover gap between wherever the
// company text happens to wrap and wherever the PAYSLIP box was hardcoded
// to start. 355pt leaves ~190pt on the right — enough for "For the Month
// of September 2026" (the longest realistic date line) on one line.
const HEADER_SPLIT_X = PAGE_LEFT + 305;
const HEADER_GUTTER = 14;

// The company's authorized-signatory stamp — a fixed asset (not per-company
// configurable like the logo, since this system currently serves one
// company) stamped on every payslip's footer.
const SIGNATURE_PATH = path.join(__dirname, "..", "..", "storage", "signature", "authorized-signatory.jpeg");
const SIGNATURE_SIZE = 52;

export interface PayslipPdfData {
  company: {
    name: string;
    address?: string | null;
    logoPath?: string | null;
    mobile?: string | null;
    officePhone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  client: { name: string };
  employee: {
    employeeCode: string;
    name: string;
    guardianName?: string | null;
    designation?: string | null;
    department?: string | null;
    bankAccount?: string | null;
    ifscCode?: string | null;
    uanNo?: string | null;
    esiNo?: string | null;
  };
  period: { month: number; year: number };
  attendance: { paidDays: number; otHours: number; otAmount: number };
  earnings: {
    basic: number;
    /** Full monthly entitlement, unprorated — reference only (shown in Payslip Details, next to
     *  Rate of Pay); never summed into Gross Earnings / Net Pay, unlike `basic`. */
    monthlySalary: number;
    hra: number;
    /** Full monthly HRA entitlement, unprorated — reference only, mirrors monthlySalary above. */
    monthlyHra: number;
    otAmount: number;
    /** Other-earning source columns (Arrear, Conveyance, ...), each shown as its own line
     *  instead of one combined "Incentive / Other Earnings" total. */
    otherEarnings: { label: string; amount: number }[];
    grossEarnings: number;
  };
  deductions: {
    esi: number;
    epf: number;
    lwf: number;
    advance: number;
    dressShoes: number;
    otherDeduction: number;
    totalDeductions: number;
  };
  netPay: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}
function threeDigitWords(n: number): string {
  if (n < 100) return twoDigitWords(n);
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigitWords(n % 100) : "");
}

/** Converts a non-negative rupee amount to words using the Indian numbering system (lakh/crore). */
function amountInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;
  if (crore) parts.push(threeDigitWords(crore) + " Crore");
  if (lakh) parts.push(twoDigitWords(lakh) + " Lakh");
  if (thousand) parts.push(twoDigitWords(thousand) + " Thousand");
  if (hundred) parts.push(threeDigitWords(hundred));
  return `${parts.join(" ")} Rupees Only`;
}

/**
 * Renders a single professional-looking payslip PDF to `outputPath`.
 * Resolves once the file has been fully written to disk.
 */
export function generatePayslipPdf(data: PayslipPdfData, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // === Header: logo + company block (left), PAYSLIP + period (right) ===
    const headerTop = doc.y;
    let logoDrawn = false;
    const LOGO_SIZE = 90;
    if (data.company.logoPath && fs.existsSync(data.company.logoPath)) {
      try {
        doc.image(data.company.logoPath, PAGE_LEFT, headerTop, { width: LOGO_SIZE, height: LOGO_SIZE, fit: [LOGO_SIZE, LOGO_SIZE] });
        logoDrawn = true;
      } catch {
        // Ignore unreadable/unsupported logo files rather than failing generation.
      }
    }

    const textX = logoDrawn ? PAGE_LEFT + LOGO_SIZE + 14 : PAGE_LEFT;
    const textW = HEADER_SPLIT_X - HEADER_GUTTER - textX;
    let ly = headerTop;
    doc.font("Helvetica-Bold").fontSize(17).fillColor(NAVY).text(data.company.name, textX, ly, { width: textW });
    ly = doc.y + 2;

    doc.font("Helvetica").fontSize(8).fillColor(GRAY);
    if (data.company.address) {
      doc.text(data.company.address, textX, ly, { width: textW });
      ly = doc.y + 1;
    }
    const contactLine1 = [data.company.mobile, data.company.officePhone].filter(Boolean).join("   |   ");
    if (contactLine1) {
      doc.text(contactLine1, textX, ly, { width: textW });
      ly = doc.y + 1;
    }
    const contactLine2 = [data.company.email, data.company.website].filter(Boolean).join("   |   ");
    if (contactLine2) {
      doc.text(contactLine2, textX, ly, { width: textW });
      ly = doc.y + 1;
    }

    const headerRightW = PAGE_RIGHT - HEADER_SPLIT_X;
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor(NAVY)
      .text("PAYSLIP", HEADER_SPLIT_X, headerTop, { width: headerRightW, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(NAVY_MUTED)
      .text(
        `For the Month of ${MONTH_NAMES[data.period.month - 1] ?? data.period.month} ${data.period.year}`,
        HEADER_SPLIT_X,
        doc.y + 2,
        { width: headerRightW, align: "right" }
      );
    doc.fillColor("black");

    const headerBottom = Math.max(ly, doc.y, headerTop + LOGO_SIZE) + 8;

    // Brand accent bar — flame-orange gradient, the one spot of strong
    // color on an otherwise monochrome page (keeps bulk printing cheap).
    const gradient = doc.linearGradient(PAGE_LEFT, headerBottom, PAGE_RIGHT, headerBottom);
    gradient.stop(0, NAVY).stop(0.75, NAVY).stop(0.75, FLAME_ORANGE).stop(1, FLAME_RED);
    doc.rect(PAGE_LEFT, headerBottom, PAGE_WIDTH, 3).fill(gradient);
    doc.y = headerBottom + 16;

    // === Employee Details (left) / Payslip Details + Gross callout (right) ===
    function detailsBox(x: number, w: number, title: string, rows: [string, string][]) {
      const boxTop = doc.y;
      const barH = 18;
      doc.rect(x, boxTop, w, barH).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE).text(title, x + 8, boxTop + 5);

      const rowH = 16;
      const bodyH = rows.length * rowH + 8;
      doc.rect(x, boxTop + barH, w, bodyH).fill(LIGHT_FILL);

      const labelW = 92;
      rows.forEach(([label, value], i) => {
        const ry = boxTop + barH + 6 + i * rowH;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(NAVY_MUTED).text(label, x + 8, ry, { width: labelW });
        doc.font("Helvetica").fillColor("black").text(value || "-", x + 8 + labelW, ry, { width: w - labelW - 16 });
      });

      return boxTop + barH + bodyH;
    }

    const employeeRows: [string, string][] = [
      ["Employee Name", data.employee.name],
      ["Employee Code", data.employee.employeeCode],
      ["Guardian's Name", data.employee.guardianName ?? "-"],
      ["Designation", data.employee.designation ?? "-"],
      ["Department", data.employee.department ?? "-"],
      ["Bank A/c No.", data.employee.bankAccount ?? "-"],
      ["IFSC Code", data.employee.ifscCode ?? "-"],
      ["UAN No.", data.employee.uanNo ?? "-"],
      ["ESI No.", data.employee.esiNo ?? "-"],
    ];

    const payslipNo = `PS-${data.period.year}${String(data.period.month).padStart(2, "0")}-${data.employee.employeeCode}`;
    const payslipRows: [string, string][] = [
      ["Payslip No.", payslipNo],
      ["Pay Period", `${MONTH_NAMES[data.period.month - 1]} ${data.period.year}`],
      ["Deployed At", data.client.name],
      ["Paid Days", `${data.attendance.paidDays}`],
      ["OT Hours", `${data.attendance.otHours}`],
    ];

    const detailsTop = doc.y;
    const leftBottom = detailsBox(PAGE_LEFT, COL_WIDTH, "EMPLOYEE DETAILS", employeeRows);

    doc.y = detailsTop;
    const payslipBottom = detailsBox(RIGHT_COL_X, COL_WIDTH, "PAYSLIP DETAILS", payslipRows);

    doc.y = Math.max(leftBottom, payslipBottom) + 18;

    // === Earnings / Deductions table ===
    // Earnings carry both a Rate of Pay and a Payable amount per line, shown as two columns
    // (matching the client's paper payslip format). Basic and HRA each have a distinct rate —
    // data.earnings.monthlySalary / monthlyHra are their full monthly entitlement, unprorated,
    // while data.earnings.basic / hra are what's actually payable for Paid Days and what feeds
    // Total Earnings (A) / Gross Earnings / Net Pay. Every other line (OT, other earnings) has
    // only a payable amount, so its Rate of Pay cell is left blank. A rate is omitted (rather
    // than shown as 0.00) when this client's sheet doesn't have that Rate column mapped yet.
    const earningsRows: { label: string; rate?: number; payable: number }[] = [
      { label: "Basic", rate: data.earnings.monthlySalary > 0 ? data.earnings.monthlySalary : undefined, payable: data.earnings.basic },
      { label: "House Rent Allowance (HRA)", rate: data.earnings.monthlyHra > 0 ? data.earnings.monthlyHra : undefined, payable: data.earnings.hra },
      { label: "OT Amount", payable: data.earnings.otAmount },
      ...data.earnings.otherEarnings.map(({ label, amount }) => ({ label, payable: amount })),
    ];
    const deductionRows: [string, number][] = [
      ["ESI", data.deductions.esi],
      ["Provident Fund (EPF)", data.deductions.epf],
      ["Labour Welfare Fund (LWF)", data.deductions.lwf],
      ["Advance", data.deductions.advance],
      ["Dress & Shoes", data.deductions.dressShoes],
      ["Other Deduction", data.deductions.otherDeduction],
    ];
    const lineRows = Math.max(earningsRows.length, deductionRows.length);

    const tableTop = doc.y;
    const tableHeaderH = 20;
    const tableRowH = 17;
    const totalsRowH = 20;

    const amtColW = 78;
    const dedLabelX = RIGHT_COL_X + 8;
    const dedAmtX = RIGHT_COL_X + COL_WIDTH - amtColW;

    // Earnings side splits its amount column in two — Rate and Payable — so narrower than the
    // deductions side's single amount column.
    const earnLabelX = PAGE_LEFT + 8;
    const rateColW = 46;
    const payableColW = 50;
    const earnPayableX = PAGE_LEFT + COL_WIDTH - payableColW;
    const earnRateX = earnPayableX - 4 - rateColW;
    const earnLabelW = earnRateX - earnLabelX - 4;

    doc.rect(PAGE_LEFT, tableTop, COL_WIDTH, tableHeaderH).fill(NAVY);
    doc.rect(RIGHT_COL_X, tableTop, COL_WIDTH, tableHeaderH).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE);
    doc.text("EARNINGS", earnLabelX, tableTop + 6);
    doc.font("Helvetica-Bold").fontSize(8);
    doc.text("Rate of Pay", earnRateX, tableTop + 6, { width: rateColW, align: "right" });
    doc.text("Payable", earnPayableX, tableTop + 6, { width: payableColW, align: "right" });
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("DEDUCTIONS", dedLabelX, tableTop + 6);
    doc.text("AMOUNT (INR)", dedAmtX, tableTop + 6, { width: amtColW, align: "right" });

    doc.font("Helvetica").fontSize(9).fillColor("black");
    for (let i = 0; i < lineRows; i++) {
      const rowY = tableTop + tableHeaderH + i * tableRowH + 5;
      const earningsRow = earningsRows[i];
      if (earningsRow) {
        doc.text(earningsRow.label, earnLabelX, rowY, { width: earnLabelW });
        if (earningsRow.rate !== undefined) {
          doc.text(formatCurrency(earningsRow.rate), earnRateX, rowY, { width: rateColW, align: "right" });
        }
        doc.text(formatCurrency(earningsRow.payable), earnPayableX, rowY, { width: payableColW, align: "right" });
      }
      if (deductionRows[i]) {
        doc.text(deductionRows[i][0], dedLabelX, rowY, { width: COL_WIDTH - amtColW - 16 });
        doc.text(formatCurrency(deductionRows[i][1]), dedAmtX, rowY, { width: amtColW, align: "right" });
      }
      if (i < lineRows - 1) {
        const ly2 = tableTop + tableHeaderH + (i + 1) * tableRowH;
        doc.moveTo(PAGE_LEFT, ly2).lineTo(PAGE_LEFT + COL_WIDTH, ly2).strokeColor(LIGHT_FILL_STRONG).lineWidth(0.5).stroke();
        doc.moveTo(RIGHT_COL_X, ly2).lineTo(RIGHT_COL_X + COL_WIDTH, ly2).stroke();
      }
    }

    const totalsY = tableTop + tableHeaderH + lineRows * tableRowH;
    doc.rect(PAGE_LEFT, totalsY, COL_WIDTH, totalsRowH).fill(LIGHT_FILL);
    doc.rect(RIGHT_COL_X, totalsY, COL_WIDTH, totalsRowH).fill(LIGHT_FILL);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY);
    doc.text("Total Earnings (A)", earnLabelX, totalsY + 6, { width: earnLabelW });
    doc.text(formatCurrency(data.earnings.grossEarnings), earnPayableX, totalsY + 6, { width: payableColW, align: "right" });
    doc.text("Total Deductions (B)", dedLabelX, totalsY + 6, { width: COL_WIDTH - amtColW - 16 });
    doc.text(formatCurrency(data.deductions.totalDeductions), dedAmtX, totalsY + 6, { width: amtColW, align: "right" });
    doc.fillColor("black");

    // Light grid border around both tables — an outer box plus a divider between each column,
    // like a printed ledger.
    const tableBottom = totalsY + totalsRowH;
    doc.strokeColor(LIGHT_FILL_STRONG).lineWidth(0.75);
    doc.rect(PAGE_LEFT, tableTop, COL_WIDTH, tableBottom - tableTop).stroke();
    doc.rect(RIGHT_COL_X, tableTop, COL_WIDTH, tableBottom - tableTop).stroke();
    const earnRateDividerX = earnRateX - 4;
    const earnPayableDividerX = earnPayableX - 4;
    doc.moveTo(earnRateDividerX, tableTop).lineTo(earnRateDividerX, tableBottom).stroke();
    doc.moveTo(earnPayableDividerX, tableTop).lineTo(earnPayableDividerX, tableBottom).stroke();
    const dedAmtDividerX = dedAmtX - 8;
    doc.moveTo(dedAmtDividerX, tableTop).lineTo(dedAmtDividerX, tableBottom).stroke();

    doc.y = totalsY + totalsRowH + 16;

    // === Net Pay: two-tone bar ===
    const netTop = doc.y;
    const netH = 40;
    const netAmountW = 170;
    doc.rect(PAGE_LEFT, netTop, PAGE_WIDTH - netAmountW, netH).fill(LIGHT_FILL_STRONG);
    doc.rect(PAGE_RIGHT - netAmountW, netTop, netAmountW, netH).fill(NAVY);

    doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text("Net Pay (A - B)", PAGE_LEFT + 14, netTop + 13);
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor(WHITE)
      .text(`Rs. ${formatCurrency(data.netPay)}`, PAGE_RIGHT - netAmountW, netTop + 11, { width: netAmountW - 14, align: "right" });
    doc.fillColor("black");

    doc.y = netTop + netH + 10;
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(NAVY_MUTED)
      .text(`Amount in Words: ${amountInWords(data.netPay)}`, PAGE_LEFT, doc.y, { width: PAGE_WIDTH });
    doc.fillColor("black");

    // === Footer ===
    // Kept well clear of the bottom margin — PDFKit silently starts a new
    // page if a text call's computed height would cross it, which (at -95)
    // clipped the last footer line onto a stray blank page 2. The signature
    // block (image + caption below it) is the tallest thing down here, so
    // -135 is sized to that, not just the one-line disclaimer text.
    const footerY = doc.page.height - 135;
    doc.moveTo(PAGE_LEFT, footerY).lineTo(PAGE_RIGHT, footerY).strokeColor(LIGHT_FILL_STRONG).lineWidth(0.75).stroke();
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(GRAY)
      .text("This is a system-generated payslip.", PAGE_LEFT, footerY + 10, {
        width: 320,
      });

    if (fs.existsSync(SIGNATURE_PATH)) {
      try {
        const sigX = PAGE_RIGHT - SIGNATURE_SIZE;
        doc.image(SIGNATURE_PATH, sigX, footerY + 8, { width: SIGNATURE_SIZE, height: SIGNATURE_SIZE, fit: [SIGNATURE_SIZE, SIGNATURE_SIZE] });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(GRAY)
          .text("Authorized Signatory", PAGE_RIGHT - 130, footerY + 8 + SIGNATURE_SIZE + 3, { width: 130, align: "right" });
        doc.fillColor("black");
      } catch (err) {
        // Never fail the whole payslip over an unreadable/unsupported signature file — but log
        // it loudly rather than silently, so a broken stamp is diagnosable instead of a mystery.
        console.error("[pdf.service] Failed to draw signature stamp:", err);
      }
    } else {
      console.error("[pdf.service] Signature stamp file not found at:", SIGNATURE_PATH);
    }

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}

// ============================================================================
// Client Bill — one PDF per uploaded sheet, listing every deployed employee's
// wage cost (Gross Earnings + employer PF/ESI/LWF) plus the per-employee
// service charge, generated automatically alongside that sheet's payslips.
// ============================================================================

export interface ClientBillPdfData {
  company: {
    name: string;
    address?: string | null;
    logoPath?: string | null;
    mobile?: string | null;
    officePhone?: string | null;
    email?: string | null;
    website?: string | null;
    gstin?: string | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankIfscCode?: string | null;
    billingTerms?: string | null;
  };
  client: { name: string; address?: string | null };
  period: { month: number; year: number };
  billNo: string;
  lines: {
    employeeCode: string;
    name: string;
    paidDays: number;
    grossEarnings: number;
    employerEpf: number;
    employerEsi: number;
    employerLwf: number;
    wageCost: number;
  }[];
  totals: {
    employeeCount: number;
    totalGrossWages: number;
    totalEmployerEpf: number;
    totalEmployerEsi: number;
    totalEmployerLwf: number;
    pfAdminCharge: number;
    billingRateUsed: number | null;
    serviceCharge: number;
    totalWageCost: number;
    grandTotal: number;
  };
}

// Column layout for the employee table — widths sum exactly to PAGE_WIDTH (495pt).
const BILL_COLS = [
  { key: "code", label: "Emp. Code", width: 50, align: "left" as const },
  { key: "name", label: "Name", width: 110, align: "left" as const },
  { key: "days", label: "Paid Days", width: 35, align: "right" as const },
  { key: "gross", label: "Gross Wages", width: 65, align: "right" as const },
  { key: "epf", label: "Employer EPF", width: 60, align: "right" as const },
  { key: "esi", label: "Employer ESI", width: 55, align: "right" as const },
  { key: "lwf", label: "Employer LWF", width: 55, align: "right" as const },
  { key: "cost", label: "Wage Cost", width: 65, align: "right" as const },
];

/**
 * Renders a single client bill PDF to `outputPath`. Resolves once the file
 * has been fully written to disk.
 */
export function generateClientBillPdf(data: ClientBillPdfData, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // === Header: logo + company block (left), CLIENT BILL + period (right) ===
    const headerTop = doc.y;
    let logoDrawn = false;
    const LOGO_SIZE = 90;
    if (data.company.logoPath && fs.existsSync(data.company.logoPath)) {
      try {
        doc.image(data.company.logoPath, PAGE_LEFT, headerTop, { width: LOGO_SIZE, height: LOGO_SIZE, fit: [LOGO_SIZE, LOGO_SIZE] });
        logoDrawn = true;
      } catch {
        // Ignore unreadable/unsupported logo files rather than failing generation.
      }
    }

    const textX = logoDrawn ? PAGE_LEFT + LOGO_SIZE + 14 : PAGE_LEFT;
    const textW = HEADER_SPLIT_X - HEADER_GUTTER - textX;
    let ly = headerTop;
    doc.font("Helvetica-Bold").fontSize(17).fillColor(NAVY).text(data.company.name, textX, ly, { width: textW });
    ly = doc.y + 2;

    doc.font("Helvetica").fontSize(8).fillColor(GRAY);
    if (data.company.address) {
      doc.text(data.company.address, textX, ly, { width: textW });
      ly = doc.y + 1;
    }
    const contactLine1 = [data.company.mobile, data.company.officePhone].filter(Boolean).join("   |   ");
    if (contactLine1) {
      doc.text(contactLine1, textX, ly, { width: textW });
      ly = doc.y + 1;
    }
    const contactLine2 = [data.company.email, data.company.website].filter(Boolean).join("   |   ");
    if (contactLine2) {
      doc.text(contactLine2, textX, ly, { width: textW });
      ly = doc.y + 1;
    }
    if (data.company.gstin) {
      doc.text(`GSTIN: ${data.company.gstin}`, textX, ly, { width: textW });
      ly = doc.y + 1;
    }

    const headerRightW = PAGE_RIGHT - HEADER_SPLIT_X;
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor(NAVY)
      .text("CLIENT BILL", HEADER_SPLIT_X, headerTop, { width: headerRightW, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(NAVY_MUTED)
      .text(
        `For the Month of ${MONTH_NAMES[data.period.month - 1] ?? data.period.month} ${data.period.year}`,
        HEADER_SPLIT_X,
        doc.y + 2,
        { width: headerRightW, align: "right" }
      );
    doc.fillColor("black");

    const headerBottom = Math.max(ly, doc.y, headerTop + LOGO_SIZE) + 8;

    const gradient = doc.linearGradient(PAGE_LEFT, headerBottom, PAGE_RIGHT, headerBottom);
    gradient.stop(0, NAVY).stop(0.75, NAVY).stop(0.75, FLAME_ORANGE).stop(1, FLAME_RED);
    doc.rect(PAGE_LEFT, headerBottom, PAGE_WIDTH, 3).fill(gradient);
    doc.y = headerBottom + 16;

    // === Bill To (left) / Bill Details (right) ===
    function detailsBox(x: number, w: number, title: string, rows: [string, string][]) {
      const boxTop = doc.y;
      const barH = 18;
      doc.rect(x, boxTop, w, barH).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE).text(title, x + 8, boxTop + 5);

      const rowH = 16;
      const bodyH = rows.length * rowH + 8;
      doc.rect(x, boxTop + barH, w, bodyH).fill(LIGHT_FILL);

      const labelW = 92;
      rows.forEach(([label, value], i) => {
        const ry = boxTop + barH + 6 + i * rowH;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(NAVY_MUTED).text(label, x + 8, ry, { width: labelW });
        doc.font("Helvetica").fillColor("black").text(value || "-", x + 8 + labelW, ry, { width: w - labelW - 16 });
      });

      return boxTop + barH + bodyH;
    }

    const billToRows: [string, string][] = [
      ["Client / Site", data.client.name],
      ["Address", data.client.address ?? "-"],
    ];
    const billDetailRows: [string, string][] = [
      ["Bill No.", data.billNo],
      ["Pay Period", `${MONTH_NAMES[data.period.month - 1]} ${data.period.year}`],
      ["Employees Billed", `${data.totals.employeeCount}`],
      ["Rate / Employee", data.totals.billingRateUsed != null ? `Rs. ${formatCurrency(data.totals.billingRateUsed)}` : "Not set"],
    ];

    const detailsTop = doc.y;
    const leftBottom = detailsBox(PAGE_LEFT, COL_WIDTH, "BILL TO", billToRows);
    doc.y = detailsTop;
    const rightBottom = detailsBox(RIGHT_COL_X, COL_WIDTH, "BILL DETAILS", billDetailRows);
    doc.y = Math.max(leftBottom, rightBottom) + 18;

    // === Employee wage-cost table (paginated — a sheet can run 1000+ rows) ===
    const tableHeaderH = 20;
    const tableRowH = 16;
    const PAGE_BOTTOM = doc.page.height - 60; // leave room to finish a row before the margin

    function drawTableHeader() {
      const y = doc.y;
      doc.rect(PAGE_LEFT, y, PAGE_WIDTH, tableHeaderH).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHITE);
      let cx = PAGE_LEFT;
      for (const col of BILL_COLS) {
        doc.text(col.label, cx + 6, y + 6, { width: col.width - 8, align: col.align });
        cx += col.width;
      }
      doc.fillColor("black");
      doc.y = y + tableHeaderH;
    }

    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NAVY).text("EMPLOYEE-WISE WAGE COST", PAGE_LEFT, doc.y);
    doc.y += 4;
    doc.fillColor("black");
    drawTableHeader();

    doc.font("Helvetica").fontSize(8).fillColor("black");
    data.lines.forEach((l, i) => {
      if (doc.y + tableRowH > PAGE_BOTTOM) {
        doc.addPage();
        doc.y = 50;
        drawTableHeader();
        doc.font("Helvetica").fontSize(8).fillColor("black");
      }
      const rowY = doc.y;
      if (i % 2 === 1) doc.rect(PAGE_LEFT, rowY, PAGE_WIDTH, tableRowH).fill(LIGHT_FILL);
      doc.fillColor("black");
      const cells = [
        l.employeeCode,
        l.name,
        `${l.paidDays}`,
        formatCurrency(l.grossEarnings),
        formatCurrency(l.employerEpf),
        formatCurrency(l.employerEsi),
        formatCurrency(l.employerLwf),
        formatCurrency(l.wageCost),
      ];
      let cx = PAGE_LEFT;
      BILL_COLS.forEach((col, ci) => {
        doc.text(cells[ci], cx + 6, rowY + 4, { width: col.width - 8, align: col.align });
        cx += col.width;
      });
      doc.y = rowY + tableRowH;
    });

    doc.y += 12;

    // === Bill Summary — a proper bordered table (Description | Amount), full page width, matching
    // the employee-wise table's visual language. Full width (not squeezed into a half-page column)
    // is what lets long labels like "Total Employer EPF (EPS + EPF diff + EDLI)" sit on one line
    // instead of wrapping and colliding with the row below.
    interface SummaryRow {
      label: string;
      amount: number;
      emphasize?: boolean; // highlighted subtotal row (Total Wage Cost)
    }
    const summaryRows: SummaryRow[] = [
      { label: "Total Gross Wages", amount: data.totals.totalGrossWages },
      { label: "Total Employer EPF (EPS + EPF diff + EDLI)", amount: data.totals.totalEmployerEpf },
      { label: "Total Employer ESI", amount: data.totals.totalEmployerEsi },
      { label: "Total Employer LWF", amount: data.totals.totalEmployerLwf },
      { label: "PF Administrative Charges", amount: data.totals.pfAdminCharge },
      { label: "Total Wage Cost", amount: data.totals.totalWageCost, emphasize: true },
      {
        label: `Service Charge (${data.totals.employeeCount} x Rs. ${data.totals.billingRateUsed != null ? formatCurrency(data.totals.billingRateUsed) : "0.00"})`,
        amount: data.totals.serviceCharge,
      },
    ];

    const SUMMARY_DESC_W = 350;
    const SUMMARY_AMT_W = PAGE_WIDTH - SUMMARY_DESC_W;
    const summaryHeaderH = 20;
    const summaryRowH = 18;
    const summaryBlockH = 24 + summaryHeaderH + summaryRows.length * summaryRowH;
    if (doc.y + summaryBlockH > doc.page.height - 50) {
      doc.addPage();
      doc.y = 50;
    }

    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NAVY).text("BILL SUMMARY", PAGE_LEFT, doc.y);
    doc.y += 6;

    const summaryTop = doc.y;
    doc.rect(PAGE_LEFT, summaryTop, PAGE_WIDTH, summaryHeaderH).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
    doc.text("Description", PAGE_LEFT + 8, summaryTop + 6, { width: SUMMARY_DESC_W - 16 });
    doc.text("Amount (INR)", PAGE_LEFT + SUMMARY_DESC_W, summaryTop + 6, { width: SUMMARY_AMT_W - 8, align: "right" });
    doc.fillColor("black");

    let ry = summaryTop + summaryHeaderH;
    summaryRows.forEach((row, i) => {
      if (row.emphasize) {
        doc.rect(PAGE_LEFT, ry, PAGE_WIDTH, summaryRowH).fill(LIGHT_FILL_STRONG);
      } else if (i % 2 === 1) {
        doc.rect(PAGE_LEFT, ry, PAGE_WIDTH, summaryRowH).fill(LIGHT_FILL);
      }
      doc
        .font(row.emphasize ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8.5)
        .fillColor(row.emphasize ? NAVY : "black");
      doc.text(row.label, PAGE_LEFT + 8, ry + 4, { width: SUMMARY_DESC_W - 16 });
      doc.text(formatCurrency(row.amount), PAGE_LEFT + SUMMARY_DESC_W, ry + 4, { width: SUMMARY_AMT_W - 8, align: "right" });
      ry += summaryRowH;
    });
    doc.fillColor("black");

    const summaryBottom = ry;
    doc.strokeColor(LIGHT_FILL_STRONG).lineWidth(0.75);
    doc.rect(PAGE_LEFT, summaryTop, PAGE_WIDTH, summaryBottom - summaryTop).stroke();
    doc.moveTo(PAGE_LEFT + SUMMARY_DESC_W, summaryTop).lineTo(PAGE_LEFT + SUMMARY_DESC_W, summaryBottom).stroke();

    doc.y = summaryBottom + 16;

    // === Grand Total: two-tone bar ===
    const netTop = doc.y;
    const netH = 40;
    const netAmountW = 170;
    doc.rect(PAGE_LEFT, netTop, PAGE_WIDTH - netAmountW, netH).fill(LIGHT_FILL_STRONG);
    doc.rect(PAGE_RIGHT - netAmountW, netTop, netAmountW, netH).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text("Grand Total", PAGE_LEFT + 14, netTop + 13);
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor(WHITE)
      .text(`Rs. ${formatCurrency(data.totals.grandTotal)}`, PAGE_RIGHT - netAmountW, netTop + 11, { width: netAmountW - 14, align: "right" });
    doc.fillColor("black");

    doc.y = netTop + netH + 10;
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(NAVY_MUTED)
      .text(`Amount in Words: ${amountInWords(data.totals.grandTotal)}`, PAGE_LEFT, doc.y, { width: PAGE_WIDTH });
    doc.fillColor("black");

    if (data.totals.billingRateUsed == null) {
      doc.y += 10;
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(FLAME_RED)
        .text("Note: no billing/service-charge rate is set for this client yet — the total above is wage cost only.", PAGE_LEFT, doc.y, {
          width: PAGE_WIDTH,
        });
      doc.fillColor("black");
    }

    // === Payment Details — bank info + terms, only shown once any of it is set in Settings ===
    if (data.company.bankName || data.company.bankAccountNo || data.company.bankIfscCode || data.company.billingTerms) {
      doc.y += 14;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(NAVY_MUTED).text("PAYMENT DETAILS", PAGE_LEFT, doc.y, { width: PAGE_WIDTH });
      doc.y += 2;
      const bankParts = [
        data.company.bankName && `Bank: ${data.company.bankName}`,
        data.company.bankAccountNo && `A/c No.: ${data.company.bankAccountNo}`,
        data.company.bankIfscCode && `IFSC: ${data.company.bankIfscCode}`,
      ].filter((p): p is string => Boolean(p));
      if (bankParts.length > 0) {
        doc.font("Helvetica").fontSize(8.5).fillColor("black").text(bankParts.join("   |   "), PAGE_LEFT, doc.y, { width: PAGE_WIDTH });
      }
      if (data.company.billingTerms) {
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(NAVY_MUTED).text(data.company.billingTerms, PAGE_LEFT, doc.y + 3, { width: PAGE_WIDTH });
      }
      doc.fillColor("black");
    }

    // === Footer ===
    const footerY = doc.page.height - 135;
    if (doc.y > footerY - 20) {
      doc.addPage();
    }
    doc.moveTo(PAGE_LEFT, footerY).lineTo(PAGE_RIGHT, footerY).strokeColor(LIGHT_FILL_STRONG).lineWidth(0.75).stroke();
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(GRAY)
      .text("This is a system-generated bill.", PAGE_LEFT, footerY + 10, { width: 320 });

    if (fs.existsSync(SIGNATURE_PATH)) {
      try {
        const sigX = PAGE_RIGHT - SIGNATURE_SIZE;
        doc.image(SIGNATURE_PATH, sigX, footerY + 8, { width: SIGNATURE_SIZE, height: SIGNATURE_SIZE, fit: [SIGNATURE_SIZE, SIGNATURE_SIZE] });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(GRAY)
          .text("Authorized Signatory", PAGE_RIGHT - 130, footerY + 8 + SIGNATURE_SIZE + 3, { width: 130, align: "right" });
        doc.fillColor("black");
      } catch (err) {
        console.error("[pdf.service] Failed to draw signature stamp on client bill:", err);
      }
    }

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}
