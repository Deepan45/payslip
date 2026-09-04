import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";

interface Sheet {
  id: string;
  fileName: string;
  periodMonth: number;
  periodYear: number;
  uploadedAt: string;
  recordCount: number;
  client: { id: string; name: string };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function History() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/history")
      .then((res) => setSheets(res.data.sheets))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Upload History</h1>
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-title-icon stat-icon-violet">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2" />
            </svg>
          </span>
          <h2 style={{ margin: 0 }}>All Uploaded Sheets</h2>
        </div>

        {loading ? (
          <PageLoader message="Loading history..." />
        ) : sheets.length === 0 ? (
          <EmptyState title="No salary sheets uploaded yet" hint="Uploads you make will show up here, organized by pay period and client." />
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
                {sheets.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>
                      {MONTH_NAMES[s.periodMonth - 1]} {s.periodYear}
                    </td>
                    <td>{s.client.name}</td>
                    <td className="muted">{s.fileName}</td>
                    <td className="num">{s.recordCount}</td>
                    <td className="muted small">{new Date(s.uploadedAt).toLocaleString()}</td>
                    <td>
                      <Link to={`/history/${s.id}`} className="btn-action">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                        View
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
