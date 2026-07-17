import type { AppState } from './types.js';

/**
 * After victory, bottom-left pane stays as Loot (even when empty after pickup).
 */
export function isLootHandMode(state: AppState): boolean {
  return state.sessionPhase === 'standalone_combat' && state.combatResult === 'victory';
}

export function isExplorePhase(state: AppState): boolean {
  return state.sessionPhase === 'adventure_explore';
}

export function isAdventureCombatPhase(state: AppState): boolean {
  return state.sessionPhase === 'adventure_combat';
}
