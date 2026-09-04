import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { downloadPayslip } from "../api/payslip";
import { PayslipPreviewModal } from "../components/PayslipPreviewModal";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { ActionButton } from "../components/ActionButton";
import { PageLoader } from "../components/PageLoader";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SalaryRecord {
  id: string;
  netPay: number;
  sheet: { id: string; periodMonth: number; periodYear: number; client: { name: string } };
  payslip: { id: string } | null;
}

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  name: string;
  guardianName: string | null;
  designation: string | null;
  department: string | null;
  bankAccount: string | null;
  ifscCode: string | null;
  uanNo: string | null;
  esiNo: string | null;
  email: string | null;
  phone: string | null;
  currentClient: { id: string; name: string } | null;
  portalAccessEnabled: boolean;
  salaryRecords: SalaryRecord[];
}

export function EmployeeDetail() {
  const { id } = useParams();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [preview, setPreview] = useState<{ payslipId: string; title: string } | null>(null);

  function load() {
    if (!id) return;
    api
      .get(`/employees/${id}`)
      .then((res) => {
        setEmployee(res.data.employee);
        setEmail(res.data.employee.email ?? "");
        setPhone(res.data.employee.phone ?? "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      await api.put(`/employees/${id}`, { email, phone });
      setEditing(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  async function handleGrantAccess() {
    if (!id) return;
    setGrantingAccess(true);
    try {
      const res = await api.post(`/employees/${id}/portal-access`);
      setTempPassword(res.data.temporaryPassword);
      load();
    } finally {
      setGrantingAccess(false);
    }
  }

  if (loading) return <PageLoader message="Loading employee..." />;
  if (!employee) return <p className="alert alert-error">Employee not found.</p>;

  return (
    <div>
      <Link to="/employees" className="back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Employees
      </Link>
      <div className="profile-header">
        <span className="profile-header-avatar-ring">
          <span className="profile-header-avatar-ring-inner">
            <Avatar name={employee.name} size={56} />
          </span>
        </span>
        <div className="profile-header-body">
          <h1 className="profile-header-name">{employee.name}</h1>
          <div className="profile-header-meta">
            <span className="badge badge-navy">ID {employee.employeeCode}</span>
            {employee.currentClient && <span className="badge badge-navy">{employee.currentClient.name}</span>}
            {employee.designation && <span className="badge badge-navy">{employee.designation}</span>}
            {employee.portalAccessEnabled ? (
              <span className="badge badge-success">Portal access enabled</span>
            ) : (
              <span className="badge badge-warn">Portal access not enabled</span>
            )}
          </div>
        </div>
        <div className="profile-header-actions">
          {employee.salaryRecords[0]?.payslip && (
            <ActionButton
              icon="preview"
              onClick={() =>
                setPreview({
                  payslipId: employee.salaryRecords[0].payslip!.id,
                  title: `${employee.name} — ${MONTH_NAMES[employee.salaryRecords[0].sheet.periodMonth - 1]} ${employee.salaryRecords[0].sheet.periodYear}`,
                })
              }
            >
              Latest Payslip
            </ActionButton>
          )}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Employee Details</h2>
        </div>
        <div className="detail-grid">
          <div>
            <strong>Employee ID</strong>
            <div>{employee.employeeCode}</div>
          </div>
          <div>
            <strong>Guardian's Name</strong>
            <div>{employee.guardianName ?? "-"}</div>
          </div>
          <div>
            <strong>Designation</strong>
            <div>{employee.designation ?? "-"}</div>
          </div>
          <div>
            <strong>Department</strong>
            <div>{employee.department ?? "-"}</div>
          </div>
          <div>
            <strong>Current Site</strong>
            <div>{employee.currentClient?.name ?? "-"}</div>
          </div>
          <div>
            <strong>Bank A/c No</strong>
            <div>{employee.bankAccount ?? "-"}</div>
          </div>
          <div>
            <strong>IFSC Code</strong>
            <div>{employee.ifscCode ?? "-"}</div>
          </div>
          <div>
            <strong>UAN No</strong>
            <div>{employee.uanNo ?? "-"}</div>
          </div>
          <div>
            <strong>ESI No</strong>
            <div>{employee.esiNo ?? "-"}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div className="section-title">
            <span className="section-title-icon stat-icon-violet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Contact & Portal Access</h2>
          </div>
          {!editing && (
            <ActionButton icon="edit" onClick={() => setEditing(true)}>
              Edit contact info
            </ActionButton>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveContact} style={{ maxWidth: 420 }}>
            {error && <div className="alert alert-error">{error}</div>}
            <label>
              Email (for payslip delivery)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@example.com" />
            </label>
            <label>
              Phone (for WhatsApp delivery, with country code e.g. +91...)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </label>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn-link" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="detail-grid" style={{ marginBottom: 16 }}>
            <div>
              <strong>Email</strong>
              <div>{employee.email ?? "-"}</div>
            </div>
            <div>
              <strong>Phone</strong>
              <div>{employee.phone ?? "-"}</div>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 4 }}>
          <p className="small">
            Portal access:{" "}
            {employee.portalAccessEnabled ? (
              <span className="badge badge-success">Enabled</span>
            ) : (
              <span className="badge badge-navy">Not enabled</span>
            )}
          </p>
          <button className="btn-primary" onClick={handleGrantAccess} disabled={grantingAccess}>
            {grantingAccess ? "Generating..." : employee.portalAccessEnabled ? "Reset Portal Password" : "Enable Portal Access"}
          </button>
          {tempPassword && (
            <p className="alert alert-success" style={{ marginTop: 10 }}>
              Temporary password: <strong>{tempPassword}</strong> — share this with the employee now, it won't be
              shown again. They log in at <code>/portal/login</code> with Employee Code {employee.employeeCode}.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Payslip History</h2>
        </div>
        {employee.salaryRecords.length === 0 ? (
          <EmptyState title="No salary records yet" hint="Payslips generated for this employee will appear here." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Site</th>
                  <th className="num">Net Pay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employee.salaryRecords.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>
                      {MONTH_NAMES[r.sheet.periodMonth - 1]} {r.sheet.periodYear}
                    </td>
                    <td>{r.sheet.client.name}</td>
                    <td className="num">&#8377; {r.netPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td>
                      {r.payslip ? (
                        <>
                          <ActionButton
                            icon="preview"
                            onClick={() =>
                              setPreview({
                                payslipId: r.payslip!.id,
                                title: `${employee.name} — ${MONTH_NAMES[r.sheet.periodMonth - 1]} ${r.sheet.periodYear}`,
                              })
                            }
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
        )}
      </div>

      {preview && <PayslipPreviewModal payslipId={preview.payslipId} title={preview.title} onClose={() => setPreview(null)} />}
    </div>
  );
}
