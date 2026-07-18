import type { EntityId } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';

export function getEntityHealth(target: GameplayFrameworkComponent): number {
  return target.getAttribute('Health')?.currentValue ?? 0;
}

export function getEntityBlock(target: GameplayFrameworkComponent): number {
  return target.getAttribute('Block')?.currentValue ?? 0;
}

export function getEntityActionPoints(target: GameplayFrameworkComponent): number {
  return target.getAttribute('ActionPoints')?.currentValue ?? 0;
}

export function getEntityMaxHealth(target: GameplayFrameworkComponent): number {
  return target.getAttribute('MaxHealth')?.currentValue ?? getEntityHealth(target);
}

export function getEntityMaxActionPoints(target: GameplayFrameworkComponent): number {
  return target.getAttribute('MaxActionPoints')?.currentValue ?? getEntityActionPoints(target);
}

export type DamageTracePayload = {
  sourceId: EntityId;
  targetId: EntityId;
  amount: number;
  blocked: number;
  healthLost: number;
};
