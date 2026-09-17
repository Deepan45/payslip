import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { FileDropzone } from "../components/FileDropzone";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";

interface Company {
  id: string;
  name: string;
  address: string | null;
  logoPath: string | null;
  mobile: string | null;
  officePhone: string | null;
  email: string | null;
  website: string | null;
  pfEstablishmentId: string | null;
  esicEmployerCode: string | null;
  lwfRegistrationNo: string | null;
  epfEmployerTotalRate: number;
  epfEmployerEpsRate: number;
  epfEmployerPfRate: number;
  epfEdliRate: number;
  epfAdminChargeRate: number;
  epfAdminChargeMin: number;
  epsWageCeiling: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  lwfEmployeeRate: number;
  lwfEmployeeMaxAmt: number;
  lwfEmployerRate: number;
  lwfEmployerMaxAmt: number;
  gstin: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfscCode: string | null;
  billingTerms: string | null;
}

type SettingsTab = "profile" | "statutory" | "billing" | "backup";

export function Settings() {
  const { can } = useAuth();
  const canManage = can("settings.manage");
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const logoPreviewUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Statutory filing settings (PF/ESI/LWF) — used by the Statutory Filings page.
  const [pfEstablishmentId, setPfEstablishmentId] = useState("");
  const [esicEmployerCode, setEsicEmployerCode] = useState("");
  const [lwfRegistrationNo, setLwfRegistrationNo] = useState("");
  const [epfEmployerTotalRate, setEpfEmployerTotalRate] = useState(12);
  const [epfEmployerEpsRate, setEpfEmployerEpsRate] = useState(8.33);
  const [epfEmployerPfRate, setEpfEmployerPfRate] = useState(3.67);
  const [epfEdliRate, setEpfEdliRate] = useState(0.5);
  const [epfAdminChargeRate, setEpfAdminChargeRate] = useState(0.5);
  const [epfAdminChargeMin, setEpfAdminChargeMin] = useState(500);
  const [epsWageCeiling, setEpsWageCeiling] = useState(15000);
  const [esiEmployerRate, setEsiEmployerRate] = useState(3.25);
  const [esiWageCeiling, setEsiWageCeiling] = useState(21000);
  const [lwfEmployeeRate, setLwfEmployeeRate] = useState(0.2);
  const [lwfEmployeeMaxAmt, setLwfEmployeeMaxAmt] = useState(35);
  const [lwfEmployerRate, setLwfEmployerRate] = useState(0.4);
  const [lwfEmployerMaxAmt, setLwfEmployerMaxAmt] = useState(70);

  // Billing / invoice settings — printed on generated Client Bill PDFs (see the History page).
  // Informational only: GSTIN is shown but no GST is computed or added to a bill's total.
  const [gstin, setGstin] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [billingTerms, setBillingTerms] = useState("");

  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  function applyCompany(c: Company) {
    setCompany(c);
    setName(c.name);
    setAddress(c.address ?? "");
    setMobile(c.mobile ?? "");
    setOfficePhone(c.officePhone ?? "");
    setEmail(c.email ?? "");
    setWebsite(c.website ?? "");
    setPfEstablishmentId(c.pfEstablishmentId ?? "");
    setEsicEmployerCode(c.esicEmployerCode ?? "");
    setLwfRegistrationNo(c.lwfRegistrationNo ?? "");
    setEpfEmployerTotalRate(c.epfEmployerTotalRate);
    setEpfEmployerEpsRate(c.epfEmployerEpsRate);
    setEpfEmployerPfRate(c.epfEmployerPfRate);
    setEpfEdliRate(c.epfEdliRate);
    setEpfAdminChargeRate(c.epfAdminChargeRate);
    setEpfAdminChargeMin(c.epfAdminChargeMin);
    setEpsWageCeiling(c.epsWageCeiling);
    setEsiEmployerRate(c.esiEmployerRate);
    setEsiWageCeiling(c.esiWageCeiling);
    setLwfEmployeeRate(c.lwfEmployeeRate);
    setLwfEmployeeMaxAmt(c.lwfEmployeeMaxAmt);
    setLwfEmployerRate(c.lwfEmployerRate);
    setLwfEmployerMaxAmt(c.lwfEmployerMaxAmt);
    setGstin(c.gstin ?? "");
    setBankName(c.bankName ?? "");
    setBankAccountNo(c.bankAccountNo ?? "");
    setBankIfscCode(c.bankIfscCode ?? "");
    setBillingTerms(c.billingTerms ?? "");
  }

  useEffect(() => {
    api.get("/company").then((res) => {
      const c = res.data.company as Company | null;
      if (c) applyCompany(c);
    });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await api.put("/company", {
        name, address, mobile, officePhone, email, website,
        pfEstablishmentId, esicEmployerCode, lwfRegistrationNo,
        epfEmployerTotalRate, epfEmployerEpsRate, epfEmployerPfRate, epfEdliRate, epfAdminChargeRate, epfAdminChargeMin, epsWageCeiling,
        esiEmployerRate, esiWageCeiling,
        lwfEmployeeRate, lwfEmployeeMaxAmt, lwfEmployerRate, lwfEmployerMaxAmt,
        gstin, bankName, bankAccountNo, bankIfscCode, billingTerms,
      });
      applyCompany(res.data.company);

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

  async function handleDownloadBackup() {
    setBackupError(null);
    setBackingUp(true);
    try {
      const res = await api.get("/backup", { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `payslip-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setBackupError(apiErrorMessage(err, "Failed to generate backup"));
    } finally {
      setBackingUp(false);
    }
  }

  if (!canManage) {
    return (
      <div>
        <h1>Company Settings</h1>
        <div className="card">
          <EmptyState title="You don't have access to this page" hint="Company settings can only be changed by a Super Admin." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Company Settings</h1>
      <p className="page-subtitle">This information appears in the header of every generated payslip.</p>

      <form onSubmit={handleSave}>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <div className="settings-tabs">
          <button type="button" className={`settings-tab ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>
            <span className="section-title-icon stat-icon-blue">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01" />
              </svg>
            </span>
            Company Profile
          </button>
          <button type="button" className={`settings-tab ${activeTab === "statutory" ? "active" : ""}`} onClick={() => setActiveTab("statutory")}>
            <span className="section-title-icon stat-icon-pink">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4" />
              </svg>
            </span>
            Statutory Filing
          </button>
          <button type="button" className={`settings-tab ${activeTab === "billing" ? "active" : ""}`} onClick={() => setActiveTab("billing")}>
            <span className="section-title-icon stat-icon-aqua">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10h20M6 15h2M2 6h20v12H2z" />
              </svg>
            </span>
            Billing &amp; Invoice
          </button>
          <button type="button" className={`settings-tab ${activeTab === "backup" ? "active" : ""}`} onClick={() => setActiveTab("backup")}>
            <span className="section-title-icon stat-icon-blue">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </span>
            Data Backup
          </button>
        </div>

        <div className="card" style={{ maxWidth: 560, display: activeTab === "profile" ? undefined : "none" }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <span className="section-title-icon stat-icon-blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Company Profile</h2>
          </div>

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

          <label>Logo (PNG/JPG)</label>
          <FileDropzone
            accept={[".png", ".jpg", ".jpeg"]}
            acceptAttr="image/png,image/jpeg"
            maxSizeBytes={2 * 1024 * 1024}
            file={logo}
            onFileSelected={setLogo}
            onRemove={() => setLogo(null)}
            label="Drag & drop a logo"
            thumbnail={logoPreviewUrl ? <img src={logoPreviewUrl} alt="Logo preview" /> : undefined}
          />
          {company?.logoPath && !logo && (
            <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
              <span className="badge badge-success">Logo set</span>
            </p>
          )}
        </div>

        <div className="card" style={{ maxWidth: 560, display: activeTab === "statutory" ? undefined : "none" }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <span className="section-title-icon stat-icon-pink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Statutory Filing Settings</h2>
          </div>
          <p className="small" style={{ marginTop: -8, marginBottom: 16 }}>
            Used to generate the PF ECR file, ESI contribution file, and LWF challan on the{" "}
            <strong>Statutory Filings</strong> page. Rates default to the commonly published current statutory
            rates — verify against the live EPFO/ESIC/LWF portal before a first real filing.
          </p>

          <div className="form-row">
            <label>
              EPFO establishment ID
              <input value={pfEstablishmentId} onChange={(e) => setPfEstablishmentId(e.target.value)} placeholder="e.g. MH/BAN/1234567/000" />
            </label>
            <label>
              ESIC employer code
              <input value={esicEmployerCode} onChange={(e) => setEsicEmployerCode(e.target.value)} placeholder="17-digit code" />
            </label>
          </div>
          <label>
            LWF registration number
            <input value={lwfRegistrationNo} onChange={(e) => setLwfRegistrationNo(e.target.value)} placeholder="Your state LWF registration no." />
          </label>

          <p className="small" style={{ marginTop: 12, marginBottom: 4, fontWeight: 600 }}>PF (EPF/EPS/EDLI) rates</p>
          <div className="form-row">
            <label>
              Employer total rate (%)
              <input type="number" step="0.01" value={epfEmployerTotalRate} onChange={(e) => setEpfEmployerTotalRate(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              Employer EPS rate (%)
              <input type="number" step="0.01" value={epfEmployerEpsRate} onChange={(e) => setEpfEmployerEpsRate(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Employer EPF rate (%)
              <input type="number" step="0.01" value={epfEmployerPfRate} onChange={(e) => setEpfEmployerPfRate(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              EDLI rate (%)
              <input type="number" step="0.01" value={epfEdliRate} onChange={(e) => setEpfEdliRate(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Admin charge rate (%)
              <input type="number" step="0.01" value={epfAdminChargeRate} onChange={(e) => setEpfAdminChargeRate(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              Min. admin charge (₹/month)
              <input type="number" step="0.01" value={epfAdminChargeMin} onChange={(e) => setEpfAdminChargeMin(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              EPS/EDLI wage ceiling (₹)
              <input type="number" step="1" value={epsWageCeiling} onChange={(e) => setEpsWageCeiling(parseFloat(e.target.value) || 0)} />
            </label>
          </div>

          <p className="small" style={{ marginTop: 12, marginBottom: 4, fontWeight: 600 }}>ESI rates</p>
          <div className="form-row">
            <label>
              Employer ESI rate (%)
              <input type="number" step="0.01" value={esiEmployerRate} onChange={(e) => setEsiEmployerRate(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              ESI wage ceiling (₹)
              <input type="number" step="1" value={esiWageCeiling} onChange={(e) => setEsiWageCeiling(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
          <p className="small" style={{ marginTop: -4, marginBottom: 0 }}>
            Employees with gross wages above the ceiling are excluded from ESI filings, even if the uploaded sheet has an ESI amount for them.
          </p>

          <p className="small" style={{ marginTop: 12, marginBottom: 4, fontWeight: 600 }}>
            LWF (% of gross wages, e.g. Tamil Nadu) — each side is capped at its max amount per period
          </p>
          <div className="form-row">
            <label>
              Employee rate (%)
              <input type="number" step="0.01" value={lwfEmployeeRate} onChange={(e) => setLwfEmployeeRate(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              Employee max (₹)
              <input type="number" step="0.01" value={lwfEmployeeMaxAmt} onChange={(e) => setLwfEmployeeMaxAmt(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Employer rate (%)
              <input type="number" step="0.01" value={lwfEmployerRate} onChange={(e) => setLwfEmployerRate(parseFloat(e.target.value) || 0)} />
            </label>
            <label>
              Employer max (₹)
              <input type="number" step="0.01" value={lwfEmployerMaxAmt} onChange={(e) => setLwfEmployerMaxAmt(parseFloat(e.target.value) || 0)} />
            </label>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 560, display: activeTab === "billing" ? undefined : "none" }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <span className="section-title-icon stat-icon-aqua">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10h20M6 15h2M2 6h20v12H2z" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Billing / Invoice Settings</h2>
          </div>
          <p className="small" style={{ marginTop: -8, marginBottom: 16 }}>
            Printed on every generated <strong>Client Bill</strong> (see a sheet's page in History). GSTIN is shown
            for reference only — no GST is computed or added to a bill's total. Bank details and terms appear on the
            bill so the client knows how and when to pay; leave any of these blank to omit that line.
          </p>

          <label>
            GSTIN
            <input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 27AAAAA0000A1Z5" />
          </label>

          <p className="small" style={{ marginTop: 12, marginBottom: 4, fontWeight: 600 }}>Bank details</p>
          <label>
            Bank name
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank, MG Road Branch" />
          </label>
          <div className="form-row">
            <label>
              Account number
              <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} placeholder="Bank account no." />
            </label>
            <label>
              IFSC code
              <input value={bankIfscCode} onChange={(e) => setBankIfscCode(e.target.value)} placeholder="e.g. HDFC0001234" />
            </label>
          </div>

          <label>
            Payment terms
            <textarea
              value={billingTerms}
              onChange={(e) => setBillingTerms(e.target.value)}
              rows={2}
              placeholder="e.g. Payment due within 15 days of invoice date"
            />
          </label>
        </div>

        <div className="card" style={{ maxWidth: 560, display: activeTab === "backup" ? undefined : "none" }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <span className="section-title-icon stat-icon-blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Data Backup</h2>
          </div>
          <p className="small" style={{ marginTop: -8, marginBottom: 16 }}>
            Downloads a single .zip with every table in the database (clients, employees, salary records,
            payslips, bills, users, settings) plus every stored file (logos, generated payslip/bill PDFs,
            uploaded salary sheets). Keep the file somewhere safe — it contains all payroll and personal data.
          </p>
          {backupError && <div className="alert alert-error">{backupError}</div>}
          <button type="button" className="btn-primary" onClick={handleDownloadBackup} disabled={backingUp}>
            {backingUp ? "Preparing backup..." : "Download Backup"}
          </button>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: 20, display: activeTab === "backup" ? "none" : undefined }} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
