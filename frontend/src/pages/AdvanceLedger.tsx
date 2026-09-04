import { FormEvent, useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { ActionButton } from "../components/ActionButton";
import { PageLoader } from "../components/PageLoader";

const PAGE_SIZE = 20;

interface Summary {
  employee: { id: string; employeeCode: string; name: string };
  issued: number;
  recovered: number;
  balance: number;
  lastActivity: string;
}

interface Entry {
  id: string;
  type: "ISSUED" | "RECOVERED";
  amount: number;
  date: string;
  note: string | null;
  salaryRecordId: string | null;
}

function formatMoney(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function downloadLedgerExcel() {
  const res = await api.get("/advances/export", { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "advance-ledger.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AdvanceLedger() {
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState(0);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  function loadSummary() {
    setLoading(true);
    api
      .get("/advances")
      .then((res) => setSummary(res.data.summary))
      .finally(() => setLoading(false));
  }

  useEffect(loadSummary, []);

  function loadEntries(employeeId: string) {
    api.get(`/advances/${employeeId}`).then((res) => {
      setEntries(res.data.entries);
      setBalance(res.data.balance);
    });
  }

  function openEmployee(row: Summary) {
    setSelected(row);
    setShowIssueForm(false);
    setEditingId(null);
    loadEntries(row.employee.id);
  }

  function closeModal() {
    setSelected(null);
    setShowIssueForm(false);
    setEditingId(null);
  }

  async function handleIssue(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      await api.post("/advances", { employeeId: selected.employee.id, amount: parseFloat(amount), note });
      setAmount("");
      setNote("");
      setShowIssueForm(false);
      loadEntries(selected.employee.id);
      loadSummary();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to record advance"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setEditAmount(String(entry.amount));
    setEditNote(entry.note ?? "");
  }

  async function saveEdit(entryId: string) {
    if (!selected) return;
    setError(null);
    try {
      await api.put(`/advances/entries/${entryId}`, { amount: parseFloat(editAmount), note: editNote });
      setEditingId(null);
      loadEntries(selected.employee.id);
      loadSummary();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save changes"));
    }
  }

  async function deleteEntry(entryId: string) {
    if (!selected) return;
    if (!window.confirm("Delete this advance entry? This cannot be undone.")) return;
    setError(null);
    try {
      await api.delete(`/advances/entries/${entryId}`);
      loadEntries(selected.employee.id);
      loadSummary();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete entry"));
    }
  }


  return (
    <div>
      <h1>Advance Ledger</h1>
      <p className="muted">Cash advances issued to employees, and how much has been recovered through payroll.</p>

      <div className="card">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Employees with advances</h2>
          {summary.length > 0 && (
            <ActionButton icon="download" onClick={downloadLedgerExcel}>
              Export Excel
            </ActionButton>
          )}
        </div>
        {loading ? (
          <PageLoader message="Loading advances..." />
        ) : summary.length === 0 ? (
          <EmptyState title="No advances recorded yet" hint="Advances appear here automatically once a payslip deducts one, or you can issue one manually." />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="num">Issued</th>
                    <th className="num">Recovered</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => (
                    <tr key={row.employee.id} className="row-link" onClick={() => openEmployee(row)}>
                      <td style={{ fontWeight: 600 }}>
                        {row.employee.name} <span className="muted small" style={{ fontWeight: 400 }}>({row.employee.employeeCode})</span>
                      </td>
                      <td className="num">{formatMoney(row.issued)}</td>
                      <td className="num">{formatMoney(row.recovered)}</td>
                      <td className="num" style={{ fontWeight: 700, color: row.balance > 0 ? "var(--color-error)" : "var(--color-success-text)" }}>
                        {formatMoney(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={summary.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel" style={{ height: "auto", maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selected.employee.name} <span className="muted small">({selected.employee.employeeCode})</span>
              </h3>
              <button className="btn-link" onClick={closeModal} aria-label="Close">
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ background: "#fff", overflowY: "auto", padding: "20px 20px 4px" }}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <p style={{ margin: 0 }}>
                  Current balance:{" "}
                  <strong style={{ color: balance > 0 ? "var(--color-error)" : "var(--color-success-text)" }}>{formatMoney(balance)}</strong>
                </p>
                <button className="btn-primary" onClick={() => setShowIssueForm((s) => !s)}>
                  {showIssueForm ? "Cancel" : "+ Issue Advance"}
                </button>
              </div>

              {showIssueForm && (
                <form onSubmit={handleIssue} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--color-border)" }}>
                  <div className="form-row">
                    <label>
                      Amount
                      <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" required />
                    </label>
                    <label>
                      Note (optional)
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. medical emergency" />
                    </label>
                  </div>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Record Advance"}
                  </button>
                </form>
              )}

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th className="num">Amount</th>
                      <th>Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => {
                      const editable = !e.salaryRecordId;
                      const isEditing = editingId === e.id;
                      return (
                        <tr key={e.id}>
                          <td>{new Date(e.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${e.type === "ISSUED" ? "badge-navy" : "badge-success"}`}>
                              {e.type === "ISSUED" ? "Issued" : "Recovered"}
                            </span>
                          </td>
                          {isEditing ? (
                            <>
                              <td className="num">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={editAmount}
                                  onChange={(ev) => setEditAmount(ev.target.value)}
                                  placeholder="e.g. 5000"
                                  style={{ margin: 0, padding: "4px 6px", fontSize: 12.5 }}
                                />
                              </td>
                              <td>
                                <input
                                  value={editNote}
                                  onChange={(ev) => setEditNote(ev.target.value)}
                                  placeholder="e.g. medical emergency"
                                  style={{ margin: 0, padding: "4px 6px", fontSize: 12.5 }}
                                />
                              </td>
                              <td className="actions">
                                <ActionButton icon="save" onClick={() => saveEdit(e.id)}>
                                  Save
                                </ActionButton>
                                <ActionButton icon="close" onClick={() => setEditingId(null)}>
                                  Cancel
                                </ActionButton>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="num">{formatMoney(e.amount)}</td>
                              <td className="muted small">{e.note ?? "-"}</td>
                              <td className="actions">
                                {editable ? (
                                  <>
                                    <ActionButton icon="edit" onClick={() => startEdit(e)}>
                                      Edit
                                    </ActionButton>
                                    <ActionButton icon="delete" tone="danger" onClick={() => deleteEntry(e.id)}>
                                      Delete
                                    </ActionButton>
                                  </>
                                ) : (
                                  <span className="muted small">From payslip</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-link" onClick={closeModal} style={{ margin: 0 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
