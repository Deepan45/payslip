import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { api, apiErrorMessage } from "../api/client";
import { downloadSalarySheetTemplate } from "../api/payslip";
import { MappingScreen } from "../components/MappingScreen";
import { AnalyzeResponse, CanonicalField, ColumnMapping } from "../types/mapping";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { BrandLoader } from "../components/BrandLoader";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ClientOption {
  id: string;
  name: string;
}

interface UploadResult {
  sheet: { id: string; fileName: string };
  generatedCount: number;
  rowErrors: { rowNumber: number; message: string }[];
  generationErrors: { employeeCode: string; message: string }[];
}

interface ExistingSheet {
  id: string;
  fileName: string;
  periodMonth: number;
  periodYear: number;
  recordCount: number;
  uploadedAt: string;
}

export function Upload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const now = new Date();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [existingSheets, setExistingSheets] = useState<ExistingSheet[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [filePreview, setFilePreview] = useState<unknown[][] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/clients").then((res) => setClients(res.data.clients));
  }, []);

  useEffect(() => {
    if (!clientId) {
      setExistingSheets([]);
      return;
    }
    setExistingLoading(true);
    api
      .get("/history", { params: { clientId } })
      .then((res) => setExistingSheets(res.data.sheets))
      .finally(() => setExistingLoading(false));
  }, [clientId, result]);

  async function handleFileChange(f: File | null) {
    setFile(f);
    setFilePreview(null);
    setPreviewError(null);
    if (!f) return;
    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
      setFilePreview(rows.slice(0, 10));
      setShowPreviewModal(true);
    } catch {
      setPreviewError("Could not read this file for preview — it may still upload fine, this is just a quick look.");
    }
  }

  function cancelFileChoice() {
    setFile(null);
    setFilePreview(null);
    setShowPreviewModal(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function confirmFileChoice() {
    setShowPreviewModal(false);
  }

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!file || !clientId) {
      setError("Choose a client and an Excel file first.");
      return;
    }
    setError(null);
    setResult(null);
    setAnalysis(null);
    setAnalyzing(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);

    try {
      const res = await api.post("/uploads/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data: AnalyzeResponse = res.data;
      setAnalysis(data);
      if (data.status === "ready") {
        await doUpload(undefined);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to read the file"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function doUpload(mapping: ColumnMapping | undefined) {
    if (!file || !clientId) return;
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("periodMonth", String(month));
    formData.append("periodYear", String(year));
    if (mapping) formData.append("mapping", JSON.stringify(mapping));

    try {
      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setAnalysis(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Upload failed"));
    } finally {
      setSubmitting(false);
    }
  }

  const clientName = clients.find((c) => c.id === clientId)?.name;

  return (
    <div>
      <h1>Upload Salary Sheet</h1>

      {!analysis && (
        <div>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 16 }}>
            <span className="section-title-icon stat-icon-blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 20h16" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Upload Details</h2>
          </div>

          <div className="info-callout">
            First time with a new client's sheet? You'll map its columns once on the next screen; every later upload
            for that client reuses it automatically.{" "}
            <button type="button" className="btn-link" onClick={() => downloadSalarySheetTemplate()} style={{ margin: 0 }}>
              Or download a blank template
            </button>{" "}
            to start from scratch.
          </div>

          <form onSubmit={handleAnalyze}>
            {error && <div className="alert alert-error">{error}</div>}

            <label>
              Client / Site
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">-- select a client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Excel file (.xlsx / .xls)
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                required
              />
            </label>

            {previewError && <p className="alert alert-warning small">{previewError}</p>}
            {file && !showPreviewModal && (
              <p className="small" style={{ marginTop: -10, marginBottom: 16 }}>
                <span className="badge badge-success">File selected</span>{" "}
                <button type="button" className="btn-link" onClick={() => setShowPreviewModal(true)} style={{ margin: 0 }}>
                  {file.name} — view preview
                </button>
              </p>
            )}

            <div className="form-row">
              <label>
                Pay period month
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pay period year
                <div className="stepper-input">
                  <button type="button" onClick={() => setYear((y) => Math.max(2000, y - 1))} aria-label="Previous year">
                    −
                  </button>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value, 10))}
                    min={2000}
                    max={2100}
                    required
                  />
                  <button type="button" onClick={() => setYear((y) => Math.min(2100, y + 1))} aria-label="Next year">
                    +
                  </button>
                </div>
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={analyzing || submitting} style={{ width: "100%" }}>
              {analyzing || submitting ? (
                <>
                  <span className="spinner" />
                  {submitting ? "Generating payslips..." : "Reading file..."}
                </>
              ) : (
                "Continue"
              )}
            </button>

            {submitting && (
              <BrandLoader message="Generating payslips — large sheets (hundreds of employees) can take up to a minute. Don't close this tab." />
            )}
          </form>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 16 }}>
            <span className="section-title-icon stat-icon-amber">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
              </svg>
            </span>
            <h2 style={{ margin: 0 }}>Existing Files{clientName ? ` — ${clientName}` : ""}</h2>
          </div>
          {!clientId ? (
            <EmptyState title="No client selected" hint="Select a client on the left to see its previously uploaded sheets here." />
          ) : existingLoading ? (
            <p className="muted small">Loading...</p>
          ) : existingSheets.length === 0 ? (
            <EmptyState title="No sheets uploaded yet" hint={`Nothing uploaded for ${clientName} so far.`} />
          ) : (
            <ul className="existing-files-list">
              {existingSheets.map((s) => (
                <li key={s.id}>
                  <span className="existing-files-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
                    </svg>
                  </span>
                  <div className="existing-files-info">
                    <div className="existing-files-period">
                      {MONTH_NAMES[s.periodMonth - 1]} {s.periodYear}
                    </div>
                    <div className="muted small">{s.fileName}</div>
                    <div className="muted small">
                      {s.recordCount} employees · uploaded {new Date(s.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Link to={`/history/${s.id}`} className="btn-primary existing-files-view">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      )}

      {analysis && analysis.status !== "ready" && (
        <>
          <h2 style={{ marginBottom: 4 }}>
            Map columns for {clientName} — {MONTH_NAMES[month - 1]} {year}
          </h2>
          <MappingScreen
            suggestion={analysis.suggestion}
            drifted={analysis.status === "drift" ? (analysis.drifted as CanonicalField[]) : undefined}
            submitting={submitting}
            onCancel={() => setAnalysis(null)}
            onConfirm={(mapping) => doUpload(mapping)}
          />
        </>
      )}

      {error && analysis && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Upload complete</h2>
          <p>
            Generated <strong>{result.generatedCount}</strong> payslip(s) from {result.sheet.fileName}.
          </p>

          {result.rowErrors.length > 0 && (
            <>
              <p className="alert alert-warning">{result.rowErrors.length} row(s) were skipped:</p>
              <ul className="small">
                {result.rowErrors.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    Row {e.rowNumber}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.generationErrors.length > 0 && (
            <>
              <p className="alert alert-warning">{result.generationErrors.length} payslip(s) failed to generate:</p>
              <ul className="small">
                {result.generationErrors.map((e, i) => (
                  <li key={i}>
                    {e.employeeCode}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}

          <button className="btn-primary" onClick={() => navigate(`/history/${result.sheet.id}`)}>
            View Generated Payslips
          </button>
          <button className="btn-link" onClick={() => setResult(null)} style={{ marginLeft: 12 }}>
            Upload another sheet
          </button>
        </div>
      )}

      {showPreviewModal && filePreview && (
        <div className="modal-overlay" onClick={cancelFileChoice}>
          <div className="modal-panel" style={{ height: "auto", maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -2, marginRight: 6 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
                </svg>
                {file?.name}
              </h3>
              <button className="btn-link" onClick={cancelFileChoice} aria-label="Close">
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ background: "#fff", overflow: "auto", padding: 20 }}>
              <p className="muted small" style={{ marginTop: 0 }}>
                Quick raw look at the first rows — full column detection (Employee Code, Name, Basic, deductions...)
                happens automatically after you confirm.
              </p>
              <div className="file-preview-colorful">
                <table>
                  <tbody>
                    {filePreview.map((row, ri) => (
                      <tr key={ri} className={ri < 2 ? "fp-row-header" : ri % 2 === 0 ? "fp-row-even" : undefined}>
                        {row.slice(0, 10).map((cell, ci) => (
                          <td key={ci}>{String(cell ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-link" onClick={cancelFileChoice} style={{ margin: 0 }}>
                Cancel, choose a different file
              </button>
              <button className="btn-primary" onClick={confirmFileChoice}>
                Looks right — Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
