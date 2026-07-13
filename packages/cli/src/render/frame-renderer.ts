import type { SessionController } from '../session/session-controller.js';
import type { AppState } from '../types.js';
import { padVisible, style, ANSI } from './ansi.js';
import { formatPlayerStats, theme } from './theme.js';

function box(title: string, lines: string[], width = 72): string[] {
  const inner = width - 4;
  const border = style('+', ANSI.dim);
  const output = [`${border} ${padVisible(theme.paneTitle(title), width - 3)}+`];
  for (const line of lines) {
    output.push(`${border} ${padVisible(line, inner)} ${border}`);
  }
  output.push(`${border}${style('-'.repeat(width - 2), ANSI.dim)}+`);
  return output;
}

function renderGameplay(state: AppState): string[] {
  const enemyLines =
    state.enemies.length === 0
      ? [theme.muted('(no enemies)')]
      : state.enemies.map((enemy, index) => {
          const selected = index === state.selectedEnemyIndex;
          const marker = selected ? theme.selected('>') : ' ';
          const line = `${marker} [${index}] ${theme.enemyName(enemy.name)} ${theme.healthLabel('HP')}:${theme.healthValue(enemy.health)} ${theme.intent(`intent:${enemy.intent}`)}`;
          return selected ? theme.selected(line) : line;
        });

  const handLines =
    state.hand.length === 0
      ? [theme.muted('(empty hand)')]
      : state.hand.map((card, index) => {
          const selected = index === state.selectedHandIndex;
          const marker = selected ? theme.selected('>') : ' ';
          const line = `${marker} [${index + 1}] ${theme.cardName(card.name)} (${theme.muted('cost')} ${theme.cardCost(card.cost)})`;
          return selected ? theme.selected(line) : line;
        });

  const logLines =
    state.combatLog.length > 0
      ? state.combatLog.map((line) => theme.log(line))
      : [theme.muted('Battle ready.')];

  return [
    ...box('Player', [formatPlayerStats(state.playerHealth, state.playerBlock, state.actionPoints), theme.status(state.statusMessage)]),
    ...box('Enemies', enemyLines),
    ...box('Hand', handLines),
    ...box('Combat Log', logLines),
  ];
}

function renderOverlay(state: AppState): string[] {
  switch (state.overlay) {
    case 'inventory':
      return box('Inventory', [theme.muted('Backpack slots are not implemented yet.'), theme.muted('Esc closes overlay.')]);
    case 'settings':
      return box('Settings', [
        `${theme.muted('Mode:')} ${style(state.runtimeMode, ANSI.fg.brightWhite)}`,
        `${theme.muted('Seed:')} ${style(String(state.seed ?? '(none)'), ANSI.fg.brightWhite)}`,
        `${theme.muted('Scenario:')} ${style(String(state.scenarioId ?? '(none)'), ANSI.fg.brightWhite)}`,
        theme.muted('Trace pane: toggle with T'),
        theme.muted('Esc closes overlay.'),
      ]);
    case 'console': {
      const scrollback = state.consoleScrollback.slice(-6).map((line) => theme.muted(line));
      return box('Debug Console', [
        ...scrollback,
        ...(scrollback.length > 0 ? [''] : []),
        theme.consolePrompt(`> ${state.consoleInput}_`),
        theme.muted('Enter submits. Esc closes.'),
      ]);
    }
    default:
      return [];
  }
}

function renderTracePane(controller: SessionController): string[] {
  const lines = controller.traceLines.slice(-6).map((line) => {
    try {
      const parsed = JSON.parse(line) as { kind?: string };
      return theme.trace(parsed.kind ? `${parsed.kind}` : line.slice(0, 40));
    } catch {
      return theme.trace(line.slice(0, 40));
    }
  });
  return box('Trace', lines.length > 0 ? lines : [theme.muted('(no trace entries)')]);
}

export function renderFrame(state: AppState, controller: SessionController): string {
  const header = theme.header(
    `CardGameDemo [${state.runtimeMode}] seed=${state.seed ?? '-'} scenario=${state.scenarioId ?? '-'}`,
  );
  const footer = theme.footer('Esc Settings | B Inventory | ~ Console | T Trace | Q Quit');
  const lines = [header, ...renderGameplay(state)];

  if (state.showTracePane) {
    lines.push(...renderTracePane(controller));
  }

  if (state.overlay !== 'none') {
    lines.push('');
    lines.push(...renderOverlay(state));
  }

  lines.push('');
  lines.push(footer);
  return `${lines.join('\n')}\n`;
}
