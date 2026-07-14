import type { AbilityActivationHandler } from '../ga/ability-activation-registry.js';
import { settleTakeDamageOnEntity } from './settle-take-damage.js';

export function createTakeDamageHandler(): AbilityActivationHandler {
  return {
    onActivate({ host }) {
      const data = settleTakeDamageOnEntity({
        getAttribute: (attribute) => host.getAttribute(attribute),
        applyGameplayEffect: (effect, context) =>
          host.applyGameplayEffectTo(host.entityId, effect, context),
      });
      return { ok: true, data: { takeDamage: data } };
    },
  };
}
