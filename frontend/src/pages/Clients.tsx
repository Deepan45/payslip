import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";

interface ClientRow {
  id: string;
  name: string;
  address: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  _count: { employees: number; salarySheets: number };
  columnProfile: { updatedAt: string } | null;
}

export function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/clients")
      .then((res) => setClients(res.data.clients))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/clients", { name, address, contactPerson, contactPhone });
      setName("");
      setAddress("");
      setContactPerson("");
      setContactPhone("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create client"));
    } finally {
      setSaving(false);
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
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ Add Client"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, maxWidth: 480 }}>
            {error && <div className="alert alert-error">{error}</div>}
            <label>
              Client / Site name
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Glen Appliances" />
            </label>
            <div className="form-row">
              <label>
                Contact person
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="e.g. Rakesh Sharma" />
              </label>
              <label>
                Contact phone
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </label>
            </div>
            <label>
              Address
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Site / plant address" />
            </label>
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
                  <th>Name</th>
                  <th>Contact</th>
                  <th className="num">Employees</th>
                  <th className="num">Sheets Uploaded</th>
                  <th>Column Mapping</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="name-cell">
                        <Avatar name={c.name} size={28} />
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                      </div>
                    </td>
                    <td>{c.contactPerson ?? "-"}</td>
                    <td className="num">{c._count.employees}</td>
                    <td className="num">{c._count.salarySheets}</td>
                    <td>
                      {c.columnProfile ? (
                        <span className="badge badge-success">Configured</span>
                      ) : (
                        <span className="badge badge-warn">Not yet mapped</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/upload?clientId=${c.id}`} className="btn-action">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 20h16" />
                        </svg>
                        Upload
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
