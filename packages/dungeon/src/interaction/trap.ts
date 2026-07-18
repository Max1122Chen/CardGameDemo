import { formatD20Check, rollD20Check } from './d20.js';
import type { DialogueFrame, Interactable } from './types.js';

const DEFAULT_DC = 12;
const FAIL_DAMAGE = 6;
const FORCE_DAMAGE = 4;

/** One-shot floor trap: careful dex check, force through, or leave. */
export function createSpikeTrap(
  id: string,
  options: { dc?: number; failDamage?: number; forceDamage?: number } = {},
): Interactable {
  let sprung = false;
  const dc = options.dc ?? DEFAULT_DC;
  const failDamage = options.failDamage ?? FAIL_DAMAGE;
  const forceDamage = options.forceDamage ?? FORCE_DAMAGE;

  const frame = (): DialogueFrame => {
    if (sprung) {
      return {
        prompt: 'The spike trap has already fired. Only broken mechanisms remain.',
        options: [{ id: 'leave', label: 'Leave' }],
      };
    }
    return {
      prompt: 'You spot a pressure plate. Spikes wait beneath the floorboards.',
      options: [
        { id: 'careful', label: `Cross carefully (Dexterity DC ${dc})` },
        { id: 'force', label: `Force through (take ${forceDamage} damage)` },
        { id: 'leave', label: 'Leave' },
      ],
    };
  };

  return {
    id,
    kind: 'script',
    displayName: 'Spike Trap',
    canInteract: () => true,
    begin() {
      return frame();
    },
    choose(optionId, host) {
      if (optionId === 'leave') {
        return null;
      }
      if (sprung) {
        return frame();
      }
      if (optionId === 'force') {
        const lost = host.damage(forceDamage);
        sprung = true;
        host.log(`You stomp through. Spikes catch you for ${lost} damage.`);
        return frame();
      }
      if (optionId === 'careful') {
        const check = rollD20Check({
          rng: () => host.nextRandom(),
          dc,
          modifier: host.getCheckModifier('dexterity'),
          mode: 'normal',
        });
        host.log(formatD20Check(check));
        if (check.success) {
          sprung = true;
          host.log('You slip past the plate. The trap clicks harmlessly.');
        } else {
          const lost = host.damage(failDamage);
          sprung = true;
          host.log(`The plate gives way. Spikes deal ${lost} damage.`);
        }
        return frame();
      }
      host.log(`Unknown option: ${optionId}`);
      return frame();
    },
  };
}
