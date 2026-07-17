import { createGameplayEvent } from '@cardgame/core';

import type { SessionController } from '../session/session-controller.js';

export type ConsoleResult = {
  lines: string[];
  statusMessage: string;
};

function formatState(controller: SessionController): string[] {
  const lines: string[] = [];
  for (const entityId of controller.engine.gameWorld.listEntities()) {
    const gfc = controller.engine.getGfc(entityId);
    if (!gfc) {
      continue;
    }
    lines.push(`[${entityId}]`);
    const snapshot = gfc.toJSON();
    for (const attr of snapshot.attributes) {
      lines.push(`  ${attr.attribute}: ${attr.currentValue} (base ${attr.baseValue})`);
    }
    if (snapshot.tags.length > 0) {
      lines.push(`  tags: ${snapshot.tags.map((tag) => tag.name).join(', ')}`);
    }
    if (snapshot.activeEffects.length > 0) {
      lines.push(`  effects: ${snapshot.activeEffects.map((effect) => effect.definitionId).join(', ')}`);
    }
  }
  return lines.length > 0 ? lines : ['No entities in session.'];
}

export function executeConsoleCommand(controller: SessionController, input: string): ConsoleResult {
  const [command, ...args] = input.split(/\s+/);

  switch (command) {
    case 'help':
      return {
        lines: [
          'Commands:',
          '  help',
          '  battle [enemyId] restart BattleOnly virtual room (slime | orc_brute)',
          '  dungeon [levelId] start dungeon explore (default level.probe)',
          '  state [entityId]',
          '  trace [on|off]',
          '  event <tag> [channel]',
          '  attr <entity> <attribute> <value>',
        ],
        statusMessage: 'Console help displayed.',
      };
    case 'battle': {
      const enemyId = args[0];
      controller.sessionKind = 'adventure';
      controller.bootstrapBattle(enemyId);
      const label = enemyId ?? controller.enemyCharacterId;
      return {
        lines: [`Started BattleOnly vs ${label}. Confirm combat with Enter/C.`],
        statusMessage: `BattleOnly ready vs ${label} — confirm to fight.`,
      };
    }
    case 'dungeon': {
      const levelId = args[0] ?? 'level.probe';
      controller.startDungeon(levelId);
      return {
        lines: [`Started dungeon level ${levelId}.`],
        statusMessage: `Dungeon ${levelId} — WASD to move.`,
      };
    }
    case 'state': {
      const entityId = args[0];
      if (!entityId) {
        return { lines: formatState(controller), statusMessage: 'Displayed all entity state.' };
      }
      const gfc = controller.engine.getGfc(entityId);
      if (!gfc) {
        return { lines: [`Unknown entity: ${entityId}`], statusMessage: 'Entity not found.' };
      }
      const lines: string[] = [];
      let capture = false;
      for (const line of formatState(controller)) {
        if (line.startsWith('[')) {
          capture = line === `[${entityId}]`;
        }
        if (capture) {
          lines.push(line);
        }
      }
      return {
        lines: lines.length > 0 ? lines : [`No state for ${entityId}.`],
        statusMessage: `Displayed state for ${entityId}.`,
      };
    }
    case 'trace': {
      const mode = args[0] ?? 'on';
      if (mode === 'off') {
        return { lines: ['Trace pane hidden.'], statusMessage: 'Trace pane off.' };
      }
      return {
        lines: controller.traceLines.slice(-8),
        statusMessage: 'Trace tail displayed.',
      };
    }
    case 'event': {
      const tagName = args[0];
      if (!tagName) {
        return { lines: ['Usage: event <tag> [channel]'], statusMessage: 'Missing event tag.' };
      }
      const tag = controller.engine.tagManager.resolve(tagName);
      const channelName = args[1] ?? 'Combat';
      const channel = controller.engine.eventSystem.channel(
        controller.engine.tagManager.resolve(channelName),
      );
      controller.engine.eventSystem.dispatch(
        channel,
        createGameplayEvent(controller.engine.tagManager, { tags: [tag] }),
      );
      return { lines: [`Dispatched ${tagName} on ${channelName}.`], statusMessage: 'Event dispatched.' };
    }
    case 'attr': {
      const [entityId, attribute, rawValue] = args;
      if (!entityId || !attribute || rawValue === undefined) {
        return { lines: ['Usage: attr <entity> <attribute> <value>'], statusMessage: 'Invalid attr command.' };
      }
      const gfc = controller.engine.getGfc(entityId);
      if (!gfc) {
        return { lines: [`Unknown entity: ${entityId}`], statusMessage: 'Entity not found.' };
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        return { lines: [`Invalid number: ${rawValue}`], statusMessage: 'Invalid attribute value.' };
      }
      gfc.setAttributeBase(attribute, value);
      return {
        lines: [`Set ${entityId}.${attribute} base to ${value}.`],
        statusMessage: `Updated ${entityId}.${attribute}.`,
      };
    }
    default:
      return { lines: [`Unknown command: ${command}`], statusMessage: 'Unknown console command.' };
  }
}
