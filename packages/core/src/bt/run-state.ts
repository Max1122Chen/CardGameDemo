import type { BtNode } from './types.js';

/** Per-tick mutable indices for composite nodes (keyed by node reference). */
export type BehaviorTreeRunState = {
  sequenceIndex: WeakMap<BtNode, number>;
  selectorIndex: WeakMap<BtNode, number>;
};

export function createBehaviorTreeRunState(): BehaviorTreeRunState {
  return {
    sequenceIndex: new WeakMap(),
    selectorIndex: new WeakMap(),
  };
}

export function resetBehaviorTreeRunState(state: BehaviorTreeRunState): void {
  state.sequenceIndex = new WeakMap();
  state.selectorIndex = new WeakMap();
}
