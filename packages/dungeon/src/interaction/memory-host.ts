import type { InteractionHost } from './types.js';

export type MemoryInteractionHostState = {
  health: number;
  maxHealth: number;
  /** itemId → quantity */
  items: Record<string, number>;
  log: string[];
  /** Deterministic RNG sequence for tests (optional). */
  randoms?: number[];
  checkModifiers?: Record<string, number>;
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
    randoms: initial.randoms ? [...initial.randoms] : undefined,
    checkModifiers: { ...(initial.checkModifiers ?? {}) },
  };
  let randomIndex = 0;
  let fallbackSeed = 1;

  return {
    state,
    getHealth: () => state.health,
    getMaxHealth: () => state.maxHealth,
    heal(amount: number) {
      const before = state.health;
      state.health = Math.min(state.maxHealth, state.health + Math.max(0, amount));
      return state.health - before;
    },
    damage(amount: number) {
      const before = state.health;
      state.health = Math.max(0, state.health - Math.max(0, amount));
      return before - state.health;
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
    tryGiveItem(itemId: string, quantity: number) {
      if (quantity < 1) {
        return false;
      }
      state.items[itemId] = (state.items[itemId] ?? 0) + quantity;
      return true;
    },
    nextRandom() {
      if (state.randoms && randomIndex < state.randoms.length) {
        const value = state.randoms[randomIndex]!;
        randomIndex += 1;
        return value;
      }
      // Mulberry-ish fallback so tests without scripted rolls still run.
      fallbackSeed = (fallbackSeed * 1664525 + 1013904223) >>> 0;
      return fallbackSeed / 0x100000000;
    },
    getCheckModifier(key: string) {
      return state.checkModifiers?.[key] ?? 0;
    },
    log(message: string) {
      state.log.push(message);
    },
  };
}
