import { FormEvent, useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";

interface Company {
  id: string;
  name: string;
  address: string | null;
  logoPath: string | null;
  mobile: string | null;
  officePhone: string | null;
  email: string | null;
  website: string | null;
}

export function Settings() {
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/company").then((res) => {
      const c = res.data.company as Company | null;
      if (c) {
        setCompany(c);
        setName(c.name);
        setAddress(c.address ?? "");
        setMobile(c.mobile ?? "");
        setOfficePhone(c.officePhone ?? "");
        setEmail(c.email ?? "");
        setWebsite(c.website ?? "");
      }
    });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await api.put("/company", { name, address, mobile, officePhone, email, website });
      setCompany(res.data.company);

      if (logo) {
        const formData = new FormData();
        formData.append("logo", logo);
        const logoRes = await api.post("/company/logo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setCompany(logoRes.data.company);
        setLogo(null);
      }

      setMessage("Company settings saved.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Company Settings</h1>
      <p className="page-subtitle">This information appears in the header of every generated payslip.</p>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Company Profile</h2>
        </div>

        <form onSubmit={handleSave}>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <label>
            Company name
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Himalayan Inc" />
          </label>

          <label>
            Address
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Registered office address" />
          </label>

          <div className="form-row">
            <label>
              Mobile
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </label>
            <label>
              Office phone
              <input value={officePhone} onChange={(e) => setOfficePhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </label>
          </div>

          <div className="form-row">
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" />
            </label>
            <label>
              Website
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.company.com" />
            </label>
          </div>

          <label>
            Logo (PNG/JPG)
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
          </label>
          {company?.logoPath && (
            <p className="small" style={{ marginTop: -8 }}>
              <span className="badge badge-success">Logo set</span>
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
