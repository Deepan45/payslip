import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
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
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ payslipId: string; title: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function load() {
    if (!sheetId) return;
    setLoading(true);
    api
      .get(`/history/${sheetId}`)
      .then((res) => setSheet(res.data.sheet))
      .finally(() => setLoading(false));
  }

  useEffect(load, [sheetId]);

  async function handleBulkDownload() {
    if (!sheetId) return;
    setBulkLoading(true);
    try {
      await downloadAllPayslipsForSheet(sheetId);
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleOne(recordId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function toggleAllOnPage(pageRows: Record[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (!sheetId || selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected payslip(s)? This cannot be undone.`)) return;
    setError(null);
    setDeleting(true);
    try {
      await api.post(`/history/${sheetId}/records/delete`, { recordIds: Array.from(selected) });
      setSelected(new Set());
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete selected payslips"));
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteOne(recordId: string) {
    if (!sheetId) return;
    if (!window.confirm("Delete this payslip? This cannot be undone.")) return;
    setError(null);
    setDeleting(true);
    try {
      await api.post(`/history/${sheetId}/records/delete`, { recordIds: [recordId] });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete payslip"));
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteSheet() {
    if (!sheetId || !sheet) return;
    if (!window.confirm(`Delete this entire upload — all ${sheet.salaryRecords.length} payslip(s)? This cannot be undone.`)) return;
    setError(null);
    setDeleting(true);
    try {
      await api.delete(`/history/${sheetId}`);
      navigate("/history");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete sheet"));
      setDeleting(false);
    }
  }

  if (loading) return <PageLoader message="Loading payslips..." />;
  if (!sheet) return <p className="alert alert-error">Sheet not found.</p>;

  const pageRows = sheet.salaryRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

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
        {error && <div className="alert alert-error">{error}</div>}

        <div className="toolbar" style={{ justifyContent: "space-between", gap: 10 }}>
          <div className="toolbar" style={{ justifyContent: "flex-start", gap: 10, margin: 0 }}>
            <button className="btn-primary" onClick={handleBulkDownload} disabled={bulkLoading}>
              {bulkLoading ? "Preparing zip..." : "Download All (.zip)"}
            </button>
            {selected.size > 0 && (
              <ActionButton icon="delete" tone="danger" disabled={deleting} onClick={handleDeleteSelected}>
                {deleting ? "Deleting..." : `Delete ${selected.size} Selected`}
              </ActionButton>
            )}
          </div>
          <ActionButton icon="delete" tone="danger" disabled={deleting} onClick={handleDeleteSheet}>
            Delete This Sheet
          </ActionButton>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={(e) => toggleAllOnPage(pageRows, e.target.checked)} />
                </th>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th className="num">Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                  </td>
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
                    <ActionButton icon="delete" tone="danger" disabled={deleting} onClick={() => handleDeleteOne(r.id)}>
                      Delete
                    </ActionButton>
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
