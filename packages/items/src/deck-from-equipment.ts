import type { ItemDefinition, ItemId } from './item-definition.js';
import { getEquipmentFragment } from './fragments.js';
import { listEquippedPieces, type EquipmentLoadout } from './equipment-loadout.js';

/** Expand base deck ids with cards granted by currently equipped pieces. */
export function buildDeckIdsFromLoadout(
  baseDeckIds: readonly string[],
  loadout: EquipmentLoadout,
  catalog: Record<ItemId, ItemDefinition>,
): string[] {
  const deck = [...baseDeckIds];
  const seen = new Set<string>();

  for (const piece of listEquippedPieces(loadout)) {
    if (seen.has(piece.entryId)) {
      continue;
    }
    seen.add(piece.entryId);
    const def = catalog[piece.itemId];
    const equipment = def ? getEquipmentFragment(def.fragments) : undefined;
    if (!equipment) {
      continue;
    }
    for (const grant of equipment.cards) {
      for (let index = 0; index < grant.count; index += 1) {
        deck.push(grant.cardId);
      }
    }
  }

  return deck;
}
