const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Filename used whenever a payslip PDF is offered as a download — consistent across the
 *  admin single/bulk download, the employee portal, and the unauthenticated public link, so a
 *  batch of downloads never collides on employee code alone and always reads as e.g.
 *  "Payslip-MP0404-BRAHAM JEET-May-2026.pdf" instead of a bare employee code/name or a numeric
 *  month. */
export function payslipFileName(employeeCode: string, employeeName: string, periodMonth: number, periodYear: number): string {
  const monthName = MONTH_NAMES[periodMonth - 1] ?? String(periodMonth);
  return `Payslip-${employeeCode}-${employeeName}-${monthName}-${periodYear}.pdf`;
}
