import type { DialogueFrame, Interactable, InteractionHost } from './types.js';

const COST_HP = 5;
const REWARD_ITEM = 'gold_coin';
const REWARD_QTY = 2;

/** Blood altar: spend HP for gold, once per visit cycle (repeatable). */
export function createBloodAltar(id: string): Interactable {
  const frame = (host: InteractionHost): DialogueFrame => {
    const canPay = host.getHealth() > COST_HP;
    return {
      prompt:
        'A blood altar hums with a low pulse. Dark stains ring the basin.',
      options: [
        ...(canPay
          ? [{ id: 'sacrifice', label: `Sacrifice ${COST_HP} HP for ${REWARD_QTY} gold` }]
          : [{ id: 'sacrifice_fail', label: `Too weak to sacrifice (${COST_HP} HP)` }]),
        { id: 'leave', label: 'Leave' },
      ],
    };
  };

  return {
    id,
    kind: 'facility',
    displayName: 'Blood Altar',
    canInteract: () => true,
    begin(host) {
      return frame(host);
    },
    choose(optionId, host) {
      if (optionId === 'leave') {
        return null;
      }
      if (optionId === 'sacrifice_fail') {
        host.log('You lack the strength to feed the altar.');
        return frame(host);
      }
      if (optionId === 'sacrifice') {
        if (host.getHealth() <= COST_HP) {
          host.log('Sacrifice failed: not enough HP.');
          return frame(host);
        }
        const lost = host.damage(COST_HP);
        const given = host.tryGiveItem(REWARD_ITEM, REWARD_QTY);
        host.log(
          given
            ? `You bleed ${lost} HP. ${REWARD_QTY} gold coins clatter into your pack.`
            : `You bleed ${lost} HP, but your pack cannot hold the gold.`,
        );
        return frame(host);
      }
      host.log(`Unknown option: ${optionId}`);
      return frame(host);
    },
  };
}
