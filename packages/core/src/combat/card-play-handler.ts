import type { AbilityActivationHandler, AbilityHandlerContext } from '../ga/ability-activation-registry.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import { CommitMode, SetByCallerKeys } from './set-by-caller-keys.js';

export type CardPlayBridge = {
  handleCardPlayEvent(args: AbilityHandlerContext & { event: import('../events/gameplay-event.js').GameplayEvent }): void;
};

export type CardPlayServices = {
  getBridge: () => CardPlayBridge;
  getEffect: (id: string) => GameplayEffectDefinition;
};

export function createCardPlayHandler(services: CardPlayServices): AbilityActivationHandler {
  return {
    onActivate({ host, ctx }) {
      const setByCaller = ctx.setByCaller ?? {};
      const geContext = {
        instigatorEntityId: ctx.instigatorEntityId,
        sourceEntityId: ctx.sourceEntityId ?? host.entityId,
        targetEntityId: ctx.targetEntityId,
        payload: ctx.payload,
        setByCaller,
      };

      const damage = setByCaller[SetByCallerKeys.Damage];
      if (damage !== undefined) {
        host.applyGameplayEffectTo(host.entityId, services.getEffect('ge.template.damage-face'), geContext);
        const targetId = ctx.targetEntityId;
        if (!targetId) {
          return { ok: false, reason: 'missing_target' };
        }
        host.applyGameplayEffectTo(
          targetId,
          services.getEffect('ge.template.feed-damage-to-take'),
          geContext,
        );
      }

      const blockToGain = setByCaller[SetByCallerKeys.BlockToGain];
      if (blockToGain !== undefined) {
        host.applyGameplayEffectTo(host.entityId, services.getEffect('ge.template.block-to-gain'), geContext);
      }

      return { ok: true };
    },
    onActiveEvent(args) {
      services.getBridge().handleCardPlayEvent(args);
    },
  };
}

export function readCommitMode(setByCaller: Readonly<Record<string, number>> | undefined): number {
  return setByCaller?.[SetByCallerKeys.CommitMode] ?? CommitMode.None;
}
