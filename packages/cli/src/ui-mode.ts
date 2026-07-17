import type { AppState } from './types.js';

/**
 * After victory, bottom-left pane stays as Loot (even when empty after pickup).
 */
export function isLootHandMode(state: AppState): boolean {
  return state.combatResult === 'victory';
}
