import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AbilityActivationRegistry, GameplayAbilityDefinition, RuleEngine } from '@cardgame/core';
import { parseGameplayAbilityDefinition } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';
import { COMBAT_PLAYER_ID } from '@cardgame/combat';

import type { AdventureSession } from './adventure-session.js';
import { AdventureError } from './errors.js';
import type { RoomDirection } from './types.js';

export const DUNGEON_MOVE_ABILITY_ID = 'ga.dungeon.move';
export const DUNGEON_MOVE_HANDLER_ID = 'dungeon.move';

export type DungeonMoveBridge = {
  commitMove: (direction: RoomDirection, movementCost: number) => void;
};

const DUNGEON_ABILITY_REG_KEY = Symbol.for('@cardgame/dungeon.abilityRegistration');

type RegistryHost = AbilityActivationRegistry & {
  [DUNGEON_ABILITY_REG_KEY]?: { setBridge: (bridge: DungeonMoveBridge) => void };
};

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'data', 'abilities'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/abilities)');
}

export function loadDungeonMoveAbility(engine: RuleEngine): GameplayAbilityDefinition {
  const dataRoot = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'data');
  const wire = JSON.parse(
    readFileSync(join(dataRoot, 'abilities', 'dungeon-move.json'), 'utf8'),
  ) as Parameters<typeof parseGameplayAbilityDefinition>[0];
  return parseGameplayAbilityDefinition(wire, engine.tagManager);
}

/** Register dungeon.move handler (idempotent); bridge replaced per activation host. */
export function registerDungeonAbilityHandlers(
  registry: AbilityActivationRegistry,
): { setBridge: (bridge: DungeonMoveBridge) => void } {
  const host = registry as RegistryHost;
  const existing = host[DUNGEON_ABILITY_REG_KEY];
  if (existing) {
    return existing;
  }

  let bridge: DungeonMoveBridge | undefined;
  registry.set(DUNGEON_MOVE_HANDLER_ID, {
    onActivate({ ctx, services }) {
      if (!bridge) {
        throw new AdventureError('Dungeon move bridge not attached');
      }
      const direction = ctx.payload?.direction;
      if (
        direction !== 'north' &&
        direction !== 'south' &&
        direction !== 'east' &&
        direction !== 'west'
      ) {
        return { ok: false, reason: 'cannot_activate' };
      }
      const movementCost =
        typeof services.parameters.MovementCost === 'number'
          ? services.parameters.MovementCost
          : 0;
      bridge.commitMove(direction, movementCost);
      services.endAbility();
      return { ok: true, data: { direction, movementCost } };
    },
  });

  const registration = {
    setBridge: (next: DungeonMoveBridge) => {
      bridge = next;
    },
  };
  host[DUNGEON_ABILITY_REG_KEY] = registration;
  return registration;
}

export function ensureDungeonMoveAbility(
  gfc: GameplayFrameworkComponent,
  engine: RuleEngine,
): string {
  const existing = gfc
    .listGrantedAbilities()
    .find((entry) => entry.abilityDefId === DUNGEON_MOVE_ABILITY_ID);
  if (existing) {
    return existing.handle;
  }
  const def = loadDungeonMoveAbility(engine);
  return gfc.grantAbility(def);
}

/**
 * Activate ga.dungeon.move: validates via AdventureSession, cost from getMovementCost (F01 = 0).
 */
export function activateDungeonMove(options: {
  engine: RuleEngine;
  player: GameplayFrameworkComponent;
  adventure: AdventureSession;
  direction: RoomDirection;
}): void {
  const { engine, player, adventure, direction } = options;
  const registration = registerDungeonAbilityHandlers(engine.activationRegistry);
  registration.setBridge({
    commitMove: (dir, cost) => {
      adventure.commitMove(dir, cost);
    },
  });

  const handle = ensureDungeonMoveAbility(player, engine);
  const movementCost = adventure.getMovementCost(direction);
  if (movementCost === undefined) {
    throw new AdventureError(`Cannot move ${direction}`);
  }
  const result = player.tryActivate(handle, {
    instigatorEntityId: player.entityId,
    sourceEntityId: player.entityId,
    targetEntityId: player.entityId,
    parameters: { MovementCost: movementCost },
    payload: { direction },
  });
  if (!result.ok) {
    throw new AdventureError(`Dungeon move failed: ${result.reason}`);
  }
}

/** Ensure explore-phase player entity can activate ga.dungeon.move. */
export function ensureExplorePlayerForMove(engine: RuleEngine): GameplayFrameworkComponent {
  registerDungeonAbilityHandlers(engine.activationRegistry);
  let player = engine.getGfc(COMBAT_PLAYER_ID);
  if (!player) {
    player = engine.createEntityWithGfc(COMBAT_PLAYER_ID);
  }
  ensureDungeonMoveAbility(player, engine);
  return player;
}
