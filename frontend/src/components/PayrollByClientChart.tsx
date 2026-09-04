import { categoricalColor } from "../utils/categoricalPalette";

interface Row {
  clientId: string;
  clientName: string;
  netPay: number;
}

function formatCompact(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

/**
 * Horizontal bar chart: net payroll cost per client for one period. Each
 * bar is colored by client identity (categorical, fixed order) so it
 * visually pairs with the "Employees by Client" donut — color is assigned
 * from a stable alphabetical ordering, not the bars' own value-sorted
 * display order, so a client keeps its color even as rankings shift.
 */
export function PayrollByClientChart({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="muted small">No data yet.</p>;

  const stableOrder = [...rows].sort((a, b) => a.clientName.localeCompare(b.clientName));
  const colorByClient = new Map(stableOrder.map((r, i) => [r.clientId, categoricalColor(i)]));

  const max = Math.max(...rows.map((r) => r.netPay), 1);
  const labelW = 150;
  const rowH = 30;
  const barH = 14;
  const chartW = 560;
  const barAreaW = chartW - labelW - 70; // leave room for the value label
  const height = rows.length * rowH;

  return (
    <svg viewBox={`0 0 ${chartW} ${height}`} width="100%" height={height} role="img" aria-label="Net payroll by client">
      {rows.map((row, i) => {
        const w = Math.max((row.netPay / max) * barAreaW, 2);
        const y = i * rowH + (rowH - barH) / 2;
        return (
          <g key={row.clientId}>
            <text x={0} y={y + barH / 2} dy="0.35em" fontSize="11.5" fill="#3d4258" fontFamily="inherit">
              {row.clientName.length > 20 ? row.clientName.slice(0, 19) + "…" : row.clientName}
            </text>
            <rect x={labelW} y={y} width={w} height={barH} rx={4} fill={colorByClient.get(row.clientId)}>
              <title>
                {row.clientName}: ₹{row.netPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </title>
            </rect>
            <text x={labelW + w + 8} y={y + barH / 2} dy="0.35em" fontSize="11" fill="#6b7280" fontFamily="inherit">
              {formatCompact(row.netPay)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
