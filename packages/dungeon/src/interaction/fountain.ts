import type { DialogueFrame, Interactable, InteractionHost } from './types.js';

const HEAL_AMOUNT = 8;

/** Life fountain: drink to heal; depletes after charges are used up. */
export function createLifeFountain(
  id: string,
  options: { charges?: number; healAmount?: number } = {},
): Interactable {
  let charges = Math.max(0, options.charges ?? 1);
  const healAmount = options.healAmount ?? HEAL_AMOUNT;

  const frame = (): DialogueFrame => {
    if (charges <= 0) {
      return {
        prompt: 'The fountain is dry. The water no longer glows.',
        options: [{ id: 'leave', label: 'Leave' }],
      };
    }
    return {
      prompt: `A quiet fountain of life (${charges} use(s) left). Clear water mirrors your face.`,
      options: [
        { id: 'drink', label: `Drink (restore up to ${healAmount} HP)` },
        { id: 'leave', label: 'Leave' },
      ],
    };
  };

  return {
    id,
    kind: 'facility',
    displayName: 'Fountain of Life',
    canInteract: () => true,
    begin(_host: InteractionHost) {
      return frame();
    },
    choose(optionId: string, host: InteractionHost) {
      if (optionId === 'leave') {
        return null;
      }
      if (optionId === 'drink') {
        if (charges <= 0) {
          host.log('The fountain is already dry.');
          return frame();
        }
        const healed = host.heal(healAmount);
        charges -= 1;
        host.log(
          healed > 0
            ? `You drink. Restored ${healed} HP (${charges} use(s) left).`
            : `You are already at full health (${charges} use(s) left).`,
        );
        return frame();
      }
      host.log(`Unknown option: ${optionId}`);
      return frame();
    },
  };
}
