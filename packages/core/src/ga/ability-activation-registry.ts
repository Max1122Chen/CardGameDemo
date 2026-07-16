import type { GameplayEvent } from '../events/gameplay-event.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import type {
  AbilityActivationContext,
  AbilityParameterValue,
  ActivationFailureReason,
  GameplayAbilityDefinition,
  GameplayAbilityEventListen,
} from './types.js';
import type { GameplayAbilityHost } from './gameplay-ability-runtime.js';

export type AbilityHookServices = {
  /** Explicit listen (UE-like); returns listener id. */
  startListen(
    filter: GameplayAbilityEventListen,
    onEvent: (event: GameplayEvent) => void,
  ): string;
  stopListen(listenerId: string): void;
  checkCost(): boolean;
  applyCost(): void;
  /** checkCost + applyCost; returns false if unaffordable. */
  commitAbility(): boolean;
  /** Apply effectBindings filtered by `when` (omit = all). Skips bindings with missing optional params. */
  applyEffectBindings(when?: string): void;
  endAbility(): void;
  parameters: Readonly<Record<string, AbilityParameterValue>>;
};

export type AbilityHandlerContext = {
  host: GameplayAbilityHost;
  definition: GameplayAbilityDefinition;
  ctx: AbilityActivationContext;
  instanceId: string;
  services: AbilityHookServices;
};

export type AbilityHandlerResult = {
  ok: boolean;
  reason?: ActivationFailureReason;
  /** Opaque activation payload (e.g. `{ takeDamage: { blocked, healthLost } }`). */
  data?: Record<string, unknown>;
};

export type AbilityActivationHandler = {
  onActivate(args: AbilityHandlerContext): AbilityHandlerResult;
};

export class AbilityActivationRegistry {
  private readonly handlers = new Map<string, AbilityActivationHandler>();

  register(handlerId: string, handler: AbilityActivationHandler): void {
    if (!handlerId) {
      throw new Error('AbilityActivationRegistry.register: handlerId is required');
    }
    if (this.handlers.has(handlerId)) {
      throw new Error(`Duplicate ability handler registration: ${handlerId}`);
    }
    this.handlers.set(handlerId, handler);
  }

  /** Install or replace a handler (used when re-binding combat bridges on battle restart). */
  set(handlerId: string, handler: AbilityActivationHandler): void {
    if (!handlerId) {
      throw new Error('AbilityActivationRegistry.set: handlerId is required');
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

export type { GameplayEffectDefinition };
