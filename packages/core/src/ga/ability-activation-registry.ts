import type { GameplayEvent } from '../events/gameplay-event.js';
import type { AbilityActivationContext, ActivationFailureReason, GameplayAbilityDefinition } from './types.js';
import type { GameplayAbilityHost } from './gameplay-ability-runtime.js';

export type AbilityHandlerContext = {
  host: GameplayAbilityHost;
  definition: GameplayAbilityDefinition;
  ctx: AbilityActivationContext;
  instanceId: string;
};

export type AbilityHandlerResult = {
  ok: boolean;
  reason?: ActivationFailureReason;
  /** Opaque activation payload (e.g. `{ takeDamage: { blocked, healthLost } }`). */
  data?: Record<string, unknown>;
};

export type AbilityActivationHandler = {
  onActivate(args: AbilityHandlerContext): AbilityHandlerResult;
  onActiveEvent?(args: AbilityHandlerContext & { event: GameplayEvent }): void;
};

export class AbilityActivationRegistry {
  private readonly handlers = new Map<string, AbilityActivationHandler>();

  register(handlerId: string, handler: AbilityActivationHandler): void {
    if (!handlerId) {
      throw new Error('AbilityActivationRegistry.register: handlerId is required');
    }
    this.handlers.set(handlerId, handler);
  }

  get(handlerId: string): AbilityActivationHandler | undefined {
    return this.handlers.get(handlerId);
  }

  has(handlerId: string): boolean {
    return this.handlers.has(handlerId);
  }
}
