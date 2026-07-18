import type { SessionController } from '../session/session-controller.js';
import type { AppState, EnemyView, EntityStatsView } from '../types.js';
import { isExplorePhase, isLootHandMode } from '../ui-mode.js';
import { style, ANSI, visibleLength } from './ansi.js';
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
const EQUIP_GRID_RATIO = 0.35;

function centerVisible(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - visibleLength(text)) / 2));
  return `${' '.repeat(pad)}${text}`;
}

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

function enemyPaneLines(state: AppState, innerWidth: number): string[] {
  if (isExplorePhase(state) || state.sessionPhase === 'adventure_victory' || state.sessionPhase === 'adventure_defeat') {
    if (state.mapLines.length > 0) {
      return state.mapLines.map((line) => theme.muted(line));
    }
    return [theme.muted('(no map)')];
  }

  if (state.combatResult !== undefined) {
    const word = state.combatResult === 'victory' ? 'VICTORY' : 'DEFEAT';
    const banner =
      state.combatResult === 'victory'
        ? style(word, ANSI.bold, ANSI.fg.brightGreen)
        : style(word, ANSI.bold, ANSI.fg.brightRed);
    const width = Math.max(innerWidth, visibleLength(word));
    return ['', '', centerVisible(banner, width), '', ''];
  }

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

function renderInteractionLines(state: AppState): string[] {
  if (!state.interactionPrompt) {
    if (state.interactPickMode && state.roomInteractables && state.roomInteractables.length > 0) {
      return state.roomInteractables.map(
        (item, index) => `[${index + 1}] ${item.displayName} (${item.kind})`,
      );
    }
    const list = state.roomInteractables ?? [];
    if (list.length === 0) {
      return [theme.muted('(no interactables)')];
    }
    return [
      theme.muted('I interact'),
      ...list.map((item) => `· ${item.displayName}`),
    ];
  }
  const lines = [state.interactionPrompt, ''];
  for (const [index, option] of (state.interactionOptions ?? []).entries()) {
    lines.push(`[${index + 1}] ${option.label}`);
  }
  lines.push(theme.muted('X cancel'));
  return lines;
}

function renderRoomLootLines(state: AppState): string[] {
  const room = state.currentRoomId ?? '?';
  const header = theme.muted(`Room: ${room}`);
  if (state.roomLoot.length === 0) {
    return [header, theme.muted('(empty floor)')];
  }
  return [
    header,
    ...state.roomLoot.map((entry, index) => {
      const selected = index === state.selectedRoomLootIndex;
      const marker = selected ? theme.selected('>') : ' ';
      const line = `${marker} [${index + 1}] ${entry.label}`;
      return selected ? theme.selected(line) : line;
    }),
  ];
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

function renderLootHandLines(state: AppState): string[] {
  if (state.pendingLoot.length === 0) {
    return [theme.muted('(empty)')];
  }
  return state.pendingLoot.map((entry, index) => {
    const selected = index === state.selectedLootIndex;
    const marker = selected ? theme.selected('>') : ' ';
    const line = `${marker} [${index + 1}] ${entry.label} (sell ${entry.sellValue})`;
    return selected ? theme.selected(line) : line;
  });
}

function bottomLeftPane(state: AppState): { title: string; lines: string[] } {
  if (isExplorePhase(state) || state.sessionPhase === 'adventure_victory') {
    if (state.interactionPrompt || state.interactPickMode) {
      return { title: 'Interact', lines: renderInteractionLines(state) };
    }
    const interactLines = renderInteractionLines(state);
    const lootLines = renderRoomLootLines(state);
    return {
      title: 'Room',
      lines: [...interactLines, '', ...lootLines],
    };
  }
  if (isLootHandMode(state)) {
    return { title: 'Loot', lines: renderLootHandLines(state) };
  }
  return { title: 'Hand', lines: renderHandLines(state) };
}

function renderEquipmentLines(state: AppState): string[] {
  const lines =
    state.equipmentSlots.length === 0
      ? [theme.muted('(no slots)')]
      : state.equipmentSlots.map((slot, index) => {
          const selected = state.inventoryFocus === 'equipment' && index === state.selectedEquipmentSlot;
          const marker = selected ? theme.selected('>') : ' ';
          const line = `${marker} ${slot.label}`;
          return selected ? theme.selected(line) : line;
        });
  lines.push('');
  lines.push(theme.consolePrompt(`place> ${state.inventoryPlaceInput}_`));
  return lines;
}

function renderGridLines(state: AppState): string[] {
  const gridLines =
    state.inventoryGrid.length === 0
      ? [theme.muted('(empty grid)')]
      : state.inventoryGrid.map((row, y) => {
          const cells = row
            .map((cell) => (cell.selected ? theme.selectedCell(cell.glyph) : cell.glyph))
            .join(' ');
          return theme.muted(`${y}|`) + ` ${cells}`;
        });
  if (gridLines.length > 0 && state.inventoryWidth > 0) {
    const header = Array.from({ length: state.inventoryWidth }, (_, x) => String(x)).join(' ');
    gridLines.unshift(theme.muted(`  ${header}`));
  }

  if (state.inventorySlots.length > 0) {
    gridLines.push('');
    for (const [index, slot] of state.inventorySlots.entries()) {
      const selected = state.inventoryFocus === 'backpack' && index === state.selectedInventorySlot;
      const marker = selected ? theme.selected('>') : ' ';
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const glyph = glyphs[index % glyphs.length] ?? '?';
      const line = `${marker} ${glyph} ${slot.label} @(${slot.x},${slot.y})`;
      gridLines.push(selected ? theme.selected(line) : line);
    }
  }
  return gridLines;
}

function renderLogPane(logSource: string[], logInner: number): string[] {
  const wrappedLog = wrapAllVisible(logSource, Math.max(1, logInner));
  const logViewport = Math.min(Math.max(wrappedLog.length, 1), COMBAT_LOG_MAX_VIEWPORT);
  return renderScrollZone({
    lines: wrappedLog,
    viewportHeight: logViewport,
    autoTail: true,
  });
}

function renderGameplay(state: AppState, cols: number): string[] {
  const bagOpen = state.overlay === 'inventory';
  const explore = isExplorePhase(state) || state.sessionPhase === 'adventure_victory' || state.sessionPhase === 'adventure_defeat';
  const floorLabel =
    state.levelCount !== undefined && state.levelCount > 1
      ? ` L${(state.levelIndex ?? 0) + 1}/${state.levelCount}`
      : '';
  const phaseLine = explore
    ? theme.muted(
        state.sessionPhase === 'adventure_victory'
          ? state.levelCount && state.levelCount > 1
            ? 'Adventure victory — evacuated'
            : 'Adventure victory — level cleared'
          : state.sessionPhase === 'adventure_defeat'
            ? 'Adventure defeat'
            : state.pendingCombat
              ? `Explore${floorLabel} R${state.exploreRound ?? '?'} — confirm fight in ${state.currentRoomId ?? '?'}`
              : state.interactionPrompt
                ? `Explore${floorLabel} — interaction (digits choose, X cancel)`
                : `Explore${floorLabel} R${state.exploreRound ?? '?'} AP ${state.exploreAp ?? '?'}/${state.maxExploreAp ?? '?'} — ${state.currentRoomId ?? '?'} (I interact | F end round)`,
      )
    : state.combatResult !== undefined
      ? theme.muted(
          state.combatResult === 'victory'
            ? 'Combat ended — pick loot (1-9) | P pickup | A all | B bag'
            : 'Combat ended — defeat',
        )
      : theme.muted(`Phase:${state.combatPhase} | Turn:${state.turnOwner}`);

  const contentWidth = Math.max(cols - 2, 40);
  const bottom = bottomLeftPane(state);
  const rightTitle = explore ? 'Map' : 'Enemies';
  const logTitle = explore ? 'Explore Log' : 'Combat Log';
  const logSource =
    state.combatLog.length > 0
      ? state.combatLog.map((line) => theme.log(line))
      : [theme.muted(explore ? 'Ready to explore.' : 'Battle ready.')];

  if (cols < NARROW_COLS) {
    const paneWidth = contentWidth;
    const logInner = Math.max(paneWidth - 4, 8);
    const logLines = renderLogPane(logSource, logInner);
    const topBlocks = bagOpen
      ? [
          ...renderBox('Equipment', renderEquipmentLines(state), paneWidth),
          ...renderBox(
            `Grid ${state.inventoryWidth}x${state.inventoryHeight}`,
            renderGridLines(state),
            paneWidth,
          ),
        ]
      : (() => {
          const enemyInner = Math.max(paneWidth - 4, 8);
          const playerLines = playerPaneLines(state);
          const enemyLines = enemyPaneLines(state, enemyInner);
          const topHeight = Math.max(playerLines.length, enemyLines.length);
          const paddedPlayer = [
            ...playerLines,
            ...Array.from({ length: topHeight - playerLines.length }, () => ''),
          ];
          const paddedEnemy = [
            ...enemyLines,
            ...Array.from({ length: topHeight - enemyLines.length }, () => ''),
          ];
          return [
            ...renderBox('Player', paddedPlayer, paneWidth),
            ...renderBox(rightTitle, paddedEnemy, paneWidth),
          ];
        })();

    const bagHints = bagOpen
      ? [
          theme.muted(
            'Bag:Tab | E equip | U unequip | T tidy | D discard | Enter x y [rot] | Esc',
          ),
        ]
      : [];

    return [
      phaseLine,
      ...topBlocks,
      ...renderBox(bottom.title, bottom.lines, paneWidth),
      ...renderBox(logTitle, logLines, paneWidth),
      ...bagHints,
    ];
  }

  const topPair = bagOpen
    ? splitSharedPairWidths(contentWidth, EQUIP_GRID_RATIO)
    : splitSharedPairWidths(contentWidth, 0.5);
  const bottomPair = splitSharedPairWidths(contentWidth, HAND_LOG_RATIO);
  const logInner = Math.max(bottomPair.right - 4, 8);
  const logLines = renderLogPane(logSource, logInner);

  const topRow = bagOpen
    ? renderTwinBoxes(
        'Equipment',
        renderEquipmentLines(state),
        topPair.left,
        `Grid ${state.inventoryWidth}x${state.inventoryHeight}`,
        renderGridLines(state),
        topPair.right,
      )
    : renderTwinBoxes(
        'Player',
        playerPaneLines(state),
        topPair.left,
        rightTitle,
        enemyPaneLines(state, Math.max(topPair.right - 4, 8)),
        topPair.right,
      );

  const bottomRow = renderTwinBoxes(
    bottom.title,
    bottom.lines,
    bottomPair.left,
    logTitle,
    logLines,
    bottomPair.right,
  );

  const bagHints = bagOpen
    ? [
        theme.muted(
          'Bag:Tab panel | E equip | U unequip | T tidy | D discard | Enter x y [rot] | Esc',
        ),
      ]
    : [];

  return [phaseLine, ...topRow, ...bottomRow, ...bagHints];
}

function renderOverlay(state: AppState): string[] {
  switch (state.overlay) {
    case 'inventory':
      // Inventory is drawn in-frame (top row); no stacked overlay.
      return [];
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

function footerForState(state: AppState): string {
  if (state.overlay === 'inventory') {
    return 'Tab Panel | E/U Equip | T Tidy | D Discard | B/Esc Close bag | Q Quit';
  }
  if (isExplorePhase(state)) {
    return state.pendingCombat
      ? 'Enter/C Fight | P Pickup | WASD Move | B Bag | ~ Console | Q Quit'
      : state.interactionPrompt
        ? '1-9 Choose | X Cancel | B Bag | Q Quit'
        : 'WASD Move | I Interact | 1-9 Loot | P Pickup | L Leave | F End round | B Bag | Q Quit';
  }
  if (state.sessionPhase === 'adventure_victory' || state.sessionPhase === 'adventure_defeat') {
    return 'console:dungeon | console:battle | B Bag | Q Quit';
  }
  if (isLootHandMode(state)) {
    return state.pendingLoot.length > 0
      ? '1-9 Select loot | P Pickup | A All | B Bag | ~ Console | Q Quit'
      : 'Loot clear | B Bag | ~ Console | console:battle restart | Q Quit';
  }
  if (state.combatResult === 'defeat') {
    return 'B Bag | ~ Console | console:battle restart | Q Quit';
  }
  return 'Space Commit | Esc/x Cancel | F End Turn | P/E Stats | B Bag | ~ Console | Q Quit';
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

  if (state.overlay !== 'none' && state.overlay !== 'inventory') {
    lines.push('');
    lines.push(...renderOverlay(state));
  }

  lines.push('');
  lines.push(theme.footer(footerForState(state)));
  return `${lines.join('\n')}\n`;
}
