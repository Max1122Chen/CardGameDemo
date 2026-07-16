import type { EnemyIntent } from './types.js';
import { COMBAT_ENEMY_ID } from './types.js';

export type EnemyScript = {
  entityId: typeof COMBAT_ENEMY_ID;
  name: string;
  getIntent(): EnemyIntent;
};

export function createSlimeScript(attackDamage: number): EnemyScript {
  return {
    entityId: COMBAT_ENEMY_ID,
    name: 'Slime',
    getIntent(): EnemyIntent {
      return { kind: 'Attack', damage: attackDamage };
    },
  };
}
