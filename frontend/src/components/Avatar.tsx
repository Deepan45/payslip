import { categoricalColor } from "../utils/categoricalPalette";

/** Deterministic color pick from a stable key, so the same name always gets the same color. */
function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return categoricalColor(hash);
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const color = colorForKey(name);

  return (
    <span
      className="avatar-chip"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `${color}22`,
        color,
      }}
    >
      {initials || "?"}
    </span>
  );
}
