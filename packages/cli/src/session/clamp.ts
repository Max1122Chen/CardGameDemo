export function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}
