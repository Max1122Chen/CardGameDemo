/**
 * Viewport over a line list. Default sticky auto-tail shows the newest lines.
 */
export type ScrollZoneOptions = {
  lines: readonly string[];
  viewportHeight: number;
  /** When true (default), always show the last `viewportHeight` lines. */
  autoTail?: boolean;
  /** From-top offset when autoTail is false. */
  scrollOffset?: number;
};

export function renderScrollZone(options: ScrollZoneOptions): string[] {
  const { lines, viewportHeight, autoTail = true, scrollOffset = 0 } = options;
  if (viewportHeight <= 0 || lines.length === 0) {
    return [];
  }

  if (autoTail) {
    return [...lines.slice(-viewportHeight)];
  }

  const maxOffset = Math.max(0, lines.length - viewportHeight);
  const offset = Math.min(Math.max(0, scrollOffset), maxOffset);
  return [...lines.slice(offset, offset + viewportHeight)];
}
