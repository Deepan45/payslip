import { useEffect, useState } from "react";
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

interface ReportRow {
  client: { id: string; name: string };
  sheetId: string;
  employeeCount: number;
  basic: number;
  hra: number;
  grossEarnings: number;
  esi: number;
  epf: number;
  lwf: number;
  advance: number;
  totalDeductions: number;
  netPay: number;
}

function formatMoney(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Reports() {
  const now = new Date();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [clientId, setClientId] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [grandTotal, setGrandTotal] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/clients").then((res) => setClients(res.data.clients));
  }, []);

  function load() {
    setLoading(true);
    api
      .get("/reports/summary", { params: { periodMonth: month, periodYear: year, clientId: clientId || undefined } })
      .then((res) => {
        setRows(res.data.rows);
        setGrandTotal(res.data.grandTotal);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [month, year, clientId]);

  return (
    <div>
      <h1>Reports</h1>
      <p className="page-subtitle">
        Wage cost and employee-side ESI/EPF/LWF contribution totals per client site, for a pay period. This totals
        what employees had deducted — it does not include the employer's own statutory contribution, which isn't
        present in the uploaded wage sheets.
      </p>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-pink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>Payroll Summary</h2>
        </div>

        <div className="form-row" style={{ maxWidth: 560, marginBottom: 4 }}>
          <label>
            Month
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} placeholder="e.g. 2026" />
          </label>
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
        </div>

        {loading ? (
          <PageLoader message="Loading report..." />
        ) : rows.length === 0 ? (
          <EmptyState title="No salary sheets for this period" hint="Try a different month/year, or upload a sheet for this period first." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="num">Employees</th>
                  <th className="num">Basic</th>
                  <th className="num">HRA</th>
                  <th className="num">Gross</th>
                  <th className="num">ESI</th>
                  <th className="num">EPF</th>
                  <th className="num">LWF</th>
                  <th className="num">Advance</th>
                  <th className="num">Total Ded.</th>
                  <th className="num">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sheetId}>
                    <td style={{ fontWeight: 600 }}>{r.client.name}</td>
                    <td className="num">{r.employeeCount}</td>
                    <td className="num">{formatMoney(r.basic)}</td>
                    <td className="num">{formatMoney(r.hra)}</td>
                    <td className="num">{formatMoney(r.grossEarnings)}</td>
                    <td className="num">{formatMoney(r.esi)}</td>
                    <td className="num">{formatMoney(r.epf)}</td>
                    <td className="num">{formatMoney(r.lwf)}</td>
                    <td className="num">{formatMoney(r.advance)}</td>
                    <td className="num">{formatMoney(r.totalDeductions)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{formatMoney(r.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              {grandTotal && rows.length > 1 && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{grandTotal.employeeCount}</td>
                    <td className="num">{formatMoney(grandTotal.basic)}</td>
                    <td className="num">{formatMoney(grandTotal.hra)}</td>
                    <td className="num">{formatMoney(grandTotal.grossEarnings)}</td>
                    <td className="num">{formatMoney(grandTotal.esi)}</td>
                    <td className="num">{formatMoney(grandTotal.epf)}</td>
                    <td className="num">{formatMoney(grandTotal.lwf)}</td>
                    <td className="num">{formatMoney(grandTotal.advance)}</td>
                    <td className="num">{formatMoney(grandTotal.totalDeductions)}</td>
                    <td className="num">{formatMoney(grandTotal.netPay)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
