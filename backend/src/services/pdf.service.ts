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

    // Basic ÷ Paid Days — the effective per-day rate behind this month's Basic Pay.
    const ratePerDay = data.attendance.paidDays > 0 ? data.earnings.basic / data.attendance.paidDays : 0;

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
    const earningsRows: [string, number][] = [
      // Basic Pay (the full, unprorated monthly entitlement) and Rate of Pay (its per-day
      // equivalent) are shown for reference alongside Earning Payable — the actual,
      // prorated-for-Paid-Days figure — but only Earning Payable is included in Total
      // Earnings (A) / Gross Earnings / Net Pay.
      ["Basic Pay", data.earnings.monthlySalary],
      ["Rate of Pay", ratePerDay],
      ["Earning Payable", data.earnings.basic],
      ["House Rent Allowance (HRA)", data.earnings.hra],
      ["OT Amount", data.earnings.otAmount],
      ...data.earnings.otherEarnings.map(({ label, amount }): [string, number] => [label, amount]),
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
    const earnLabelX = PAGE_LEFT + 8;
    const earnAmtX = PAGE_LEFT + COL_WIDTH - amtColW;
    const dedLabelX = RIGHT_COL_X + 8;
    const dedAmtX = RIGHT_COL_X + COL_WIDTH - amtColW;

    doc.rect(PAGE_LEFT, tableTop, COL_WIDTH, tableHeaderH).fill(NAVY);
    doc.rect(RIGHT_COL_X, tableTop, COL_WIDTH, tableHeaderH).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE);
    doc.text("EARNINGS", earnLabelX, tableTop + 6);
    doc.text("AMOUNT (INR)", earnAmtX, tableTop + 6, { width: amtColW, align: "right" });
    doc.text("DEDUCTIONS", dedLabelX, tableTop + 6);
    doc.text("AMOUNT (INR)", dedAmtX, tableTop + 6, { width: amtColW, align: "right" });

    doc.font("Helvetica").fontSize(9).fillColor("black");
    for (let i = 0; i < lineRows; i++) {
      const rowY = tableTop + tableHeaderH + i * tableRowH + 5;
      if (earningsRows[i]) {
        doc.text(earningsRows[i][0], earnLabelX, rowY, { width: COL_WIDTH - amtColW - 16 });
        doc.text(formatCurrency(earningsRows[i][1]), earnAmtX, rowY, { width: amtColW, align: "right" });
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
    doc.text("Total Earnings (A)", earnLabelX, totalsY + 6, { width: COL_WIDTH - amtColW - 16 });
    doc.text(formatCurrency(data.earnings.grossEarnings), earnAmtX, totalsY + 6, { width: amtColW, align: "right" });
    doc.text("Total Deductions (B)", dedLabelX, totalsY + 6, { width: COL_WIDTH - amtColW - 16 });
    doc.text(formatCurrency(data.deductions.totalDeductions), dedAmtX, totalsY + 6, { width: amtColW, align: "right" });
    doc.fillColor("black");

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
      } catch {
        // Ignore an unreadable/unsupported signature file rather than failing generation.
      }
    }

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}
