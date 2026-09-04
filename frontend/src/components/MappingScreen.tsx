import { useState } from "react";
import {
  CanonicalField,
  ColumnMapping,
  ColumnRef,
  FIELD_GROUPS,
  FIELD_LABELS,
  MappingSuggestion,
  NUMERIC_FIELDS,
  TEXT_FIELDS,
  columnLabel,
  rawFingerprint,
} from "../types/mapping";

// Confidence dot shown next to each field: green = trust it (an exact
// header match, or the user picked it by hand — either way it's certain),
// amber = auto-picked from a partial/compound header match, worth a
// double-check, red = a required field with nothing mapped yet, and no dot
// at all for an optional field the sheet simply doesn't have.
type FieldStatus = "confident" | "doubt" | "missing" | "empty";

function statusOf(hasValue: boolean, required: boolean, touched: boolean, confidence?: "exact" | "fuzzy"): FieldStatus {
  if (!hasValue) return required ? "missing" : "empty";
  if (touched) return "confident"; // a human picked it — no longer a guess
  return confidence === "fuzzy" ? "doubt" : "confident";
}

function StatusDot({ status }: { status: FieldStatus }) {
  if (status === "empty") return null;
  const title =
    status === "confident"
      ? "Mapped with high confidence"
      : status === "doubt"
        ? "Guessed from a partial header match — please double-check"
        : "Required — needs to be mapped";
  return <span className={`mapping-status-dot mapping-status-${status}`} title={title} />;
}
import { BrandLoader } from "./BrandLoader";

interface Props {
  suggestion: MappingSuggestion;
  drifted?: CanonicalField[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  submitting: boolean;
}

const NUMERIC_SET = new Set<string>(NUMERIC_FIELDS);
const REQUIRED = new Set<CanonicalField>(["employeeCode", "name"]);

export function MappingScreen({ suggestion, drifted, onConfirm, onCancel, submitting }: Props) {
  const [assignments, setAssignments] = useState<Partial<Record<CanonicalField, number[]>>>(() => {
    const initial: Partial<Record<CanonicalField, number[]>> = {};
    for (const [field, refs] of Object.entries(suggestion.columns)) {
      initial[field as CanonicalField] = (refs ?? []).map((r) => r.index);
    }
    return initial;
  });

  const { grid, headerRowStart, headerRowEnd } = suggestion;
  const colCount = Math.max(...grid.map((r) => r.length), 1);
  const columnOptions = Array.from({ length: colCount }, (_, i) => ({
    index: i,
    label: columnLabel(grid, headerRowStart, headerRowEnd, i),
  }));

  // Fields the user has explicitly touched — once they've picked a column
  // themselves, that choice is certain regardless of what the auto-suggester
  // guessed, so it should read as confident (green) rather than a lingering
  // "fuzzy" (amber) or blank "missing" (red) status.
  const [touched, setTouched] = useState<Set<CanonicalField>>(new Set());
  function markTouched(field: CanonicalField) {
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  const assignedElsewhere = (field: CanonicalField, index: number) =>
    Object.entries(assignments).some(([f, idxs]) => f !== field && (idxs ?? []).includes(index));

  function setTextField(field: CanonicalField, index: number | null) {
    setAssignments((prev) => ({ ...prev, [field]: index === null ? [] : [index] }));
    markTouched(field);
  }

  function addNumericColumn(field: CanonicalField, index: number) {
    setAssignments((prev) => ({ ...prev, [field]: [...(prev[field] ?? []), index] }));
    markTouched(field);
  }

  function removeNumericColumn(field: CanonicalField, index: number) {
    setAssignments((prev) => ({ ...prev, [field]: (prev[field] ?? []).filter((i) => i !== index) }));
    markTouched(field);
  }

  const employeeCodeSet = (assignments.employeeCode ?? []).length > 0;
  const nameSet = (assignments.name ?? []).length > 0;
  const canConfirm = employeeCodeSet && nameSet;

  function handleConfirm() {
    const columns: Partial<Record<CanonicalField, ColumnRef[]>> = {};
    for (const [field, indexes] of Object.entries(assignments)) {
      if (!indexes || indexes.length === 0) continue;
      columns[field as CanonicalField] = indexes.map((index) => ({
        index,
        fingerprint: rawFingerprint(grid, headerRowStart, headerRowEnd, index),
      }));
    }
    onConfirm({ headerRowStart, headerRowEnd, dataStartRow: suggestion.dataStartRow, columns });
  }

  return (
    <div className="mapping-screen">
      {drifted && drifted.length > 0 && (
        <div className="alert alert-warning">
          This sheet's layout looks different from last time — check these fields: {drifted.map((f) => FIELD_LABELS[f]).join(", ")}
        </div>
      )}
      <p className="muted small">
        Match each field below to the right column from your sheet. This mapping is saved for this client, so future
        uploads with the same layout won't need this step again.
      </p>

      <div className="mapping-grid">
        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="mapping-group card">
            <h3>{group.title}</h3>
            {group.fields.map((field) => {
              const isNumeric = NUMERIC_SET.has(field);
              const current = assignments[field] ?? [];
              const missingRequired = REQUIRED.has(field) && current.length === 0;
              const status = statusOf(current.length > 0, REQUIRED.has(field), touched.has(field), suggestion.confidence[field]);
              return (
                <div key={field} className={`mapping-row ${missingRequired ? "mapping-row-missing" : ""}`}>
                  <label className="mapping-field-label">
                    <StatusDot status={status} />
                    {FIELD_LABELS[field]}
                  </label>
                  {isNumeric ? (
                    <div className="mapping-chips">
                      {current.map((idx) => (
                        <span key={idx} className="mapping-chip">
                          {columnLabel(grid, headerRowStart, headerRowEnd, idx)}
                          <button type="button" onClick={() => removeNumericColumn(field, idx)}>
                            &times;
                          </button>
                        </span>
                      ))}
                      <select
                        value=""
                        onChange={(e) => {
                          const idx = parseInt(e.target.value, 10);
                          if (!isNaN(idx)) addNumericColumn(field, idx);
                        }}
                      >
                        <option value="">+ add column...</option>
                        {columnOptions
                          .filter((c) => !current.includes(c.index))
                          .map((c) => (
                            <option key={c.index} value={c.index}>
                              {c.label}
                              {assignedElsewhere(field, c.index) ? " (also used elsewhere)" : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <select
                      value={current[0] ?? ""}
                      onChange={(e) => setTextField(field, e.target.value === "" ? null : parseInt(e.target.value, 10))}
                    >
                      <option value="">-- none --</option>
                      {columnOptions.map((c) => (
                        <option key={c.index} value={c.index}>
                          {c.label}
                          {assignedElsewhere(field, c.index) ? " (also used elsewhere)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sheet preview (first rows)</h3>
        <div className="grid-preview">
          <table>
            <tbody>
              {grid.slice(0, 8).map((row, ri) => (
                <tr key={ri} className={ri >= headerRowStart && ri <= headerRowEnd ? "grid-preview-header" : ""}>
                  <td className="muted small">{ri}</td>
                  {row.map((cell, ci) => (
                    <td key={ci}>{String(cell ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbar" style={{ justifyContent: "flex-start", gap: 12 }}>
        <button className="btn-primary" onClick={handleConfirm} disabled={!canConfirm || submitting}>
          {submitting && <span className="spinner" />}
          {submitting ? "Generating payslips..." : "Confirm Mapping & Generate Payslips"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        {!canConfirm && <span className="muted small">Employee Code and Name must be mapped first.</span>}
      </div>

      {submitting && (
        <BrandLoader message="Generating payslips — large sheets (hundreds of employees) can take up to a minute. Don't close this tab." />
      )}
    </div>
  );
}
