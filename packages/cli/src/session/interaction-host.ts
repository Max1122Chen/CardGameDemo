import { COMBAT_PLAYER_ID } from '@cardgame/combat';
import type { RuleEngine } from '@cardgame/core';
import { ensureExplorePlayerForMove, type InteractionHost } from '@cardgame/dungeon';
import type { InventoryState } from '@cardgame/items';

function countItem(inventory: InventoryState, itemId: string): number {
  let total = 0;
  for (const entry of inventory.entries) {
    if (entry.payload.itemId !== itemId) {
      continue;
    }
    total += entry.payload.kind === 'stack' ? entry.payload.quantity : 1;
  }
  return total;
}

function takeItem(inventory: InventoryState, itemId: string, quantity: number): boolean {
  if (countItem(inventory, itemId) < quantity) {
    return false;
  }
  let remaining = quantity;
  for (const entry of [...inventory.entries]) {
    if (remaining <= 0) {
      break;
    }
    if (entry.payload.itemId !== itemId) {
      continue;
    }
    if (entry.payload.kind === 'stack') {
      const take = Math.min(entry.payload.quantity, remaining);
      entry.payload.quantity -= take;
      remaining -= take;
      if (entry.payload.quantity <= 0) {
        const idx = inventory.entries.findIndex((e) => e.entryId === entry.entryId);
        if (idx >= 0) {
          inventory.entries.splice(idx, 1);
        }
      }
    } else {
      const idx = inventory.entries.findIndex((e) => e.entryId === entry.entryId);
      if (idx >= 0) {
        inventory.entries.splice(idx, 1);
        remaining -= 1;
      }
    }
  }
  return remaining <= 0;
}

/** Bridge Interactables to explore player GFC + backpack. */
export function createSessionInteractionHost(
  engine: RuleEngine,
  inventory: InventoryState,
  appendLog: (line: string) => void,
): InteractionHost {
  const ensureVitals = () => {
    const player = ensureExplorePlayerForMove(engine);
    const health = player.getAttribute('Health');
    const maxHealth = player.getAttribute('MaxHealth');
    if (!maxHealth) {
      const seed = health?.currentValue ?? 30;
      player.setAttributeBase('MaxHealth', seed);
    }
    if (!health) {
      const max = player.getAttribute('MaxHealth')!.currentValue;
      player.setAttributeBase('Health', max);
    }
    return player;
  };

  return {
    getHealth() {
      return ensureVitals().getAttribute('Health')?.currentValue ?? 0;
    },
    getMaxHealth() {
      return ensureVitals().getAttribute('MaxHealth')?.currentValue ?? 0;
    },
    heal(amount: number) {
      const player = ensureVitals();
      const max = player.getAttribute('MaxHealth')!.currentValue;
      const before = player.getAttribute('Health')!.currentValue;
      const next = Math.min(max, before + Math.max(0, amount));
      player.setAttributeBase('Health', next);
      return next - before;
    },
    hasItem(itemId, quantity) {
      return countItem(inventory, itemId) >= quantity;
    },
    tryTakeItem(itemId, quantity) {
      return takeItem(inventory, itemId, quantity);
    },
    log(message) {
      appendLog(message);
    },
  };
}

export function ensureExplorePlayerEntity(engine: RuleEngine): void {
  ensureExplorePlayerForMove(engine);
  const player = engine.getGfc(COMBAT_PLAYER_ID);
  if (!player) {
    return;
  }
  if (!player.getAttribute('MaxHealth')) {
    player.setAttributeBase('MaxHealth', 30);
  }
  if (!player.getAttribute('Health')) {
    player.setAttributeBase('Health', player.getAttribute('MaxHealth')!.currentValue);
  }
}
