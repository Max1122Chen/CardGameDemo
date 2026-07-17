import type { PrimaryStats } from '@cardgame/characters';
import type { Blackboard } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';

import { getEntityActionPoints, getEntityBlock, getEntityHealth, getEntityMaxHealth } from './combat-damage.js';

export const ENEMY_BB_KEYS = {
  intelligence: 'intelligence',
  selfHp: 'selfHp',
  selfMaxHp: 'selfMaxHp',
  selfHpPct: 'selfHpPct',
  selfBlock: 'selfBlock',
  selfAp: 'selfAp',
  playerHp: 'playerHp',
  playerMaxHp: 'playerMaxHp',
  playerHpPct: 'playerHpPct',
  playerBlock: 'playerBlock',
  selfLowHpThreshold: 'selfLowHpThreshold',
  playerLowHpThreshold: 'playerLowHpThreshold',
  selfLowHp: 'selfLowHp',
  playerLowHp: 'playerLowHp',
} as const;

export type EnemyWhenCondition = 'selfLowHp' | 'playerLowHp';

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeEnemyHpThresholds(intelligence: number): {
  selfLowHpThreshold: number;
  playerLowHpThreshold: number;
} {
  return {
    selfLowHpThreshold: clamp(0.22, 0.48, 0.48 - intelligence * 0.013),
    playerLowHpThreshold: clamp(0.18, 0.4, 0.4 - intelligence * 0.009),
  };
}

export function fillEnemyBlackboard(args: {
  blackboard: Blackboard;
  primaries: PrimaryStats;
  enemy: GameplayFrameworkComponent;
  player: GameplayFrameworkComponent;
}): void {
  const { blackboard, primaries, enemy, player } = args;
  const selfHp = getEntityHealth(enemy);
  const selfMaxHp = getEntityMaxHealth(enemy);
  const playerHp = getEntityHealth(player);
  const playerMaxHp = getEntityMaxHealth(player);
  const selfHpPct = selfMaxHp > 0 ? clamp(0, 1, selfHp / selfMaxHp) : 0;
  const playerHpPct = playerMaxHp > 0 ? clamp(0, 1, playerHp / playerMaxHp) : 0;
  const thresholds = computeEnemyHpThresholds(primaries.intelligence);

  blackboard.set(ENEMY_BB_KEYS.intelligence, primaries.intelligence);
  blackboard.set(ENEMY_BB_KEYS.selfHp, selfHp);
  blackboard.set(ENEMY_BB_KEYS.selfMaxHp, selfMaxHp);
  blackboard.set(ENEMY_BB_KEYS.selfHpPct, selfHpPct);
  blackboard.set(ENEMY_BB_KEYS.selfBlock, getEntityBlock(enemy));
  blackboard.set(ENEMY_BB_KEYS.selfAp, getEntityActionPoints(enemy));
  blackboard.set(ENEMY_BB_KEYS.playerHp, playerHp);
  blackboard.set(ENEMY_BB_KEYS.playerMaxHp, playerMaxHp);
  blackboard.set(ENEMY_BB_KEYS.playerHpPct, playerHpPct);
  blackboard.set(ENEMY_BB_KEYS.playerBlock, getEntityBlock(player));
  blackboard.set(ENEMY_BB_KEYS.selfLowHpThreshold, thresholds.selfLowHpThreshold);
  blackboard.set(ENEMY_BB_KEYS.playerLowHpThreshold, thresholds.playerLowHpThreshold);
  blackboard.set(ENEMY_BB_KEYS.selfLowHp, selfHpPct < thresholds.selfLowHpThreshold);
  blackboard.set(ENEMY_BB_KEYS.playerLowHp, playerHpPct < thresholds.playerLowHpThreshold);
}

export function evaluateEnemyWhenCondition(
  blackboard: Blackboard,
  when: EnemyWhenCondition,
): boolean {
  const key =
    when === 'selfLowHp' ? ENEMY_BB_KEYS.selfLowHp : ENEMY_BB_KEYS.playerLowHp;
  return blackboard.get(key) === true;
}
