import type { SessionController } from '../session/session-controller.js';
import type { AppState, EntityStatsView } from '../types.js';
import { padVisible, style, ANSI } from './ansi.js';
import { formatPlayerStats, formatPrimaryStat, primaryColors, theme } from './theme.js';
import { renderScrollZone } from './widgets/scroll-zone.js';

const COMBAT_LOG_VIEWPORT = 8;
const CONSOLE_SCROLLBACK_VIEWPORT = 6;
const TRACE_VIEWPORT = 6;

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

function formatDamageBreakdown(preview: NonNullable<AppState['preview']>): string | undefined {
  const breakdown = preview.damageBreakdown;
  if (!breakdown) {
    return undefined;
  }
  const bonusSign = breakdown.bonus >= 0 ? '+' : '';
  return theme.intent(
    `dmg: ${breakdown.panel}${bonusSign}${breakdown.bonus} ×${breakdown.scaling} ×${breakdown.multiplier} +${breakdown.offset} → ${breakdown.outgoing}`,
  );
}

function renderStatsOverlay(title: string, stats: EntityStatsView): string[] {
  const p = stats.primaries;
  const lines = [
    `${formatPlayerStats(stats.health, stats.block, stats.actionPoints ?? 0, stats.maxHealth, stats.maxActionPoints)}`,
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
    `${theme.muted('Damage')} scale×${stats.damageScaling ?? 1} mult×${stats.damageMultiplier ?? 1} off+${stats.damageOffset ?? 0}`,
    theme.muted('Esc closes stats overlay.'),
  ];
  return box(title, lines);
}

function renderGameplay(state: AppState): string[] {
  const phaseLine =
    state.combatResult !== undefined
      ? theme.header(`${state.combatResult === 'victory' ? 'Victory' : 'Defeat'}!`)
      : theme.muted(`Phase: ${state.combatPhase} | Turn: ${state.turnOwner}`);

  const enemyLines =
    state.enemies.length === 0
      ? [theme.muted('(no enemies)')]
      : state.enemies.map((enemy, index) => {
          const selected = index === state.selectedEnemyIndex;
          const marker = selected ? theme.selected('>') : ' ';
          const take =
            enemy.previewDamageToTake !== undefined
              ? ` ${theme.intent(`take:${enemy.previewDamageToTake}`)}`
              : '';
          const block =
            enemy.block !== undefined && enemy.block > 0
              ? ` ${theme.muted(`blk:${enemy.block}`)}`
              : '';
          const line = `${marker} [${index}] ${theme.enemyName(enemy.name)} ${theme.healthLabel('HP')}:${theme.healthValue(enemy.health)}${block} ${theme.intent(`intent:${enemy.intent}`)}${take}`;
          return selected ? theme.selected(line) : line;
        });

  const handLines =
    state.hand.length === 0
      ? [theme.muted('(empty hand)')]
      : state.hand.map((card, index) => {
          const selected = index === state.selectedHandIndex;
          const marker = selected ? theme.selected('>') : ' ';
          let effectHint = '';
          if (selected && state.preview) {
            if (state.preview.blockToGain !== undefined && state.preview.blockToGain > 0) {
              effectHint = ` ${theme.intent(`=> blk+${state.preview.blockToGain}`)}`;
            } else if (state.preview.damageToTake !== undefined) {
              effectHint = ` ${theme.intent(`=> ${state.preview.damageToTake} dmg`)}`;
            }
          }
          const line = `${marker} [${index + 1}] ${theme.cardName(card.name)} (${theme.muted('cost')} ${theme.cardCost(card.cost)})${effectHint}`;
          return selected ? theme.selected(line) : line;
        });

  const logSource =
    state.combatLog.length > 0 ? state.combatLog.map((line) => theme.log(line)) : [theme.muted('Battle ready.')];
  const logLines = renderScrollZone({
    lines: logSource,
    viewportHeight: COMBAT_LOG_VIEWPORT,
    autoTail: true,
  });

  const playerPreview =
    state.preview?.blockToGain !== undefined && state.preview.blockToGain > 0
      ? ` ${theme.intent(`preview blk+${state.preview.blockToGain}`)}`
      : state.preview?.damageBreakdown
        ? ` ${formatDamageBreakdown(state.preview) ?? ''}`
        : '';

  return [
    phaseLine,
    ...box('Player', [
      `${formatPlayerStats(
        state.playerHealth,
        state.playerBlock,
        state.actionPoints,
        state.playerStats?.maxHealth,
        state.playerStats?.maxActionPoints,
      )}${playerPreview}`,
      theme.status(state.statusMessage),
    ]),
    ...box('Enemies', enemyLines),
    ...box('Hand', handLines),
    ...box('Combat Log', logLines),
  ];
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
      ? theme.status('Loot: P auto | Enter place | A all | Tab panel')
      : theme.muted('No pending loot.');

  return [
    ...box('Loot', lootLines),
    ...box(`Grid ${state.inventoryWidth}x${state.inventoryHeight}`, gridLines),
    ...box('Backpack', backpackLines),
    ...box('Equipment', equipmentLines),
    placePrompt,
    lootHint,
    theme.muted(
      'Bag: Tab panel | E equip | U unequip | T tidy | D discard | Enter x y [rot] | Esc',
    ),
  ];
}

function renderOverlay(state: AppState): string[] {
  switch (state.overlay) {
    case 'inventory':
      return renderInventoryOverlay(state);
    case 'settings':
      return box('Settings', [
        `${theme.muted('Mode:')} ${style(state.runtimeMode, ANSI.fg.brightWhite)}`,
        `${theme.muted('Seed:')} ${style(String(state.seed ?? '(none)'), ANSI.fg.brightWhite)}`,
        `${theme.muted('Scenario:')} ${style(String(state.scenarioId ?? '(none)'), ANSI.fg.brightWhite)}`,
        theme.muted('Trace pane: toggle with T'),
        theme.muted('Esc closes overlay.'),
      ]);
    case 'console': {
      const scrollback = renderScrollZone({
        lines: state.consoleScrollback.map((line) => theme.muted(line)),
        viewportHeight: CONSOLE_SCROLLBACK_VIEWPORT,
        autoTail: true,
      });
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
  return box('Trace', lines.length > 0 ? lines : [theme.muted('(no trace entries)')]);
}

export function renderFrame(state: AppState, controller: SessionController): string {
  const header = theme.header(
    `CardGameDemo [${state.runtimeMode}] seed=${state.seed ?? '-'} scenario=${state.scenarioId ?? '-'}`,
  );
  const lines = [header, ...renderGameplay(state)];

  if (state.showTracePane) {
    lines.push(...renderTracePane(controller));
  }

  if (state.overlay !== 'none') {
    lines.push('');
    lines.push(...renderOverlay(state));
  }

  if (state.statsOverlay === 'player' && state.playerStats) {
    lines.push('');
    lines.push(...renderStatsOverlay('Player Stats', state.playerStats));
  } else if (state.statsOverlay === 'enemy' && state.enemyStats) {
    lines.push('');
    lines.push(...renderStatsOverlay('Enemy Stats', state.enemyStats));
  }

  lines.push('');
  lines.push(
    theme.footer(
      'Space Commit | Esc/x Cancel | F End Turn | P/E Stats | B Backpack/Loot | ~ Console | Q Quit',
    ),
  );
  return `${lines.join('\n')}\n`;
}
