import { categoricalColor } from "../utils/categoricalPalette";

interface Slice {
  id: string;
  label: string;
  value: number;
}

/**
 * Donut chart with a direct legend (identity encoding — fixed categorical
 * hue order, assigned by the slice's position in `slices`, which callers
 * should sort by a stable key so a color always tracks the same entity).
 */
export function DonutChart({ slices, centerLabel }: { slices: Slice[]; centerLabel?: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <p className="muted small">No data yet.</p>;

  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const fraction = s.value / total;
    const dash = fraction * circumference;
    const arc = {
      id: s.id,
      color: categoricalColor(i),
      dashArray: `${dash} ${circumference - dash}`,
      dashOffset: -offset,
      pct: fraction * 100,
      label: s.label,
      value: s.value,
    };
    offset += dash;
    return arc;
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Employees by client">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f5" strokeWidth={strokeWidth} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
            >
              <title>
                {arc.label}: {arc.value} ({arc.pct.toFixed(0)}%)
              </title>
            </circle>
          ))}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize="20" fontWeight="800" fill="#171923" fontFamily="inherit">
          {total}
        </text>
        <text x="50%" y="61%" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="inherit">
          {centerLabel ?? "total"}
        </text>
      </svg>

      <ul className="donut-legend">
        {arcs.map((arc) => (
          <li key={arc.id}>
            <span className="donut-legend-dot" style={{ background: arc.color }} />
            <span className="donut-legend-label">{arc.label}</span>
            <span className="donut-legend-value">{arc.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
