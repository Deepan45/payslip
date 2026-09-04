import { useEffect, useState } from "react";
import { usePortalAuth } from "../../context/PortalAuthContext";
import { portalApi } from "../../api/portalClient";
import { PageLoader } from "../../components/PageLoader";
import { EmptyState } from "../../components/EmptyState";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Record {
  id: string;
  netPay: number;
  sheet: { periodMonth: number; periodYear: number; client: { name: string } };
  payslip: { id: string } | null;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function PortalPayslips() {
  const { employee, logout } = usePortalAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi
      .get("/portal/payslips")
      .then((res) => setRecords(res.data.records))
      .finally(() => setLoading(false));
  }, []);

  async function download(payslipId: string, label: string) {
    const res = await portalApi.get(`/portal/payslips/${payslipId}/download`, { responseType: "blob" });
    saveBlob(res.data, `Payslip-${label}.pdf`);
  }

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-brand">My Payslips</div>
        <div className="navbar-links" />
        <div className="navbar-user">
          <span>{employee?.name}</span>
          <button onClick={logout} className="btn-link">
            Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <h1>Payslip History</h1>
        <div className="card">
          {loading ? (
            <PageLoader message="Loading payslips..." />
          ) : records.length === 0 ? (
            <EmptyState title="No payslips yet" hint="Your payslips will show up here once a payroll batch is processed." />
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
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>
                        {MONTH_NAMES[r.sheet.periodMonth - 1]} {r.sheet.periodYear}
                      </td>
                      <td>{r.sheet.client.name}</td>
                      <td className="num">₹ {r.netPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>
                        {r.payslip ? (
                          <button
                            className="btn-link"
                            onClick={() => download(r.payslip!.id, `${r.sheet.periodMonth}-${r.sheet.periodYear}`)}
                          >
                            Download
                          </button>
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
      </main>
    </div>
  );
}
