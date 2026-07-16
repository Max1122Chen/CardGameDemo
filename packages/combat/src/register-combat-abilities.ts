import type { AbilityActivationRegistry } from '@cardgame/core';
import {
  createCardPlayBlockHandler,
  createCardPlayDamageHandler,
  createCardPlayHealHandler,
  createCardPlayStatusHandler,
  CARD_PLAY_BLOCK_HANDLER_ID,
  CARD_PLAY_DAMAGE_HANDLER_ID,
  CARD_PLAY_HEAL_HANDLER_ID,
  CARD_PLAY_STATUS_HANDLER_ID,
  TAKE_DAMAGE_HANDLER_ID,
  type CardPlayCommitBridge,
} from './card-play-handlers.js';
import { createTakeDamageHandler } from './take-damage-handler.js';

export type CombatAbilityRegistration = {
  setBridge: (bridge: CardPlayCommitBridge) => void;
};

/** Shared across duplicate module loads (src vs dist); keyed on the registry instance. */
const COMBAT_ABILITY_REG_KEY = Symbol.for('@cardgame/combat.abilityRegistration');

type RegistryHost = AbilityActivationRegistry & {
  [COMBAT_ABILITY_REG_KEY]?: CombatAbilityRegistration;
};

/** Register combat GA hooks (idempotent per registry; bridge is replaced on each bootstrap). */
export function registerCombatAbilityHandlers(
  registry: AbilityActivationRegistry,
): CombatAbilityRegistration {
  const host = registry as RegistryHost;
  const existing = host[COMBAT_ABILITY_REG_KEY];
  if (existing) {
    return existing;
  }

  let bridge: CardPlayCommitBridge | undefined;
  const getBridge = (): CardPlayCommitBridge => {
    if (!bridge) {
      throw new Error('CardPlay bridge not attached yet');
    }
    return bridge;
  };

  // Use set() so a second module copy (or stale first install) rebinds to this bridge.
  registry.set(TAKE_DAMAGE_HANDLER_ID, createTakeDamageHandler());
  registry.set(CARD_PLAY_DAMAGE_HANDLER_ID, createCardPlayDamageHandler(getBridge));
  registry.set(CARD_PLAY_BLOCK_HANDLER_ID, createCardPlayBlockHandler(getBridge));
  registry.set(CARD_PLAY_STATUS_HANDLER_ID, createCardPlayStatusHandler(getBridge));
  registry.set(CARD_PLAY_HEAL_HANDLER_ID, createCardPlayHealHandler(getBridge));

  const registration: CombatAbilityRegistration = {
    setBridge: (next) => {
      bridge = next;
    },
  };
  host[COMBAT_ABILITY_REG_KEY] = registration;
  return registration;
}

export {
  CARD_PLAY_BLOCK_HANDLER_ID,
  CARD_PLAY_DAMAGE_HANDLER_ID,
  CARD_PLAY_HEAL_HANDLER_ID,
  CARD_PLAY_STATUS_HANDLER_ID,
  TAKE_DAMAGE_HANDLER_ID,
  type CardPlayCommitBridge,
};
