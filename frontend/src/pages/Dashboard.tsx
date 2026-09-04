import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { PayrollByClientChart } from "../components/PayrollByClientChart";
import { DonutChart } from "../components/DonutChart";
import { StatCard } from "../components/StatCard";
import { EmptyState } from "../components/EmptyState";
import { ActionButton } from "../components/ActionButton";
import { PageLoader } from "../components/PageLoader";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ClientRow {
  clientId: string;
  clientName: string;
  netPay: number;
  grossEarnings: number;
  employeeCount: number;
  esi: number;
  epf: number;
  lwf: number;
  advance: number;
}

interface Summary {
  totalEmployees: number;
  totalClients: number;
  totalSheets: number;
  latestPeriod: { month: number; year: number } | null;
  latestTotals: { grossEarnings: number; netPay: number; employeeCount: number; esi: number; epf: number; lwf: number; advance: number };
  payrollByClient: ClientRow[];
  outstandingAdvances: number;
  recentUploads: {
    id: string;
    clientName: string;
    periodMonth: number;
    periodYear: number;
    fileName: string;
    recordCount: number;
    uploadedAt: string;
  }[];
}

function formatMoney(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then((res) => setSummary(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader message="Loading dashboard..." />;
  if (!summary) return <p className="alert alert-error">Could not load dashboard.</p>;

  const periodLabel = summary.latestPeriod
    ? `${MONTH_NAMES[summary.latestPeriod.month - 1]} ${summary.latestPeriod.year}`
    : null;

  const avgNetPay = summary.latestTotals.employeeCount > 0 ? summary.latestTotals.netPay / summary.latestTotals.employeeCount : 0;
  const statutoryTotal = summary.latestTotals.esi + summary.latestTotals.epf + summary.latestTotals.lwf;

  // Stable sort (by client name) for the donut so colors track the same client across renders/reloads.
  const employeesByClient = [...summary.payrollByClient]
    .sort((a, b) => a.clientName.localeCompare(b.clientName))
    .map((r) => ({ id: r.clientId, label: r.clientName, value: r.employeeCount }));

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="stat-grid stat-grid-4">
        <StatCard icon="employees" color="blue" value={String(summary.totalEmployees)} label="Employees" />
        <StatCard icon="clients" color="aqua" value={String(summary.totalClients)} label="Client Sites" />
        <StatCard icon="sheets" color="amber" value={String(summary.totalSheets)} label="Salary Sheets Uploaded" />
        <StatCard
          icon="advance"
          color={summary.outstandingAdvances > 0 ? "red" : "green"}
          value={formatMoney(summary.outstandingAdvances)}
          label="Outstanding Advances"
        />
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard icon="wallet" color="violet" value={formatMoney(avgNetPay)} label={`Avg. Net Pay / Employee${periodLabel ? ` — ${periodLabel}` : ""}`} />
        <StatCard icon="shield" color="pink" value={formatMoney(statutoryTotal)} label="Statutory Deductions (ESI + EPF + LWF)" />
        <StatCard icon="trend" color="green" value={formatMoney(summary.latestTotals.grossEarnings)} label="Gross Payroll — Latest Period" />
      </div>

      <div className="dashboard-grid">
        <div>
          <div className="card">
            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Net Payroll by Client{periodLabel ? ` — ${periodLabel}` : ""}</h2>
              <Link to="/reports" className="btn-link" style={{ margin: 0 }}>
                Full report →
              </Link>
            </div>
            {summary.payrollByClient.length === 0 ? (
              <EmptyState title="No payroll data yet" hint="Upload a salary sheet to see payroll cost broken down by client." />
            ) : (
              <>
                <PayrollByClientChart rows={summary.payrollByClient} />
                <div className="chart-totals">
                  <span>
                    <strong>{summary.latestTotals.employeeCount}</strong> employees paid
                  </span>
                  <span>
                    Gross <strong>{formatMoney(summary.latestTotals.grossEarnings)}</strong>
                  </span>
                  <span>
                    Net <strong>{formatMoney(summary.latestTotals.netPay)}</strong>
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h2>Recent Uploads</h2>
            {summary.recentUploads.length === 0 ? (
              <EmptyState title="No salary sheets uploaded yet" />
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Client</th>
                      <th>File</th>
                      <th className="num">Employees</th>
                      <th>Uploaded</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentUploads.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>
                          {MONTH_NAMES[s.periodMonth - 1]} {s.periodYear}
                        </td>
                        <td>{s.clientName}</td>
                        <td className="muted">{s.fileName}</td>
                        <td className="num">{s.recordCount}</td>
                        <td className="muted small">{new Date(s.uploadedAt).toLocaleString()}</td>
                        <td>
                          <ActionButton icon="view" onClick={() => navigate(`/history/${s.id}`)}>
                            View
                          </ActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h2>Employees by Client</h2>
            <DonutChart slices={employeesByClient} centerLabel="employees" />
          </div>

          <div className="card">
            <h2>Quick Actions</h2>
            <div className="quick-actions">
              <Link to="/upload" className="btn-primary">
                + Upload Salary Sheet
              </Link>
              <Link to="/clients" className="btn-link">
                Manage Clients
              </Link>
              <Link to="/advances" className="btn-link">
                Advance Ledger
              </Link>
              <Link to="/reports" className="btn-link">
                View Reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
