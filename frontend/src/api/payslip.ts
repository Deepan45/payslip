import { api } from "./client";

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function fileNameFromDisposition(header: string | undefined, fallback: string): string {
  const match = header?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? fallback;
}

export async function downloadPayslip(payslipId: string) {
  const res = await api.get(`/payslips/${payslipId}/download`, { responseType: "blob" });
  const fileName = fileNameFromDisposition(res.headers["content-disposition"], "payslip.pdf");
  saveBlob(res.data, fileName);
}

export async function downloadAllPayslipsForSheet(sheetId: string) {
  const res = await api.get(`/payslips/sheet/${sheetId}/download-all`, { responseType: "blob" });
  const fileName = fileNameFromDisposition(res.headers["content-disposition"], "payslips.zip");
  saveBlob(res.data, fileName);
}

/** Re-downloads the originally uploaded workbook for a sheet (not the generated payslips). */
export async function downloadSalarySheetSource(sheetId: string, fallbackFileName: string) {
  const res = await api.get(`/history/${sheetId}/download`, { responseType: "blob" });
  const fileName = fileNameFromDisposition(res.headers["content-disposition"], fallbackFileName);
  saveBlob(res.data, fileName);
}

/** Downloads the client bill PDF generated automatically when a sheet was uploaded. */
export async function downloadClientBill(sheetId: string, fallbackFileName: string) {
  const res = await api.get(`/history/${sheetId}/bill/download`, { responseType: "blob" });
  const fileName = fileNameFromDisposition(res.headers["content-disposition"], fallbackFileName);
  saveBlob(res.data, fileName);
}

export async function downloadSalarySheetTemplate() {
  const res = await api.get("/uploads/template", { responseType: "blob" });
  const fileName = fileNameFromDisposition(res.headers["content-disposition"], "Salary-Sheet-Template.xlsx");
  saveBlob(res.data, fileName);
}

/**
 * Opens a payslip PDF in a new tab so the browser's native print dialog can be used.
 */
export async function printPayslip(payslipId: string) {
  const res = await api.get(`/payslips/${payslipId}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data);
  const win = window.open(url, "_blank");
  win?.addEventListener("load", () => win.print());
}

/**
 * Opens one combined PDF of a sheet's payslips — 1, 2 or 3 per A4 page — in a new tab for
 * printing. Omit perPage to use the default from Settings; pass recordIds to print only those.
 */
export async function printPayslipsForSheet(sheetId: string, perPage?: 1 | 2 | 3, recordIds?: string[]) {
  const params: Record<string, string> = {};
  if (perPage) params.perPage = String(perPage);
  if (recordIds?.length) params.recordIds = recordIds.join(",");
  const res = await api.get(`/payslips/sheet/${sheetId}/print`, { params, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  window.open(url, "_blank");
}
