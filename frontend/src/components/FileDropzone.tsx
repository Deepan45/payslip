import { ReactNode, useRef, useState } from "react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  /** Accepted file extensions, dot-prefixed, e.g. [".xlsx", ".xls"]. */
  accept: string[];
  /** Passed to the hidden input's `accept` attribute — mime types or extensions. Defaults to `accept`. */
  acceptAttr?: string;
  maxSizeBytes?: number;
  file: File | null;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Rendered instead of the generic file icon in the selected card, e.g. an image thumbnail. */
  thumbnail?: ReactNode;
  /** Extra line under the filename in the selected card, e.g. row/sheet info. */
  extra?: ReactNode;
  /** Extra buttons next to Remove in the selected card, e.g. Preview. */
  actions?: ReactNode;
}

/**
 * Drag & drop file picker replacing the raw `<input type="file">` control.
 * Self-validates extension + size before accepting a file; the caller only
 * ever sees a file that already passed both checks.
 */
export function FileDropzone({
  accept,
  acceptAttr,
  maxSizeBytes,
  file,
  onFileSelected,
  onRemove,
  label = "Drag & drop a file here",
  hint,
  disabled,
  thumbnail,
  extra,
  actions,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultHint = `${accept.join(" or ")}${maxSizeBytes ? ` · up to ${formatBytes(maxSizeBytes)}` : ""}`;

  function validate(candidate: File): string | null {
    const okExt = accept.some((ext) => candidate.name.toLowerCase().endsWith(ext.toLowerCase()));
    if (!okExt) return `"${candidate.name}" isn't a supported file type. Use ${accept.join(" or ")}.`;
    if (maxSizeBytes && candidate.size > maxSizeBytes) {
      return `"${candidate.name}" is ${formatBytes(candidate.size)}, which is over the ${formatBytes(maxSizeBytes)} limit.`;
    }
    return null;
  }

  function tryAccept(candidate: File | null | undefined) {
    if (!candidate) return;
    const problem = validate(candidate);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onFileSelected(candidate);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    tryAccept(e.dataTransfer.files?.[0]);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr ?? accept.join(",")}
        onChange={(e) => {
          tryAccept(e.target.files?.[0]);
          e.target.value = ""; // allow re-selecting the same file after Remove
        }}
        disabled={disabled}
        style={{ display: "none" }}
      />

      {!file ? (
        <div
          className={`dropzone ${dragActive ? "dropzone-active" : ""} ${disabled ? "dropzone-disabled" : ""}`}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={openPicker}
          onKeyDown={handleKeyDown}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <span className="dropzone-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 20h16" />
            </svg>
          </span>
          <div className="dropzone-label">
            {label} <span className="dropzone-browse">or browse files</span>
          </div>
          <div className="dropzone-hint">{hint ?? defaultHint}</div>
        </div>
      ) : (
        <div className="dropzone-file">
          <span className="dropzone-file-icon">
            {thumbnail ?? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
              </svg>
            )}
          </span>
          <div className="dropzone-file-info">
            <div className="dropzone-file-name">{file.name}</div>
            <div className="muted small">
              {formatBytes(file.size)}
              {extra ? <> · {extra}</> : null}
            </div>
          </div>
          <div className="dropzone-file-actions">
            {actions}
            {!disabled && (
              <button type="button" className="btn-action" onClick={onRemove} aria-label="Remove file">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="alert alert-warning small" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
