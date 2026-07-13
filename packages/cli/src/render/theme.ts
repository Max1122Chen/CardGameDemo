import { ANSI, style } from './ansi.js';

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
  selected: (text: string) => style(text, ANSI.bold, ANSI.inverse),
  log: (text: string) => style(text, ANSI.fg.white),
  consolePrompt: (text: string) => style(text, ANSI.fg.brightGreen),
  footer: (text: string) => style(text, ANSI.dim, ANSI.fg.brightWhite),
  trace: (text: string) => style(text, ANSI.fg.blue),
} as const;

export function formatPlayerStats(health: number, block: number, actionPoints: number): string {
  return [
    theme.healthLabel('HP'),
    theme.healthValue(health),
    '  ',
    theme.blockLabel('Block'),
    theme.blockValue(block),
    '  ',
    theme.apLabel('AP'),
    theme.apValue(actionPoints),
  ].join('');
}
