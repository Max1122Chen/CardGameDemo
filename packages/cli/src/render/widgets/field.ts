import { theme } from '../theme.js';

/** `Label:Value` with no space after the colon. */
export function formatField(label: string, value: string | number): string {
  return `${label}:${value}`;
}

export function formatThemedField(
  label: string,
  labelStyle: (text: string) => string,
  value: string | number,
  valueStyle: (text: string) => string = (t) => String(t),
): string {
  return `${labelStyle(label)}:${valueStyle(String(value))}`;
}

export function formatMutedField(label: string, value: string | number): string {
  return theme.muted(formatField(label, value));
}
