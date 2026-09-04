interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Simple client-side pagination bar: "Showing X–Y of Z" + Prev/Next + a small page-number window. */
export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const windowSize = 5;
  let from = Math.max(1, page - Math.floor(windowSize / 2));
  let to = Math.min(totalPages, from + windowSize - 1);
  from = Math.max(1, to - windowSize + 1);
  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div className="pagination">
      <span className="muted small">
        Showing {start}–{end} of {total}
      </span>
      <div className="pagination-controls">
        <button className="btn-page" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          ‹ Prev
        </button>
        {from > 1 && (
          <>
            <button className="btn-page" onClick={() => onPageChange(1)}>
              1
            </button>
            {from > 2 && <span className="pagination-ellipsis">…</span>}
          </>
        )}
        {pages.map((p) => (
          <button key={p} className={`btn-page ${p === page ? "active" : ""}`} onClick={() => onPageChange(p)}>
            {p}
          </button>
        ))}
        {to < totalPages && (
          <>
            {to < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
            <button className="btn-page" onClick={() => onPageChange(totalPages)}>
              {totalPages}
            </button>
          </>
        )}
        <button className="btn-page" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next ›
        </button>
      </div>
    </div>
  );
}
