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

/** Register combat GA hooks (call once before CombatSession setup). */
export function registerCombatAbilityHandlers(
  registry: AbilityActivationRegistry,
): CombatAbilityRegistration {
  let bridge: CardPlayCommitBridge | undefined;
  const getBridge = (): CardPlayCommitBridge => {
    if (!bridge) {
      throw new Error('CardPlay bridge not attached yet');
    }
    return bridge;
  };

  registry.register(TAKE_DAMAGE_HANDLER_ID, createTakeDamageHandler());
  registry.register(CARD_PLAY_DAMAGE_HANDLER_ID, createCardPlayDamageHandler(getBridge));
  registry.register(CARD_PLAY_BLOCK_HANDLER_ID, createCardPlayBlockHandler(getBridge));
  registry.register(CARD_PLAY_STATUS_HANDLER_ID, createCardPlayStatusHandler(getBridge));
  registry.register(CARD_PLAY_HEAL_HANDLER_ID, createCardPlayHealHandler(getBridge));

  return {
    setBridge: (next) => {
      bridge = next;
    },
  };
}

export {
  CARD_PLAY_BLOCK_HANDLER_ID,
  CARD_PLAY_DAMAGE_HANDLER_ID,
  CARD_PLAY_HEAL_HANDLER_ID,
  CARD_PLAY_STATUS_HANDLER_ID,
  TAKE_DAMAGE_HANDLER_ID,
  type CardPlayCommitBridge,
};
