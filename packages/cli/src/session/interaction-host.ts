import { COMBAT_PLAYER_ID } from '@cardgame/combat';
import type { RuleEngine } from '@cardgame/core';
import { ensureExplorePlayerForMove, type InteractionHost } from '@cardgame/dungeon';
import { addToInventory, type InventoryState, type ItemDefinition } from '@cardgame/items';

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

export type SessionInteractionHostOptions = {
  itemCatalog: Record<string, ItemDefinition>;
  /** Seeded RNG from the adventure/level session. */
  nextRandom: () => number;
};

/** Bridge Interactables to explore player GFC + backpack. */
export function createSessionInteractionHost(
  engine: RuleEngine,
  inventory: InventoryState,
  appendLog: (line: string) => void,
  options: SessionInteractionHostOptions,
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
    damage(amount: number) {
      const player = ensureVitals();
      const before = player.getAttribute('Health')!.currentValue;
      const next = Math.max(0, before - Math.max(0, amount));
      player.setAttributeBase('Health', next);
      return before - next;
    },
    hasItem(itemId, quantity) {
      return countItem(inventory, itemId) >= quantity;
    },
    tryTakeItem(itemId, quantity) {
      return takeItem(inventory, itemId, quantity);
    },
    tryGiveItem(itemId, quantity) {
      const result = addToInventory(inventory, options.itemCatalog, itemId, quantity);
      return result.added > 0;
    },
    nextRandom() {
      return options.nextRandom();
    },
    getCheckModifier(key: string) {
      const player = ensureVitals();
      // Map check keys to primary attributes when present (F02 minimal).
      const attrName =
        key === 'dexterity'
          ? 'Dexterity'
          : key === 'strength'
            ? 'Strength'
            : key === 'intelligence'
              ? 'Intelligence'
              : undefined;
      if (!attrName) {
        return 0;
      }
      const value = player.getAttribute(attrName)?.currentValue;
      if (value === undefined) {
        return 0;
      }
      // Soft conversion: every 2 points above 10 → +1 (floor).
      return Math.floor((value - 10) / 2);
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
