import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { ActionButton } from "../components/ActionButton";
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
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/employees")
      .then((res) => setEmployees(res.data.employees))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(emp: Employee) {
    if (!window.confirm(`Delete ${emp.name} (${emp.employeeCode})? This only works if they have no payslip or advance history.`)) return;
    setError(null);
    setDeletingId(emp.id);
    try {
      await api.delete(`/employees/${emp.id}`);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(emp.id);
        return next;
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete employee"));
    } finally {
      setDeletingId(null);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage(rows: Employee[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected employee(s)? Any with payslip or advance history will be skipped.`)) return;
    setError(null);
    setBulkDeleting(true);
    try {
      const res = await api.post("/employees/delete", { ids: Array.from(selected) });
      const { deleted, blocked } = res.data as { deleted: string[]; blocked: { id: string; error: string }[] };
      setEmployees((prev) => prev.filter((e) => !deleted.includes(e.id)));
      setSelected(new Set());
      if (blocked.length > 0) {
        setError(`Deleted ${deleted.length}. Skipped ${blocked.length}: ${blocked.map((b) => b.error).join(" ")}`);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete selected employees"));
    } finally {
      setBulkDeleting(false);
    }
  }

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
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {selected.size > 0 && (
              <ActionButton icon="delete" tone="danger" disabled={bulkDeleting} onClick={handleDeleteSelected}>
                {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Selected`}
              </ActionButton>
            )}
            {!loading && <span className="muted small">{filtered.length} of {employees.length} employees</span>}
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

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
                    <th style={{ width: 32 }}>
                      <input type="checkbox" checked={allOnPageSelected} onChange={(ev) => toggleAllOnPage(pageRows, ev.target.checked)} />
                    </th>
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
                      <td>
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} />
                      </td>
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
                      <td className="actions">
                        <Link to={`/employees/${e.id}`} className="btn-action">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                          View history
                        </Link>
                        <ActionButton icon="delete" tone="danger" disabled={deletingId === e.id} onClick={() => handleDelete(e)}>
                          {deletingId === e.id ? "Deleting..." : "Delete"}
                        </ActionButton>
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
