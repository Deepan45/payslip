import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";

interface ClientRow {
  id: string;
  name: string;
  address: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingRate: number | null;
  _count: { employees: number; salarySheets: number };
  columnProfile: { updatedAt: string } | null;
}

interface ClientFormValues {
  name: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  billingRate: string;
}

const EMPTY_FORM: ClientFormValues = { name: "", address: "", contactPerson: "", contactPhone: "", contactEmail: "", billingRate: "" };

function toFormValues(c: ClientRow): ClientFormValues {
  return {
    name: c.name,
    address: c.address ?? "",
    contactPerson: c.contactPerson ?? "",
    contactPhone: c.contactPhone ?? "",
    contactEmail: c.contactEmail ?? "",
    billingRate: c.billingRate != null ? String(c.billingRate) : "",
  };
}

/** Every editable client field, shared by the "Add Client" form and the "Edit Client" modal. */
function ClientFields({ values, onChange }: { values: ClientFormValues; onChange: (values: ClientFormValues) => void }) {
  return (
    <>
      <label>
        Client / Site name
        <input
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          required
          autoFocus
          placeholder="e.g. Glen Appliances"
        />
      </label>
      <div className="form-row">
        <label>
          Contact person
          <input value={values.contactPerson} onChange={(e) => onChange({ ...values, contactPerson: e.target.value })} placeholder="e.g. Rakesh Sharma" />
        </label>
        <label>
          Contact phone
          <input value={values.contactPhone} onChange={(e) => onChange({ ...values, contactPhone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
        </label>
      </div>
      <label>
        Contact email
        <input
          type="email"
          value={values.contactEmail}
          onChange={(e) => onChange({ ...values, contactEmail: e.target.value })}
          placeholder="contact@client.com"
        />
      </label>
      <label>
        Address
        <textarea value={values.address} onChange={(e) => onChange({ ...values, address: e.target.value })} rows={2} placeholder="Site / plant address" />
      </label>
      <label>
        Billing rate (&#8377; per employee / month)
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.billingRate}
          onChange={(e) => onChange({ ...values, billingRate: e.target.value })}
          placeholder="e.g. 500 — service charge added per deployed employee on each bill"
        />
      </label>
    </>
  );
}

export function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createValues, setCreateValues] = useState<ClientFormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ClientRow | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [editValues, setEditValues] = useState<ClientFormValues>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/clients")
      .then((res) => setClients(res.data.clients))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(c: ClientRow) {
    setError(null);
    setDeletingId(c.id);
    try {
      await api.delete(`/clients/${c.id}`);
      setClients((prev) => prev.filter((x) => x.id !== c.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete client"));
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
    setSelected(checked ? new Set(clients.map((c) => c.id)) : new Set());
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    setError(null);
    setBulkDeleting(true);
    try {
      const res = await api.post("/clients/delete", { ids: Array.from(selected) });
      const { deleted, blocked } = res.data as { deleted: string[]; blocked: { id: string; error: string }[] };
      setClients((prev) => prev.filter((c) => !deleted.includes(c.id)));
      setSelected(new Set());
      if (blocked.length > 0) {
        setError(`Deleted ${deleted.length}. Skipped ${blocked.length}: ${blocked.map((b) => b.error).join(" ")}`);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete selected clients"));
    } finally {
      setBulkDeleting(false);
      setConfirmBulk(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/clients", {
        name: createValues.name,
        address: createValues.address,
        contactPerson: createValues.contactPerson,
        contactPhone: createValues.contactPhone,
        contactEmail: createValues.contactEmail,
        billingRate: createValues.billingRate.trim() ? Number(createValues.billingRate) : undefined,
      });
      setCreateValues(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create client"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: ClientRow) {
    setEditingClient(c);
    setEditValues(toFormValues(c));
    setEditError(null);
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const billingRateValue = editValues.billingRate.trim() ? Number(editValues.billingRate) : null;
      const res = await api.put(`/clients/${editingClient.id}`, {
        name: editValues.name,
        address: editValues.address,
        contactPerson: editValues.contactPerson,
        contactPhone: editValues.contactPhone,
        contactEmail: editValues.contactEmail,
        billingRate: billingRateValue,
      });
      const updated = res.data.client as { name: string; address: string | null; contactPerson: string | null; contactPhone: string | null; contactEmail: string | null; billingRate: number | null };
      setClients((prev) => prev.map((x) => (x.id === editingClient.id ? { ...x, ...updated } : x)));
      setEditingClient(null);
    } catch (err) {
      setEditError(apiErrorMessage(err, "Failed to update client"));
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      <h1>Client Sites</h1>
      <p className="page-subtitle">
        Each client is a site your workers are deployed to (e.g. a factory or plant). Salary sheets, employees, and
        column mappings are all organized per client.
      </p>

      <div className="card">
        <div className="section-title toolbar" style={{ justifyContent: "space-between", marginBottom: showForm ? 16 : 0 }}>
          <div className="section-title">
            <span className="section-title-icon stat-icon-aqua">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>All Clients</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selected.size > 0 && (
              <ActionButton icon="delete" tone="danger" disabled={bulkDeleting} onClick={() => setConfirmBulk(true)}>
                {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Selected`}
              </ActionButton>
            )}
            <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "+ Add Client"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, maxWidth: 480 }}>
            <ClientFields values={createValues} onChange={setCreateValues} />
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Client"}
            </button>
          </form>
        )}

        {loading ? (
          <PageLoader message="Loading clients..." />
        ) : clients.length === 0 ? (
          <EmptyState title="No clients yet" hint="Add a client site to start uploading salary sheets for it." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" checked={clients.length > 0 && selected.size === clients.length} onChange={(e) => toggleAll(e.target.checked)} />
                  </th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th className="num">Employees</th>
                  <th className="num">Sheets Uploaded</th>
                  <th className="num">Billing Rate</th>
                  <th>Column Mapping</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                    </td>
                    <td>
                      <div className="name-cell">
                        <Avatar name={c.name} size={28} />
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                      </div>
                    </td>
                    <td>{c.contactPerson ?? "-"}</td>
                    <td className="num">{c._count.employees}</td>
                    <td className="num">{c._count.salarySheets}</td>
                    <td className="num">
                      {c.billingRate != null ? `₹ ${c.billingRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : <span className="muted">Not set</span>}
                    </td>
                    <td>
                      {c.columnProfile ? (
                        <span className="badge badge-success">Configured</span>
                      ) : (
                        <span className="badge badge-warn">Not yet mapped</span>
                      )}
                    </td>
                    <td className="actions">
                      <Link to={`/upload?clientId=${c.id}`} className="btn-action">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 20h16" />
                        </svg>
                        Upload
                      </Link>
                      <ActionButton icon="edit" onClick={() => startEdit(c)}>
                        Edit
                      </ActionButton>
                      <ActionButton icon="delete" tone="danger" disabled={deletingId === c.id} onClick={() => setConfirmTarget(c)}>
                        {deletingId === c.id ? "Deleting..." : "Delete"}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingClient && (
        <div className="modal-overlay" onClick={() => setEditingClient(null)}>
          <div className="modal-panel" style={{ height: "auto", maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit {editingClient.name}</h3>
              <button className="btn-link" onClick={() => setEditingClient(null)} aria-label="Close">
                &times;
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body" style={{ overflow: "auto", padding: 20 }}>
                {editError && <div className="alert alert-error">{editError}</div>}
                <ClientFields values={editValues} onChange={setEditValues} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-link" onClick={() => setEditingClient(null)} style={{ margin: 0 }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete client?"
        message={confirmTarget ? `Delete "${confirmTarget.name}"? This only works if it has no employees or uploaded sheets.` : ""}
        loading={deletingId === confirmTarget?.id}
        onConfirm={() => confirmTarget && handleDelete(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
      <ConfirmDialog
        open={confirmBulk}
        title={`Delete ${selected.size} client(s)?`}
        message="Any with employees or uploaded sheets will be skipped rather than deleted."
        loading={bulkDeleting}
        onConfirm={handleDeleteSelected}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
