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
