/**
 * Split a row into two outer box widths that share one vertical border.
 * `leftOuter + rightOuter - 1 === totalWidth`.
 */
export function splitSharedPairWidths(
  totalWidth: number,
  leftRatio: number,
): { left: number; right: number } {
  const sum = Math.max(totalWidth + 1, 16);
  const left = Math.max(8, Math.floor(sum * leftRatio));
  const right = Math.max(8, sum - left);
  return { left, right };
}

/** @deprecated Prefer splitSharedPairWidths for adjacent panes. */
export function splitColumnWidths(
  totalWidth: number,
  leftRatio: number,
  gap = 1,
): { left: number; right: number } {
  const usable = Math.max(totalWidth - gap, 2);
  const left = Math.max(8, Math.floor(usable * leftRatio));
  const right = Math.max(8, usable - left);
  return { left, right };
}
