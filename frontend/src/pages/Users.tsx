import { FormEvent, useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";
import { useAuth, UserRole } from "../context/AuthContext";

type UserStatus = "ACTIVE" | "DISABLED";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin", hint: "Full access, including user management and company settings" },
  { value: "PAYROLL_MANAGER", label: "Payroll Manager", hint: "Runs payroll — upload, clients, employees, payslips, advances" },
  { value: "ACCOUNTANT", label: "Accountant", hint: "Views everything, manages the advance ledger; no uploads or deletes" },
  { value: "VIEWER", label: "Viewer", hint: "Read-only access to every module" },
];
const ROLE_LABEL: Record<UserRole, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label])) as Record<UserRole, string>;

interface CreateValues {
  name: string;
  email: string;
  role: UserRole;
}
const EMPTY_FORM: CreateValues = { name: "", email: "", role: "VIEWER" };

export function Users() {
  const { admin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [createValues, setCreateValues] = useState<CreateValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("VIEWER");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<UserRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/users")
      .then((res) => setUsers(res.data.users))
      .catch((err) => setError(apiErrorMessage(err, "Failed to load users")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.post("/users", createValues);
      setUsers((prev) => [...prev, res.data.user]);
      setTempPassword({ email: res.data.user.email, password: res.data.temporaryPassword });
      setCreateValues(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create user"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: UserRow) {
    setEditingUser(u);
    setEditRole(u.role);
    setEditError(null);
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await api.patch(`/users/${editingUser.id}`, { role: editRole });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data.user : u)));
      setEditingUser(null);
    } catch (err) {
      setEditError(apiErrorMessage(err, "Failed to update user"));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleStatus(u: UserRow) {
    setError(null);
    setTogglingId(u.id);
    try {
      const nextStatus: UserStatus = u.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const res = await api.patch(`/users/${u.id}`, { status: nextStatus });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data.user : x)));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update user"));
    } finally {
      setTogglingId(null);
      setConfirmDisable(null);
    }
  }

  async function handleResetPassword(u: UserRow) {
    setError(null);
    setResettingId(u.id);
    try {
      const res = await api.post(`/users/${u.id}/reset-password`);
      setTempPassword({ email: u.email, password: res.data.temporaryPassword });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, mustChangePassword: true } : x)));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to reset password"));
    } finally {
      setResettingId(null);
    }
  }

  async function handleDelete(u: UserRow) {
    setError(null);
    setDeletingId(u.id);
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete user"));
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  function closeTempPassword() {
    setTempPassword(null);
    setCopied(false);
  }

  async function copyTempPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword.password);
      setCopied(true);
    } catch {
      // clipboard access can be blocked (permissions, non-secure context) — the password stays visible to copy by hand
    }
  }

  return (
    <div>
      <h1>Users</h1>
      <p className="page-subtitle">
        Everyone who can sign in to this app, and what they're allowed to do. Roles are fixed sets of permissions —
        see the hint under each role when adding or editing a user.
      </p>

      <div className="card">
        <div className="section-title toolbar" style={{ justifyContent: "space-between", marginBottom: showForm ? 16 : 0 }}>
          <div className="section-title">
            <span className="section-title-icon stat-icon-violet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>All Users</h2>
          </div>
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ Add User"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, maxWidth: 480 }}>
            <label>
              Full name
              <input
                value={createValues.name}
                onChange={(e) => setCreateValues({ ...createValues, name: e.target.value })}
                placeholder="e.g. Priya Nair"
                autoFocus
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={createValues.email}
                onChange={(e) => setCreateValues({ ...createValues, email: e.target.value })}
                required
                placeholder="name@company.com"
              />
            </label>
            <label>
              Role
              <select value={createValues.role} onChange={(e) => setCreateValues({ ...createValues, role: e.target.value as UserRole })}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="small muted" style={{ marginTop: -8 }}>
              {ROLE_OPTIONS.find((r) => r.value === createValues.role)?.hint}
            </p>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create User"}
            </button>
          </form>
        )}

        {loading ? (
          <PageLoader message="Loading users..." />
        ) : users.length === 0 ? (
          <EmptyState title="No users yet" hint="Add a user to give someone else their own login." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === admin?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="name-cell">
                          <Avatar name={u.name || u.email} size={28} />
                          <span style={{ fontWeight: 600 }}>
                            {u.name || <span className="muted">—</span>} {isSelf && <span className="badge badge-navy">You</span>}
                          </span>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge badge-navy">{ROLE_LABEL[u.role]}</span>
                      </td>
                      <td>
                        {u.status === "ACTIVE" ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-error">Disabled</span>
                        )}
                        {u.mustChangePassword && <span className="badge badge-warn" style={{ marginLeft: 6 }}>Temp password</span>}
                      </td>
                      <td className="muted small">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                      <td className="actions">
                        <ActionButton icon="edit" onClick={() => startEdit(u)} disabled={isSelf}>
                          Edit Role
                        </ActionButton>
                        <ActionButton icon="save" onClick={() => handleResetPassword(u)} disabled={resettingId === u.id}>
                          {resettingId === u.id ? "Resetting..." : "Reset Password"}
                        </ActionButton>
                        <ActionButton
                          icon={u.status === "ACTIVE" ? "close" : "view"}
                          onClick={() => setConfirmDisable(u)}
                          disabled={isSelf || togglingId === u.id}
                        >
                          {u.status === "ACTIVE" ? "Disable" : "Enable"}
                        </ActionButton>
                        <ActionButton icon="delete" tone="danger" onClick={() => setConfirmDelete(u)} disabled={isSelf || deletingId === u.id}>
                          {deletingId === u.id ? "Deleting..." : "Delete"}
                        </ActionButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-panel" style={{ height: "auto", maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit role — {editingUser.name || editingUser.email}</h3>
              <button className="btn-link" onClick={() => setEditingUser(null)} aria-label="Close">
                &times;
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body" style={{ overflow: "auto", padding: 20 }}>
                {editError && <div className="alert alert-error">{editError}</div>}
                <label>
                  Role
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="small muted">{ROLE_OPTIONS.find((r) => r.value === editRole)?.hint}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-link" onClick={() => setEditingUser(null)} style={{ margin: 0 }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="modal-overlay">
          <div className="confirm-modal-panel" style={{ width: "min(440px, 100%)" }}>
            <span className="confirm-modal-icon confirm-modal-icon-default">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </span>
            <h3>Temporary password</h3>
            <p>
              For <strong>{tempPassword.email}</strong>. Share this with them now — <strong>it won't be shown again.</strong>{" "}
              They'll be asked to set their own password on first login.
            </p>
            <div className="dropzone-file" style={{ marginTop: 14 }}>
              <div className="dropzone-file-info">
                <div className="dropzone-file-name" style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: "0.03em" }}>
                  {tempPassword.password}
                </div>
              </div>
              <div className="dropzone-file-actions">
                <button type="button" className="btn-action" onClick={copyTempPassword}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button type="button" className="btn-primary" onClick={closeTempPassword}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete user?"
        message={confirmDelete ? `Delete "${confirmDelete.name || confirmDelete.email}"? They will lose access immediately.` : ""}
        loading={deletingId === confirmDelete?.id}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={confirmDisable !== null}
        danger={confirmDisable?.status === "ACTIVE"}
        title={confirmDisable?.status === "ACTIVE" ? "Disable user?" : "Enable user?"}
        message={
          confirmDisable
            ? confirmDisable.status === "ACTIVE"
              ? `"${confirmDisable.name || confirmDisable.email}" will be signed out and unable to log back in until re-enabled.`
              : `"${confirmDisable.name || confirmDisable.email}" will be able to log in again.`
            : ""
        }
        confirmLabel={confirmDisable?.status === "ACTIVE" ? "Disable" : "Enable"}
        loading={togglingId === confirmDisable?.id}
        onConfirm={() => confirmDisable && handleToggleStatus(confirmDisable)}
        onCancel={() => setConfirmDisable(null)}
      />
    </div>
  );
}
