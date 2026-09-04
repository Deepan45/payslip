import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Pagination } from "../components/Pagination";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { PageLoader } from "../components/PageLoader";

const PAGE_SIZE = 25;

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  department: string | null;
  currentClient: { id: string; name: string } | null;
}

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get("/employees")
      .then((res) => setEmployees(res.data.employees))
      .finally(() => setLoading(false));
  }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.department ?? "").toLowerCase().includes(q) ||
      (e.currentClient?.name ?? "").toLowerCase().includes(q)
    );
  });

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <h1>Employees</h1>

      <div className="card">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <input
            type="search"
            placeholder="Search by name, ID, department, or site..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ maxWidth: 360, margin: 0 }}
          />
          {!loading && <span className="muted small">{filtered.length} of {employees.length} employees</span>}
        </div>

        {loading ? (
          <PageLoader message="Loading employees..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No employees found" hint="Upload a salary sheet to add employees automatically." />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Department</th>
                    <th>Current Site</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((e) => (
                    <tr key={e.id}>
                      <td>{e.employeeCode}</td>
                      <td>
                        <div className="name-cell">
                          <Avatar name={e.name} size={26} />
                          <span style={{ fontWeight: 600 }}>{e.name}</span>
                        </div>
                      </td>
                      <td>{e.designation ?? "-"}</td>
                      <td>{e.department ?? "-"}</td>
                      <td>{e.currentClient?.name ?? "-"}</td>
                      <td>
                        <Link to={`/employees/${e.id}`} className="btn-action">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                          View history
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
