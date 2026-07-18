import type { DialogueFrame, Interactable, InteractionHost } from './types.js';

const GIFT_ITEM = 'gold_coin';
const GIFT_QTY = 1;

/** Beggar NPC: greet / give a coin / leave; remembers a successful gift. */
export function createBeggar(id: string): Interactable {
  let gifted = false;
  let thanked = false;

  const frame = (host: InteractionHost): DialogueFrame => {
    if (thanked) {
      return {
        prompt: 'The beggar nods: "Kindness returns." He has little more to say.',
        options: [{ id: 'leave', label: 'Leave' }],
      };
    }
    if (gifted) {
      return {
        prompt: 'The beggar clutches the coin in his bowl and looks up at you.',
        options: [
          { id: 'listen', label: 'Hear him out' },
          { id: 'leave', label: 'Leave' },
        ],
      };
    }
    const canGive = host.hasItem(GIFT_ITEM, GIFT_QTY);
    const options = [
      { id: 'greet', label: 'Say hello' },
      ...(canGive
        ? [{ id: 'give', label: 'Give 1 gold coin' }]
        : [{ id: 'give_fail', label: 'Want to give… but no gold' }]),
      { id: 'leave', label: 'Leave' },
    ];
    return {
      prompt: 'A ragged beggar crouches in the corner. His bowl is empty.',
      options,
    };
  };

  return {
    id,
    kind: 'npc',
    displayName: 'Beggar',
    canInteract: () => true,
    begin(host) {
      return frame(host);
    },
    choose(optionId, host) {
      if (optionId === 'leave') {
        return null;
      }
      if (optionId === 'greet') {
        host.log('The beggar mumbles a reply, still staring at the bowl.');
        return frame(host);
      }
      if (optionId === 'give_fail') {
        host.log('You check your pockets — no gold to spare.');
        return frame(host);
      }
      if (optionId === 'give') {
        if (!host.tryTakeItem(GIFT_ITEM, GIFT_QTY)) {
          host.log('Gift failed: not enough gold.');
          return frame(host);
        }
        gifted = true;
        host.log('You drop 1 gold coin. The beggar thanks you.');
        return frame(host);
      }
      if (optionId === 'listen') {
        thanked = true;
        const healed = host.heal(3);
        host.log(
          healed > 0
            ? `He presses a warm scrap of food into your hand. You feel better (+${healed} HP).`
            : 'He presses a scrap of food into your hand, then shrinks back.',
        );
        return frame(host);
      }
      host.log(`Unknown option: ${optionId}`);
      return frame(host);
    },
  };
}
