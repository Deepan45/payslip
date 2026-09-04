import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { downloadPayslip, downloadAllPayslipsForSheet } from "../api/payslip";
import { Pagination } from "../components/Pagination";
import { PayslipPreviewModal } from "../components/PayslipPreviewModal";
import { ActionButton } from "../components/ActionButton";
import { PageLoader } from "../components/PageLoader";

const PAGE_SIZE = 25;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Record {
  id: string;
  netPay: number;
  employee: { id: string; employeeCode: string; name: string; department: string | null };
  payslip: { id: string } | null;
}

interface SheetDetail {
  id: string;
  fileName: string;
  periodMonth: number;
  periodYear: number;
  uploadedAt: string;
  client: { id: string; name: string };
  salaryRecords: Record[];
}

export function HistoryDetail() {
  const { sheetId } = useParams();
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ payslipId: string; title: string } | null>(null);

  useEffect(() => {
    if (!sheetId) return;
    api
      .get(`/history/${sheetId}`)
      .then((res) => setSheet(res.data.sheet))
      .finally(() => setLoading(false));
  }, [sheetId]);

  async function handleBulkDownload() {
    if (!sheetId) return;
    setBulkLoading(true);
    try {
      await downloadAllPayslipsForSheet(sheetId);
    } finally {
      setBulkLoading(false);
    }
  }

  if (loading) return <PageLoader message="Loading payslips..." />;
  if (!sheet) return <p className="alert alert-error">Sheet not found.</p>;

  return (
    <div>
      <p>
        <Link to="/history">&larr; Back to History</Link>
      </p>
      <h1>
        Payslips — {MONTH_NAMES[sheet.periodMonth - 1]} {sheet.periodYear}
      </h1>
      <p className="muted">
        {sheet.client.name} &middot; {sheet.fileName} &middot; uploaded {new Date(sheet.uploadedAt).toLocaleString()}
      </p>

      <div className="card">
        <div className="toolbar" style={{ justifyContent: "flex-start", gap: 10 }}>
          <button className="btn-primary" onClick={handleBulkDownload} disabled={bulkLoading}>
            {bulkLoading ? "Preparing zip..." : "Download All (.zip)"}
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th className="num">Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sheet.salaryRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                <tr key={r.id}>
                  <td>{r.employee.employeeCode}</td>
                  <td style={{ fontWeight: 600 }}>{r.employee.name}</td>
                  <td>{r.employee.department ?? "-"}</td>
                  <td className="num">&#8377; {r.netPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="actions">
                    {r.payslip ? (
                      <>
                        <ActionButton
                          icon="preview"
                          onClick={() => setPreview({ payslipId: r.payslip!.id, title: `${r.employee.name} — ${MONTH_NAMES[sheet.periodMonth - 1]} ${sheet.periodYear}` })}
                        >
                          Preview
                        </ActionButton>
                        <ActionButton icon="download" onClick={() => downloadPayslip(r.payslip!.id)}>
                          Download
                        </ActionButton>
                      </>
                    ) : (
                      <span className="muted small">Not generated</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={sheet.salaryRecords.length} onPageChange={setPage} />
      </div>

      {preview && <PayslipPreviewModal payslipId={preview.payslipId} title={preview.title} onClose={() => setPreview(null)} />}
    </div>
  );
}
