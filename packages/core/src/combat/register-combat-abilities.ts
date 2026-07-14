import type { AbilityActivationRegistry } from '../ga/ability-activation-registry.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import { createCardPlayHandler, type CardPlayBridge } from './card-play-handler.js';
import { createCombatEffectTemplates } from './combat-effect-templates.js';
import { createTakeDamageHandler } from './take-damage-handler.js';
import { CARD_PLAY_HANDLER_ID, TAKE_DAMAGE_HANDLER_ID } from './set-by-caller-keys.js';

export type CombatAbilityRegistration = {
  getEffect: (id: string) => GameplayEffectDefinition;
  setBridge: (bridge: CardPlayBridge) => void;
};

/** Register combat GA handlers on the engine registry (call once before CombatSession setup). */
export function registerCombatAbilityHandlers(
  registry: AbilityActivationRegistry,
  effectOverrides: Record<string, GameplayEffectDefinition> = {},
): CombatAbilityRegistration {
  const templates = { ...createCombatEffectTemplates(), ...effectOverrides };
  let bridge: CardPlayBridge | undefined;

  const getEffect = (id: string): GameplayEffectDefinition => {
    const effect = templates[id];
    if (!effect) {
      throw new Error(`Unknown combat effect template: ${id}`);
    }
    return effect;
  };

  registry.register(TAKE_DAMAGE_HANDLER_ID, createTakeDamageHandler());
  registry.register(
    CARD_PLAY_HANDLER_ID,
    createCardPlayHandler({
      getBridge: () => {
        if (!bridge) {
          throw new Error('CardPlay bridge not attached yet');
        }
        return bridge;
      },
      getEffect,
    }),
  );

  return {
    getEffect,
    setBridge: (next) => {
      bridge = next;
    },
  };
}
