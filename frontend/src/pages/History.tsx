import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";

interface Sheet {
  id: string;
  fileName: string;
  periodMonth: number;
  periodYear: number;
  uploadedAt: string;
  recordCount: number;
  client: { id: string; name: string };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function History() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Sheet | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/history")
      .then((res) => setSheets(res.data.sheets))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(sheet: Sheet) {
    setError(null);
    setDeletingId(sheet.id);
    try {
      await api.delete(`/history/${sheet.id}`);
      setSheets((prev) => prev.filter((s) => s.id !== sheet.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(sheet.id);
        return next;
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete sheet"));
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sheets.map((s) => s.id)) : new Set());
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    setError(null);
    setBulkDeleting(true);
    try {
      const res = await api.post("/history/delete", { sheetIds: Array.from(selected) });
      const { deleted } = res.data as { deleted: string[]; notFound: string[] };
      setSheets((prev) => prev.filter((s) => !deleted.includes(s.id)));
      setSelected(new Set());
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete selected uploads"));
    } finally {
      setBulkDeleting(false);
      setConfirmBulk(false);
    }
  }

  return (
    <div>
      <h1>Upload History</h1>
      <div className="card">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <div className="section-title">
            <span className="section-title-icon stat-icon-violet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>All Uploaded Sheets</h2>
          </div>
          {selected.size > 0 && (
            <ActionButton icon="delete" tone="danger" disabled={bulkDeleting} onClick={() => setConfirmBulk(true)}>
              {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Selected`}
            </ActionButton>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <PageLoader message="Loading history..." />
        ) : sheets.length === 0 ? (
          <EmptyState title="No salary sheets uploaded yet" hint="Uploads you make will show up here, organized by pay period and client." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" checked={sheets.length > 0 && selected.size === sheets.length} onChange={(e) => toggleAll(e.target.checked)} />
                  </th>
                  <th>Period</th>
                  <th>Client</th>
                  <th>File</th>
                  <th className="num">Employees</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {MONTH_NAMES[s.periodMonth - 1]} {s.periodYear}
                    </td>
                    <td>{s.client.name}</td>
                    <td className="muted">{s.fileName}</td>
                    <td className="num">{s.recordCount}</td>
                    <td className="muted small">{new Date(s.uploadedAt).toLocaleString()}</td>
                    <td className="actions">
                      <Link to={`/history/${s.id}`} className="btn-action">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                        View
                      </Link>
                      <ActionButton icon="delete" tone="danger" disabled={deletingId === s.id} onClick={() => setConfirmTarget(s)}>
                        {deletingId === s.id ? "Deleting..." : "Delete"}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete this upload?"
        message={
          confirmTarget
            ? `Delete this entire upload — ${confirmTarget.recordCount} payslip(s) for ${confirmTarget.client.name}, ${MONTH_NAMES[confirmTarget.periodMonth - 1]} ${confirmTarget.periodYear}? This cannot be undone.`
            : ""
        }
        loading={deletingId === confirmTarget?.id}
        onConfirm={() => confirmTarget && handleDelete(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
      <ConfirmDialog
        open={confirmBulk}
        title={`Delete ${selected.size} upload(s)?`}
        message="Every payslip in these uploads will be deleted. This cannot be undone."
        loading={bulkDeleting}
        onConfirm={handleDeleteSelected}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
