import type { GameplayEffectDefinition } from '../gfc/types.js';
import { CombatAttributes } from './combat-attributes.js';
import { SetByCallerKeys } from './set-by-caller-keys.js';

/** Built-in combat GE templates (also mirrored under data/effects for assets). */
export function createCombatEffectTemplates(): Record<string, GameplayEffectDefinition> {
  return {
    'ge.template.damage-face': {
      id: 'ge.template.damage-face',
      duration: { kind: 'Instant' },
      modifiers: [
        {
          attribute: CombatAttributes.Damage,
          op: 'Override',
          magnitude: { kind: 'SetByCaller', key: SetByCallerKeys.Damage },
        },
      ],
    },
    'ge.template.feed-damage-to-take': {
      id: 'ge.template.feed-damage-to-take',
      duration: { kind: 'Instant' },
      modifiers: [
        {
          attribute: CombatAttributes.DamageToTake,
          op: 'Override',
          magnitude: {
            kind: 'AttributeBased',
            captureFrom: 'Source',
            attribute: CombatAttributes.Damage,
            valueKind: 'Current',
          },
        },
      ],
    },
    'ge.template.block-to-gain': {
      id: 'ge.template.block-to-gain',
      duration: { kind: 'Instant' },
      modifiers: [
        {
          attribute: CombatAttributes.BlockToGain,
          op: 'Override',
          magnitude: { kind: 'SetByCaller', key: SetByCallerKeys.BlockToGain },
        },
      ],
    },
  };
}
