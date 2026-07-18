import type { InteractionHost } from './types.js';

export type MemoryInteractionHostState = {
  health: number;
  maxHealth: number;
  /** itemId → quantity */
  items: Record<string, number>;
  log: string[];
};

/** In-memory host for unit tests (no RuleEngine / inventory grid). */
export function createMemoryInteractionHost(
  initial: Partial<MemoryInteractionHostState> = {},
): InteractionHost & { state: MemoryInteractionHostState } {
  const state: MemoryInteractionHostState = {
    health: initial.health ?? 20,
    maxHealth: initial.maxHealth ?? 30,
    items: { ...(initial.items ?? {}) },
    log: [...(initial.log ?? [])],
  };

  return {
    state,
    getHealth: () => state.health,
    getMaxHealth: () => state.maxHealth,
    heal(amount: number) {
      const before = state.health;
      state.health = Math.min(state.maxHealth, state.health + Math.max(0, amount));
      return state.health - before;
    },
    hasItem(itemId: string, quantity: number) {
      return (state.items[itemId] ?? 0) >= quantity;
    },
    tryTakeItem(itemId: string, quantity: number) {
      const have = state.items[itemId] ?? 0;
      if (have < quantity) {
        return false;
      }
      const next = have - quantity;
      if (next <= 0) {
        delete state.items[itemId];
      } else {
        state.items[itemId] = next;
      }
      return true;
    },
    log(message: string) {
      state.log.push(message);
    },
  };
}
