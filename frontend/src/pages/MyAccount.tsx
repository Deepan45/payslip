import { FormEvent, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { useAuth, UserRole } from "../context/AuthContext";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  PAYROLL_MANAGER: "Payroll Manager",
  ACCOUNTANT: "Accountant",
  VIEWER: "Viewer",
};

export function MyAccount() {
  const { admin, refreshMe } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      await refreshMe();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to change password"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>My Account</h1>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-violet">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Profile</h2>
        </div>
        <div className="detail-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div>
            <strong>Name</strong>
            {admin?.name || <span className="muted">Not set</span>}
          </div>
          <div>
            <strong>Email</strong>
            {admin?.email}
          </div>
          <div>
            <strong>Role</strong>
            <span className="badge badge-navy">{admin ? ROLE_LABEL[admin.role] : ""}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Change Password</h2>
        </div>

        {admin?.mustChangePassword && (
          <div className="alert alert-warning">You're using a temporary password. Set a new one to continue.</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus />
          </label>
          <label>
            New password
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </label>
          <label>
            Confirm new password
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
