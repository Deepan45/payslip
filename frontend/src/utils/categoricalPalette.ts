/**
 * Validated categorical palette (8 slots), fixed order — CVD-safe on the
 * default adjacent pairlist (bars/stacks/donut wedges/lines). Never cycle
 * or reorder per-render; assign slot[i % 8] by a STABLE key (e.g. sorted
 * client id), not by value/rank, so a color always identifies the same
 * entity even as data changes.
 */
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}
