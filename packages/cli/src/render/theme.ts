import { ANSI, style } from './ansi.js';
import { formatField, formatThemedField } from './widgets/field.js';

export const theme = {
  header: (text: string) => style(text, ANSI.bold, ANSI.fg.brightCyan),
  paneTitle: (text: string) => style(text, ANSI.bold, ANSI.fg.brightYellow),
  muted: (text: string) => style(text, ANSI.dim),
  status: (text: string) => style(text, ANSI.fg.brightGreen),
  healthLabel: (text: string) => style(text, ANSI.bold, ANSI.fg.brightRed),
  healthValue: (value: number) => style(String(value), ANSI.fg.red),
  blockLabel: (text: string) => style(text, ANSI.bold, ANSI.fg.cyan),
  blockValue: (value: number) => style(String(value), ANSI.fg.brightCyan),
  apLabel: (text: string) => style(text, ANSI.bold, ANSI.fg.yellow),
  apValue: (value: number) => style(String(value), ANSI.fg.brightYellow),
  enemyName: (text: string) => style(text, ANSI.fg.magenta),
  intent: (text: string) => style(text, ANSI.dim, ANSI.fg.white),
  cardName: (text: string) => style(text, ANSI.fg.brightWhite),
  cardCost: (value: number) => style(String(value), ANSI.fg.yellow),
  selected: (text: string) => style(text, ANSI.bold, ANSI.fg.brightCyan),
  log: (text: string) => style(text, ANSI.fg.white),
  consolePrompt: (text: string) => style(text, ANSI.fg.brightGreen),
  footer: (text: string) => style(text, ANSI.dim, ANSI.fg.brightWhite),
  trace: (text: string) => style(text, ANSI.fg.blue),
} as const;

export function formatPlayerStats(
  health: number,
  block: number,
  actionPoints: number,
  maxHealth?: number,
  maxActionPoints?: number,
): string {
  const hpText =
    maxHealth !== undefined
      ? `${theme.healthValue(health)}/${theme.healthValue(maxHealth)}`
      : theme.healthValue(health);
  const apText =
    maxActionPoints !== undefined
      ? `${theme.apValue(actionPoints)}/${theme.apValue(maxActionPoints)}`
      : theme.apValue(actionPoints);
  return [
    formatThemedField('HP', theme.healthLabel, hpText, (t) => t),
    '  ',
    formatThemedField('Block', theme.blockLabel, block, (v) => theme.blockValue(Number(v))),
    '  ',
    formatThemedField('AP', theme.apLabel, apText, (t) => t),
  ].join('');
}

/** Compact vitals as separate lines for column panes. */
export function formatVitalsLines(
  health: number,
  block: number,
  actionPoints?: number,
  maxHealth?: number,
  maxActionPoints?: number,
): string[] {
  const hpText =
    maxHealth !== undefined
      ? `${theme.healthValue(health)}/${theme.healthValue(maxHealth)}`
      : theme.healthValue(health);
  const lines = [
    formatThemedField('HP', theme.healthLabel, hpText, (t) => t),
    formatThemedField('Block', theme.blockLabel, block, (v) => theme.blockValue(Number(v))),
  ];
  if (actionPoints !== undefined) {
    const apText =
      maxActionPoints !== undefined
        ? `${theme.apValue(actionPoints)}/${theme.apValue(maxActionPoints)}`
        : theme.apValue(actionPoints);
    lines.push(formatThemedField('AP', theme.apLabel, apText, (t) => t));
  }
  return lines;
}

export function formatPrimaryStat(label: string, value: number, color: (text: string) => string): string {
  return `${color(label)}:${color(String(value))}`;
}

export function formatPlainField(label: string, value: string | number): string {
  return formatField(label, value);
}

export const primaryColors = {
  strength: (text: string) => style(text, ANSI.fg.yellow),
  constitution: (text: string) => style(text, ANSI.fg.red),
  dexterity: (text: string) => style(text, ANSI.fg.green),
  intelligence: (text: string) => style(text, ANSI.fg.blue),
  wisdom: (text: string) => style(text, ANSI.dim),
  charisma: (text: string) => style(text, ANSI.fg.magenta),
} as const;
