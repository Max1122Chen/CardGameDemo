import type { SessionController } from '../session/session-controller.js';
import type { AppState, EnemyView, EntityStatsView } from '../types.js';
import { style, ANSI } from './ansi.js';
import { resolveTerminalSize } from './frame-buffer.js';
import {
  formatPlainField,
  formatPrimaryStat,
  formatVitalsLines,
  primaryColors,
  theme,
} from './theme.js';
import { renderBox, renderTwinBoxes } from './widgets/box.js';
import { splitSharedPairWidths } from './widgets/columns.js';
import { renderScrollZone } from './widgets/scroll-zone.js';
import { wrapAllVisible } from './widgets/text-wrap.js';

const NARROW_COLS = 72;
const CONSOLE_SCROLLBACK_VIEWPORT = 6;
const TRACE_VIEWPORT = 6;
/** Max visible rows for Combat Log (ScrollZone + row height cap). */
const COMBAT_LOG_MAX_VIEWPORT = 8;
const HAND_LOG_RATIO = 0.65;

function formatDamageBreakdown(preview: NonNullable<AppState['preview']>): string | undefined {
  const breakdown = preview.damageBreakdown;
  if (!breakdown) {
    return undefined;
  }
  const bonusSign = breakdown.bonus >= 0 ? '+' : '';
  return theme.intent(
    `dmg:${breakdown.panel}${bonusSign}${breakdown.bonus}×${breakdown.scaling}×${breakdown.multiplier}+${breakdown.offset}→${breakdown.outgoing}`,
  );
}

function renderExpandedStats(stats: EntityStatsView, includeAp: boolean): string[] {
  const p = stats.primaries;
  const lines = [
    ...formatVitalsLines(
      stats.health,
      stats.block,
      includeAp ? (stats.actionPoints ?? 0) : undefined,
      stats.maxHealth,
      includeAp ? stats.maxActionPoints : undefined,
    ),
    [
      formatPrimaryStat('Str', p.strength, primaryColors.strength),
      formatPrimaryStat('Con', p.constitution, primaryColors.constitution),
      formatPrimaryStat('Dex', p.dexterity, primaryColors.dexterity),
    ].join('  '),
    [
      formatPrimaryStat('Int', p.intelligence, primaryColors.intelligence),
      formatPrimaryStat('Wis', p.wisdom, primaryColors.wisdom),
      formatPrimaryStat('Cha', p.charisma, primaryColors.charisma),
    ].join('  '),
    theme.muted(
      `Dmg:scale×${stats.damageScaling ?? 1} mult×${stats.damageMultiplier ?? 1} off+${stats.damageOffset ?? 0}`,
    ),
    theme.muted('Esc closes stats'),
  ];
  return lines;
}

function renderCompactEnemy(enemy: EnemyView, index: number, selected: boolean): string[] {
  const marker = selected ? theme.selected('>') : ' ';
  const name = selected ? theme.selected(enemy.name) : theme.enemyName(enemy.name);
  const lines = [
    `${marker} [${index}] ${name}`,
    `  ${theme.healthLabel('HP')}:${theme.healthValue(enemy.health)}${
      enemy.block !== undefined && enemy.block > 0
        ? `  ${theme.blockLabel('Block')}:${theme.blockValue(enemy.block)}`
        : ''
    }`,
    `  ${theme.intent(formatPlainField('Intent', enemy.intent))}`,
  ];
  if (enemy.previewDamageToTake !== undefined) {
    lines.push(`  ${theme.intent(formatPlainField('Take', enemy.previewDamageToTake))}`);
  }
  return lines;
}

function playerPaneLines(state: AppState): string[] {
  if (state.statsOverlay === 'player' && state.playerStats) {
    return renderExpandedStats(state.playerStats, true);
  }

  const lines = [
    ...formatVitalsLines(
      state.playerHealth,
      state.playerBlock,
      state.actionPoints,
      state.playerStats?.maxHealth,
      state.playerStats?.maxActionPoints,
    ),
  ];
  if (state.preview?.blockToGain !== undefined && state.preview.blockToGain > 0) {
    lines.push(theme.intent(formatPlainField('Preview', `blk+${state.preview.blockToGain}`)));
  } else if (state.preview?.damageBreakdown) {
    const breakdown = formatDamageBreakdown(state.preview);
    if (breakdown) {
      lines.push(breakdown);
    }
  }
  lines.push(theme.status(state.statusMessage));
  return lines;
}

function enemyPaneLines(state: AppState): string[] {
  if (state.enemies.length === 0) {
    return [theme.muted('(no enemies)')];
  }

  if (state.statsOverlay === 'enemy' && state.enemyStats) {
    const lines: string[] = [];
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index]!;
      const selected = index === state.selectedEnemyIndex;
      if (selected) {
        const marker = theme.selected('>');
        lines.push(`${marker} [${index}] ${theme.selected(enemy.name)}`);
        lines.push(...renderExpandedStats(state.enemyStats, false).map((line) => `  ${line}`));
      } else {
        lines.push(...renderCompactEnemy(enemy, index, false));
      }
      if (index < state.enemies.length - 1) {
        lines.push('');
      }
    }
    return lines;
  }

  const lines: string[] = [];
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index]!;
    lines.push(...renderCompactEnemy(enemy, index, index === state.selectedEnemyIndex));
    if (index < state.enemies.length - 1) {
      lines.push('');
    }
  }
  return lines;
}

function renderHandLines(state: AppState): string[] {
  if (state.hand.length === 0) {
    return [theme.muted('(empty hand)')];
  }
  return state.hand.map((card, index) => {
    const selected = index === state.selectedHandIndex;
    const marker = selected ? theme.selected('>') : ' ';
    let effectHint = '';
    if (selected && state.preview) {
      if (state.preview.blockToGain !== undefined && state.preview.blockToGain > 0) {
        effectHint = ` ${theme.intent(`=>blk+${state.preview.blockToGain}`)}`;
      } else if (state.preview.damageToTake !== undefined) {
        effectHint = ` ${theme.intent(`=>${state.preview.damageToTake}dmg`)}`;
      }
    }
    const name = selected ? theme.selected(card.name) : theme.cardName(card.name);
    return `${marker} [${index + 1}] ${name} (${theme.muted('cost')}:${theme.cardCost(card.cost)})${effectHint}`;
  });
}

function renderGameplay(state: AppState, cols: number): string[] {
  const phaseLine =
    state.combatResult !== undefined
      ? theme.header(`${state.combatResult === 'victory' ? 'Victory' : 'Defeat'}!`)
      : theme.muted(`Phase:${state.combatPhase} | Turn:${state.turnOwner}`);

  const contentWidth = Math.max(cols - 2, 40);
  const playerLines = playerPaneLines(state);
  const enemyLines = enemyPaneLines(state);
  const handInnerLines = renderHandLines(state);
  const logSource =
    state.combatLog.length > 0
      ? state.combatLog.map((line) => theme.log(line))
      : [theme.muted('Battle ready.')];

  if (cols < NARROW_COLS) {
    const paneWidth = contentWidth;
    const logInner = Math.max(paneWidth - 4, 8);
    const wrappedLog = wrapAllVisible(logSource, logInner);
    const topHeight = Math.max(playerLines.length, enemyLines.length);
    const paddedPlayer = [...playerLines, ...Array.from({ length: topHeight - playerLines.length }, () => '')];
    const paddedEnemy = [...enemyLines, ...Array.from({ length: topHeight - enemyLines.length }, () => '')];
    const logViewport = Math.min(Math.max(wrappedLog.length, 1), COMBAT_LOG_MAX_VIEWPORT);
    const logLines = renderScrollZone({
      lines: wrappedLog,
      viewportHeight: logViewport,
      autoTail: true,
    });
    return [
      phaseLine,
      ...renderBox('Player', paddedPlayer, paneWidth),
      ...renderBox('Enemies', paddedEnemy, paneWidth),
      ...renderBox('Hand', handInnerLines, paneWidth),
      ...renderBox('Combat Log', logLines, paneWidth),
    ];
  }

  const top = splitSharedPairWidths(contentWidth, 0.5);
  const bottom = splitSharedPairWidths(contentWidth, HAND_LOG_RATIO);
  const logInner = Math.max(bottom.right - 4, 8);
  const wrappedLog = wrapAllVisible(logSource, logInner);

  const topRow = renderTwinBoxes(
    'Player',
    playerLines,
    top.left,
    'Enemies',
    enemyLines,
    top.right,
  );

  const logViewport = Math.min(Math.max(wrappedLog.length, 1), COMBAT_LOG_MAX_VIEWPORT);
  const logLines = renderScrollZone({
    lines: wrappedLog,
    viewportHeight: logViewport,
    autoTail: true,
  });
  const bottomRow = renderTwinBoxes(
    'Hand',
    handInnerLines,
    bottom.left,
    'Combat Log',
    logLines,
    bottom.right,
  );

  return [phaseLine, ...topRow, ...bottomRow];
}

function renderInventoryOverlay(state: AppState): string[] {
  const lootLines =
    state.pendingLoot.length === 0
      ? [theme.muted('(no loot)')]
      : state.pendingLoot.map((entry, index) => {
          const selected = state.inventoryFocus === 'loot' && index === state.selectedLootIndex;
          const marker = selected ? theme.selected('>') : ' ';
          const line = `${marker} [${index}] ${entry.label} (sell ${entry.sellValue})`;
          return selected ? theme.selected(line) : line;
        });

  const gridLines =
    state.inventoryGrid.length === 0
      ? [theme.muted('(empty grid)')]
      : state.inventoryGrid.map((row, y) => {
          const cells = row
            .map((cell) => (cell.selected ? theme.selected(cell.glyph) : cell.glyph))
            .join(' ');
          return theme.muted(`${y}|`) + ` ${cells}`;
        });
  if (gridLines.length > 0 && state.inventoryWidth > 0) {
    const header = Array.from({ length: state.inventoryWidth }, (_, x) => String(x)).join(' ');
    gridLines.unshift(theme.muted(`  ${header}`));
  }

  const backpackLines =
    state.inventorySlots.length === 0
      ? [theme.muted('(empty)')]
      : state.inventorySlots.map((slot, index) => {
          const selected = state.inventoryFocus === 'backpack' && index === state.selectedInventorySlot;
          const marker = selected ? theme.selected('>') : ' ';
          const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const glyph = glyphs[index % glyphs.length] ?? '?';
          const line = `${marker} ${glyph} ${slot.label} @(${slot.x},${slot.y}) ${slot.width}x${slot.height} r${slot.rotation}`;
          return selected ? theme.selected(line) : line;
        });

  const equipmentLines =
    state.equipmentSlots.length === 0
      ? [theme.muted('(no slots)')]
      : state.equipmentSlots.map((slot, index) => {
          const selected = state.inventoryFocus === 'equipment' && index === state.selectedEquipmentSlot;
          const marker = selected ? theme.selected('>') : ' ';
          const line = `${marker} ${slot.label}`;
          return selected ? theme.selected(line) : line;
        });

  const placePrompt = theme.consolePrompt(`place> ${state.inventoryPlaceInput}_`);
  const lootHint =
    state.pendingLoot.length > 0
      ? theme.status('Loot:P auto | Enter place | A all | Tab panel')
      : theme.muted('No pending loot.');

  const width = 72;
  return [
    ...renderBox('Loot', lootLines, width),
    ...renderBox(`Grid ${state.inventoryWidth}x${state.inventoryHeight}`, gridLines, width),
    ...renderBox('Backpack', backpackLines, width),
    ...renderBox('Equipment', equipmentLines, width),
    placePrompt,
    lootHint,
    theme.muted(
      'Bag:Tab panel | E equip | U unequip | T tidy | D discard | Enter x y [rot] | Esc',
    ),
  ];
}

function renderOverlay(state: AppState): string[] {
  switch (state.overlay) {
    case 'inventory':
      return renderInventoryOverlay(state);
    case 'settings':
      return renderBox(
        'Settings',
        [
          `${theme.muted('Mode:')} ${style(state.runtimeMode, ANSI.fg.brightWhite)}`,
          `${theme.muted('Seed:')} ${style(String(state.seed ?? '(none)'), ANSI.fg.brightWhite)}`,
          `${theme.muted('Scenario:')} ${style(String(state.scenarioId ?? '(none)'), ANSI.fg.brightWhite)}`,
          theme.muted('Trace pane:toggle with T'),
          theme.muted('Esc closes overlay.'),
        ],
        72,
      );
    case 'console': {
      const scrollback = renderScrollZone({
        lines: state.consoleScrollback.map((line) => theme.muted(line)),
        viewportHeight: CONSOLE_SCROLLBACK_VIEWPORT,
        autoTail: true,
      });
      return renderBox(
        'Debug Console',
        [
          ...scrollback,
          ...(scrollback.length > 0 ? [''] : []),
          theme.consolePrompt(`> ${state.consoleInput}_`),
          theme.muted('Enter submits. Esc closes.'),
        ],
        72,
      );
    }
    default:
      return [];
  }
}

function renderTracePane(controller: SessionController): string[] {
  const traced = controller.traceLines.map((line) => {
    try {
      const parsed = JSON.parse(line) as { kind?: string };
      return theme.trace(parsed.kind ? `${parsed.kind}` : line.slice(0, 40));
    } catch {
      return theme.trace(line.slice(0, 40));
    }
  });
  const lines = renderScrollZone({
    lines: traced,
    viewportHeight: TRACE_VIEWPORT,
    autoTail: true,
  });
  return renderBox('Trace', lines.length > 0 ? lines : [theme.muted('(no trace entries)')], 72);
}

export function renderFrame(
  state: AppState,
  controller: SessionController,
  options?: { cols?: number },
): string {
  const cols = options?.cols ?? resolveTerminalSize().cols;
  const header = theme.header(
    `CardGameDemo [${state.runtimeMode}] seed=${state.seed ?? '-'} scenario=${state.scenarioId ?? '-'}`,
  );
  const lines = [header, ...renderGameplay(state, cols)];

  if (state.showTracePane) {
    lines.push(...renderTracePane(controller));
  }

  if (state.overlay !== 'none') {
    lines.push('');
    lines.push(...renderOverlay(state));
  }

  lines.push('');
  lines.push(
    theme.footer('Space Commit | Esc/x Cancel | F End Turn | P/E Stats | B Bag | ~ Console | Q Quit'),
  );
  return `${lines.join('\n')}\n`;
}
