import type { DialogueFrame, Interactable, InteractionHost } from './types.js';

const FUEL_ITEM = 'scrap_metal';
const FUEL_QTY = 1;
const HEAL_AMOUNT = 5;

/** Abandoned forge: spend scrap metal to mend wounds (simple facility). */
export function createAbandonedForge(id: string): Interactable {
  const frame = (host: InteractionHost): DialogueFrame => {
    const hasFuel = host.hasItem(FUEL_ITEM, FUEL_QTY);
    return {
      prompt: 'An abandoned forge still holds a faint ember under cold ash.',
      options: [
        ...(hasFuel
          ? [{ id: 'stoke', label: `Stoke with scrap metal (restore ${HEAL_AMOUNT} HP)` }]
          : [{ id: 'stoke_fail', label: 'Need scrap metal to stoke the forge' }]),
        { id: 'leave', label: 'Leave' },
      ],
    };
  };

  return {
    id,
    kind: 'facility',
    displayName: 'Abandoned Forge',
    canInteract: () => true,
    begin(host) {
      return frame(host);
    },
    choose(optionId, host) {
      if (optionId === 'leave') {
        return null;
      }
      if (optionId === 'stoke_fail') {
        host.log('Without scrap metal, the forge stays cold.');
        return frame(host);
      }
      if (optionId === 'stoke') {
        if (!host.tryTakeItem(FUEL_ITEM, FUEL_QTY)) {
          host.log('Stoke failed: no scrap metal.');
          return frame(host);
        }
        const healed = host.heal(HEAL_AMOUNT);
        host.log(
          healed > 0
            ? `You feed the forge. Warmth restores ${healed} HP.`
            : 'The forge flares, but you are already at full health.',
        );
        return frame(host);
      }
      host.log(`Unknown option: ${optionId}`);
      return frame(host);
    },
  };
}
