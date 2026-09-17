import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { ActionButton } from "../components/ActionButton";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMoney(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Skipped {
  employeeCode: string;
  name: string;
  reason: string;
}

interface PfSummary {
  memberCount: number;
  skipped: Skipped[];
  totalEpfWages: number;
  totalEpsWages: number;
  totalEdliWages: number;
  totalEmployeeEpf: number;
  totalEmployerEps: number;
  totalEmployerEpfDiff: number;
  totalEdli: number;
  totalAdminCharge: number;
  grandTotal: number;
}

interface EsiSummary {
  memberCount: number;
  skipped: Skipped[];
  totalEmployeeEsi: number;
  totalEmployerEsi: number;
  grandTotal: number;
}

interface LwfSummary {
  memberCount: number;
  totalEmployee: number;
  totalEmployer: number;
  grandTotal: number;
}

interface LwfWorkerFileSummary {
  summary: { total: number; complete: number; incomplete: number };
  incompleteEmployees: { employeeCode: string; name: string; missing: string[] }[];
}

async function downloadFile(url: string, params: Record<string, unknown>, filename: string) {
  const res = await api.get(url, { params, responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export function Statutory() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [pf, setPf] = useState<PfSummary | null>(null);
  const [pfEstablishmentId, setPfEstablishmentId] = useState<string | null>(null);
  const [esi, setEsi] = useState<EsiSummary | null>(null);
  const [esicEmployerCode, setEsicEmployerCode] = useState<string | null>(null);
  const [lwf, setLwf] = useState<LwfSummary | null>(null);
  const [lwfRegistrationNo, setLwfRegistrationNo] = useState<string | null>(null);

  const [lwfWorkerFile, setLwfWorkerFile] = useState<LwfWorkerFileSummary | null>(null);
  const [lwfWorkerFileLoading, setLwfWorkerFileLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const monthLabel = MONTH_NAMES[month - 1];
  const period = { periodMonth: month, periodYear: year };

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get("/statutory/pf/summary", { params: period }),
      api.get("/statutory/esi/summary", { params: period }),
      api.get("/statutory/lwf/summary", { params: period }),
    ])
      .then(([pfRes, esiRes, lwfRes]) => {
        setPf(pfRes.data.summary);
        setPfEstablishmentId(pfRes.data.pfEstablishmentId);
        setEsi(esiRes.data.summary);
        setEsicEmployerCode(esiRes.data.esicEmployerCode);
        setLwf(lwfRes.data.summary);
        setLwfRegistrationNo(lwfRes.data.lwfRegistrationNo);
      })
      .catch((err) => setError(apiErrorMessage(err, "Failed to load statutory summary")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [month, year]);

  useEffect(() => {
    setLwfWorkerFileLoading(true);
    api
      .get("/statutory/lwf/worker-data-summary")
      .then((res) => setLwfWorkerFile(res.data))
      .finally(() => setLwfWorkerFileLoading(false));
  }, []);

  async function handleDownloadWorkerFile() {
    setDownloading("lwf-worker-file");
    try {
      await downloadFile("/statutory/lwf/worker-data-file", {}, `LWF-Worker-Data-File-${new Date().getFullYear()}.xlsx`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to download file"));
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownload(key: string, url: string, filename: string) {
    setDownloading(key);
    try {
      await downloadFile(url, period, filename);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to download file"));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <h1>Statutory Filings</h1>
      <p className="page-subtitle">
        PF (EPFO ECR), ESI, and LWF filing files for a pay period, built from that period's uploaded salary sheets
        across all clients. Field layouts follow the commonly published EPFO/ESIC/state LWF formats — verify
        against the live portal before a first real filing.
      </p>

      <div className="card" style={{ maxWidth: 900 }}>
        <div className="form-row" style={{ maxWidth: 400, marginBottom: 4 }}>
          <label>
            Month
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} placeholder="e.g. 2026" />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      {/* PF */}
      <div className="card" style={{ maxWidth: 900, marginTop: 20 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>PF — EPFO ECR</h2>
          <ActionButton
            icon="download"
            disabled={loading || !pf || pf.memberCount === 0 || downloading === "pf"}
            onClick={() => handleDownload("pf", "/statutory/pf/ecr-file", `PF-ECR-${monthLabel}-${year}.txt`)}
          >
            {downloading === "pf" ? "Downloading..." : "Download ECR file"}
          </ActionButton>
        </div>
        {!pfEstablishmentId && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            No EPFO establishment ID set — add it in Settings before filing.
          </div>
        )}
        {pf && (
          <>
            <p className="small">Members: {pf.memberCount}</p>
            <div className="table-container">
              <table>
                <tbody>
                  <tr><td>EPF wages (total)</td><td className="num">{formatMoney(pf.totalEpfWages)}</td></tr>
                  <tr><td>EPS wages (total, capped)</td><td className="num">{formatMoney(pf.totalEpsWages)}</td></tr>
                  <tr><td>Employee EPF contribution</td><td className="num">{formatMoney(pf.totalEmployeeEpf)}</td></tr>
                  <tr><td>Employer EPS contribution</td><td className="num">{formatMoney(pf.totalEmployerEps)}</td></tr>
                  <tr><td>Employer EPF contribution (diff)</td><td className="num">{formatMoney(pf.totalEmployerEpfDiff)}</td></tr>
                  <tr><td>EDLI</td><td className="num">{formatMoney(pf.totalEdli)}</td></tr>
                  <tr><td>Admin charges</td><td className="num">{formatMoney(pf.totalAdminCharge)}</td></tr>
                  <tr><td style={{ fontWeight: 700 }}>Grand total to remit</td><td className="num" style={{ fontWeight: 700 }}>{formatMoney(pf.grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            {pf.skipped.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: 12 }}>
                {pf.skipped.length} employee(s) skipped — missing UAN: {pf.skipped.map((s) => `${s.name} (${s.employeeCode})`).join(", ")}
              </div>
            )}
          </>
        )}
      </div>

      {/* ESI */}
      <div className="card" style={{ maxWidth: 900, marginTop: 20 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>ESI — Contribution File</h2>
          <ActionButton
            icon="download"
            disabled={loading || !esi || esi.memberCount === 0 || downloading === "esi"}
            onClick={() => handleDownload("esi", "/statutory/esi/file", `ESI-Contribution-${monthLabel}-${year}.csv`)}
          >
            {downloading === "esi" ? "Downloading..." : "Download ESI file"}
          </ActionButton>
        </div>
        {!esicEmployerCode && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            No ESIC employer code set — add it in Settings before filing.
          </div>
        )}
        {esi && (
          <>
            <p className="small">Members: {esi.memberCount}</p>
            <div className="table-container">
              <table>
                <tbody>
                  <tr><td>Employee ESI contribution</td><td className="num">{formatMoney(esi.totalEmployeeEsi)}</td></tr>
                  <tr><td>Employer ESI contribution</td><td className="num">{formatMoney(esi.totalEmployerEsi)}</td></tr>
                  <tr><td style={{ fontWeight: 700 }}>Grand total to remit</td><td className="num" style={{ fontWeight: 700 }}>{formatMoney(esi.grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            {esi.skipped.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: 12 }}>
                {esi.skipped.length} employee(s) skipped — missing ESI number: {esi.skipped.map((s) => `${s.name} (${s.employeeCode})`).join(", ")}
              </div>
            )}
          </>
        )}
      </div>

      {/* LWF */}
      <div className="card" style={{ maxWidth: 900, marginTop: 20 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>LWF — Challan</h2>
          <ActionButton
            icon="download"
            disabled={loading || !lwf || lwf.memberCount === 0 || downloading === "lwf"}
            onClick={() => handleDownload("lwf", "/statutory/lwf/challan-file", `LWF-Challan-${monthLabel}-${year}.xlsx`)}
          >
            {downloading === "lwf" ? "Downloading..." : "Download LWF challan"}
          </ActionButton>
        </div>
        <p className="small">
          LWF is typically remitted half-yearly or annually depending on your state's cycle, not every month —
          only download this for whichever month your establishment's LWF contribution is actually due.
        </p>
        {!lwfRegistrationNo && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            No LWF registration number set — add it in Settings before filing.
          </div>
        )}
        {lwf && (
          <div className="table-container">
            <table>
              <tbody>
                <tr><td>Members</td><td className="num">{lwf.memberCount}</td></tr>
                <tr><td>Employee contribution (total)</td><td className="num">{formatMoney(lwf.totalEmployee)}</td></tr>
                <tr><td>Employer contribution (total)</td><td className="num">{formatMoney(lwf.totalEmployer)}</td></tr>
                <tr><td style={{ fontWeight: 700 }}>Grand total to remit</td><td className="num" style={{ fontWeight: 700 }}>{formatMoney(lwf.grandTotal)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LWF Worker Data File — annual roster export, not tied to the month/year selector above */}
      <div className="card" style={{ maxWidth: 900, marginTop: 20 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>LWF — Worker Data File (Annual)</h2>
          <ActionButton
            icon="download"
            disabled={lwfWorkerFileLoading || downloading === "lwf-worker-file"}
            onClick={handleDownloadWorkerFile}
          >
            {downloading === "lwf-worker-file" ? "Downloading..." : "Download Worker Data File"}
          </ActionButton>
        </div>
        <p className="small">
          The Haryana LWF portal's bulk worker-upload template, built from current Employee records — the whole
          roster, not a specific pay period. Fields with no data anywhere in the system (Nationality, EPF-No,
          Date of Joining/Relieving, Qualification, Domicile) come through blank; fill them in per employee on
          the Employee Detail page before submitting.
        </p>
        {lwfWorkerFile && (
          <>
            <p className="small">
              {lwfWorkerFile.summary.complete} of {lwfWorkerFile.summary.total} employees have every required
              field filled in; {lwfWorkerFile.summary.incomplete} are missing at least one.
            </p>
            {lwfWorkerFile.incompleteEmployees.length > 0 && (
              <div className="table-container" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr><th>Employee</th><th>Missing fields</th></tr>
                  </thead>
                  <tbody>
                    {lwfWorkerFile.incompleteEmployees.map((e) => (
                      <tr key={e.employeeCode}>
                        <td>{e.name} ({e.employeeCode})</td>
                        <td>{e.missing.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
