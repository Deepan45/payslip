import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface Props {
  payslipId: string;
  title: string;
  onClose: () => void;
}

export function PayslipPreviewModal({ payslipId, title, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .get(`/payslips/${payslipId}/download`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this payslip.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [payslipId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleDownload() {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handlePrint() {
    // Print the embedded iframe directly — never a new tab/window.
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-link" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <p className="alert alert-error" style={{ margin: 16 }}>
              {error}
            </p>
          )}
          {url && <iframe ref={iframeRef} src={url} title={title} />}
        </div>
        <div className="modal-footer">
          <button className="btn-link" onClick={handlePrint} disabled={!url}>
            Print
          </button>
          <button className="btn-primary" onClick={handleDownload} disabled={!url}>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
