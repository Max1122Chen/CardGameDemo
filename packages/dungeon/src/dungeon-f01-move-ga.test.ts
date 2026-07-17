import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { COMBAT_PLAYER_ID } from '@cardgame/combat';

import { AdventureSession } from './adventure-session.js';
import { AdventureError } from './errors.js';
import {
  activateDungeonMove,
  DUNGEON_MOVE_ABILITY_ID,
  ensureExplorePlayerForMove,
  loadDungeonMoveAbility,
} from './move-ability.js';
import { loadLevelFromRepo } from './load-level.js';

describe('DUNGEON-F01 S07 ga.dungeon.move', () => {
  it('loads ga.dungeon.move wire from repo', () => {
    const engine = RuleEngine.create();
    const def = loadDungeonMoveAbility(engine);
    expect(def.id).toBe(DUNGEON_MOVE_ABILITY_ID);
    expect(def.handlerId).toBe('dungeon.move');
    expect(def.parameterSchema?.MovementCost?.default).toBe(0);
  });

  it('activateDungeonMove commits room change with cost 0', () => {
    const engine = RuleEngine.create();
    const adventure = AdventureSession.start(loadLevelFromRepo('level.probe'));
    const player = ensureExplorePlayerForMove(engine);

    activateDungeonMove({
      engine,
      player,
      adventure,
      direction: 'east',
    });

    expect(adventure.getCurrentRoomId()).toBe('hall_a');
    expect(adventure.isPendingCombat()).toBe(true);
    expect(adventure.getSnapshot().log.some((line) => line.includes('cost 0'))).toBe(true);
    expect(player.listGrantedAbilities().some((a) => a.abilityDefId === DUNGEON_MOVE_ABILITY_ID)).toBe(
      true,
    );
  });

  it('applyAction Move and GA path share exit validation', () => {
    const engine = RuleEngine.create();
    const adventure = AdventureSession.start(loadLevelFromRepo('level.probe'));
    const player = ensureExplorePlayerForMove(engine);

    expect(() => adventure.applyAction({ type: 'Move', direction: 'north' })).toThrow(
      AdventureError,
    );
    expect(() =>
      activateDungeonMove({ engine, player, adventure, direction: 'north' }),
    ).toThrow(AdventureError);

    adventure.applyAction({ type: 'Move', direction: 'east' });
    expect(adventure.getCurrentRoomId()).toBe('hall_a');
  });

  it('blocks move while pending combat (GA path)', () => {
    const engine = RuleEngine.create();
    const adventure = AdventureSession.start(loadLevelFromRepo('level.probe'));
    const player = ensureExplorePlayerForMove(engine);

    activateDungeonMove({ engine, player, adventure, direction: 'east' });
    expect(adventure.isPendingCombat()).toBe(true);

    expect(() =>
      activateDungeonMove({ engine, player, adventure, direction: 'west' }),
    ).toThrow(/Confirm combat|cannot_activate/i);
  });

  it('ensureExplorePlayerForMove reuses COMBAT_PLAYER_ID entity', () => {
    const engine = RuleEngine.create();
    engine.createEntityWithGfc(COMBAT_PLAYER_ID);
    const player = ensureExplorePlayerForMove(engine);
    expect(player.entityId).toBe(COMBAT_PLAYER_ID);
    const again = ensureExplorePlayerForMove(engine);
    expect(again.entityId).toBe(COMBAT_PLAYER_ID);
    expect(
      again.listGrantedAbilities().filter((a) => a.abilityDefId === DUNGEON_MOVE_ABILITY_ID),
    ).toHaveLength(1);
  });
});
