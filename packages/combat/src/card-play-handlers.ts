import type { AbilityActivationHandler } from '@cardgame/core';
import type { GameplayEvent } from '@cardgame/core';
import { CombatAttributes } from './combat-attributes.js';
import { gainBlockFromPreviewEffect } from './card-abilities.js';

export const CARD_PLAY_DAMAGE_HANDLER_ID = 'combat.cardPlayDamage';
export const CARD_PLAY_BLOCK_HANDLER_ID = 'combat.cardPlayBlock';
export const CARD_PLAY_STATUS_HANDLER_ID = 'combat.cardPlayStatus';
export const CARD_PLAY_HEAL_HANDLER_ID = 'combat.cardPlayHeal';

export const CARD_PLAY_LISTEN = {
  channelTag: 'Combat',
  eventTags: [
    'GameplayEvent.Combat.TryPlayCard',
    'GameplayEvent.Combat.CancelPlayCard',
  ],
  match: 'any' as const,
};

export type CardPlayCommitBridge = {
  /** True if this ability instance is the current preview. */
  matchesPreview(args: {
    abilityInstanceId: string;
    cardInstanceId: string | undefined;
  }): boolean;
  cancelPreview(): void;
  /** After hook settled cost + effects; Session discards, logs, checks win. */
  completePlay(args: {
    abilityInstanceId: string;
    actionId: string;
    cardInstanceId: string;
    cost: number;
    logMessage: string;
  }): void;
  /** Settle TakeDamage on target; returns blocked/healthLost for logging. */
  settleTakeDamage(targetEntityId: string): { blocked: number; healthLost: number };
  resetMeta(): void;
};

function readPayloadCardId(event: GameplayEvent): string | undefined {
  const payload = event.payload ?? {};
  return typeof payload.cardInstanceId === 'string' ? payload.cardInstanceId : undefined;
}

function readPayloadActionId(event: GameplayEvent): string | undefined {
  const payload = event.payload ?? {};
  return typeof payload.actionId === 'string' ? payload.actionId : undefined;
}

function eventHasTag(
  event: GameplayEvent,
  tagManager: { resolve: (name: string) => import('@cardgame/core').GameplayTag },
  tagName: string,
): boolean {
  return event.tags.has(tagManager.resolve(tagName));
}

function createCardPlayListenHandler(
  bridge: () => CardPlayCommitBridge,
  settle: 'takeDamage' | 'block' | 'none',
): AbilityActivationHandler {
  return {
    onActivate({ host, ctx, instanceId, services, definition }) {
      services.applyEffectBindings('preview');

      services.startListen(CARD_PLAY_LISTEN, (event) => {
        const cardInstanceId = readPayloadCardId(event);
        if (
          !bridge().matchesPreview({
            abilityInstanceId: instanceId,
            cardInstanceId,
          })
        ) {
          return;
        }

        if (eventHasTag(event, host.tagManager, 'GameplayEvent.Combat.CancelPlayCard')) {
          bridge().cancelPreview();
          return;
        }

        if (!eventHasTag(event, host.tagManager, 'GameplayEvent.Combat.TryPlayCard')) {
          return;
        }

        if (!services.commitAbility()) {
          return;
        }

        services.applyEffectBindings('commit');

        const actionId =
          readPayloadActionId(event) ??
          (typeof ctx.payload?.actionId === 'string' ? ctx.payload.actionId : definition.id);
        const cost =
          typeof services.parameters.ApCost === 'number'
            ? services.parameters.ApCost
            : typeof ctx.payload?.cost === 'number'
              ? ctx.payload.cost
              : 0;

        let logMessage = `${definition.name ?? actionId} played.`;

        if (settle === 'takeDamage') {
          const targetId = ctx.targetEntityId;
          if (!targetId) {
            return;
          }
          const result = bridge().settleTakeDamage(targetId);
          logMessage = `${definition.name ?? actionId} dealt ${result.healthLost} damage (${result.blocked} blocked).`;
        } else if (settle === 'block') {
          const gain = host.getAttribute(CombatAttributes.BlockToGain)?.currentValue ?? 0;
          host.applyGameplayEffectTo(host.entityId, gainBlockFromPreviewEffect(), {
            instigatorEntityId: ctx.instigatorEntityId,
            sourceEntityId: ctx.sourceEntityId ?? host.entityId,
          });
          logMessage = `${definition.name ?? actionId} gained ${gain} block.`;
        }

        const resolvedCardId =
          cardInstanceId ??
          (typeof ctx.payload?.cardInstanceId === 'string' ? ctx.payload.cardInstanceId : '');

        services.endAbility();
        bridge().completePlay({
          abilityInstanceId: instanceId,
          actionId,
          cardInstanceId: resolvedCardId,
          cost,
          logMessage,
        });
      });

      return { ok: true };
    },
  };
}

export function createCardPlayDamageHandler(
  getBridge: () => CardPlayCommitBridge,
): AbilityActivationHandler {
  return createCardPlayListenHandler(getBridge, 'takeDamage');
}

export function createCardPlayBlockHandler(
  getBridge: () => CardPlayCommitBridge,
): AbilityActivationHandler {
  return createCardPlayListenHandler(getBridge, 'block');
}

export function createCardPlayStatusHandler(
  getBridge: () => CardPlayCommitBridge,
): AbilityActivationHandler {
  return createCardPlayListenHandler(getBridge, 'none');
}

export function createCardPlayHealHandler(
  getBridge: () => CardPlayCommitBridge,
): AbilityActivationHandler {
  return {
    onActivate({ host, ctx, instanceId, services, definition }) {
      services.startListen(CARD_PLAY_LISTEN, (event) => {
        const cardInstanceId = readPayloadCardId(event);
        if (
          !getBridge().matchesPreview({
            abilityInstanceId: instanceId,
            cardInstanceId,
          })
        ) {
          return;
        }

        if (eventHasTag(event, host.tagManager, 'GameplayEvent.Combat.CancelPlayCard')) {
          getBridge().cancelPreview();
          return;
        }

        if (!eventHasTag(event, host.tagManager, 'GameplayEvent.Combat.TryPlayCard')) {
          return;
        }

        if (!services.commitAbility()) {
          return;
        }

        services.applyEffectBindings('commit');

        const actionId =
          readPayloadActionId(event) ??
          (typeof ctx.payload?.actionId === 'string' ? ctx.payload.actionId : definition.id);
        const cost =
          typeof services.parameters.ApCost === 'number'
            ? services.parameters.ApCost
            : typeof ctx.payload?.cost === 'number'
              ? ctx.payload.cost
              : 0;
        const healAmount =
          typeof services.parameters.Heal === 'number' ? services.parameters.Heal : 0;
        const logMessage = `${definition.name ?? actionId} healed ${healAmount} HP.`;

        const resolvedCardId =
          cardInstanceId ??
          (typeof ctx.payload?.cardInstanceId === 'string' ? ctx.payload.cardInstanceId : '');

        services.endAbility();
        getBridge().completePlay({
          abilityInstanceId: instanceId,
          actionId,
          cardInstanceId: resolvedCardId,
          cost,
          logMessage,
        });
      });

      return { ok: true };
    },
  };
}
