import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ClientOption {
  id: string;
  name: string;
}

interface Sheet {
  id: string;
  fileName: string;
  periodMonth: number;
  periodYear: number;
  uploadedAt: string;
  recordCount: number;
  client: { id: string; name: string };
}

export function Payslips() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [clientId, setClientId] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/clients").then((res) => setClients(res.data.clients));
    api.get("/history/meta/years").then((res) => setYears(res.data.years));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get("/history", { params: { clientId: clientId || undefined, periodYear: year || undefined, periodMonth: month || undefined } })
      .then((res) => setSheets(res.data.sheets))
      .finally(() => setLoading(false));
  }, [clientId, year, month]);

  // Group by client, then by year, for a browsable client-wise / year-wise / month-wise layout.
  const byClient = new Map<string, { clientName: string; sheets: Sheet[] }>();
  for (const s of sheets) {
    const bucket = byClient.get(s.client.id) ?? { clientName: s.client.name, sheets: [] };
    bucket.sheets.push(s);
    byClient.set(s.client.id, bucket);
  }
  const clientGroups = Array.from(byClient.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));

  function clearFilters() {
    setClientId("");
    setYear("");
    setMonth("");
  }

  const hasFilters = clientId || year || month;

  return (
    <div>
      <h1>Payslips</h1>
      <p className="page-subtitle">Browse every generated payslip batch, organized by client, year, and month.</p>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Filter</h2>
        </div>

        <div className="form-row" style={{ maxWidth: 640, marginBottom: hasFilters ? 8 : 4 }}>
          <label>
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All months</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasFilters && (
          <button className="btn-link" onClick={clearFilters} style={{ margin: 0 }}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <PageLoader message="Loading payslips..." />
      ) : clientGroups.length === 0 ? (
        <div className="card">
          <EmptyState title="No payslip batches found" hint="Try different filters, or upload a salary sheet to generate payslips." />
        </div>
      ) : (
        clientGroups.map((group) => (
          <div className="card" key={group.clientName}>
            <div className="section-title" style={{ marginBottom: 14 }}>
              <span className="section-title-icon stat-icon-aqua">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-6h6v6M9 12h.01M15 12h.01M9 8h.01M15 8h.01" />
                </svg>
              </span>
              <h2 style={{ margin: 0 }}>{group.clientName}</h2>
            </div>

            <div className="payslip-batch-grid">
              {group.sheets
                .sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth)
                .map((s) => (
                  <Link to={`/history/${s.id}`} key={s.id} className="payslip-batch-card">
                    <div className="payslip-batch-period">
                      {MONTH_NAMES[s.periodMonth - 1]} {s.periodYear}
                    </div>
                    <div className="muted small">{s.recordCount} payslips</div>
                    <div className="muted small">{new Date(s.uploadedAt).toLocaleDateString()}</div>
                  </Link>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
