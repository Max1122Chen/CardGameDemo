import type { EntityId } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';

export type DamageResult = {
  blocked: number;
  healthLost: number;
  remainingHealth: number;
  remainingBlock: number;
};

export function applyDamage(target: GameplayFrameworkComponent, amount: number): DamageResult {
  const health = target.getAttribute('Health');
  const block = target.getAttribute('Block');

  const currentHealth = health?.currentValue ?? 0;
  const currentBlock = block?.currentValue ?? 0;

  if (currentBlock >= amount) {
    const remainingBlock = currentBlock - amount;
    target.setAttributeBase('Block', remainingBlock);
    return {
      blocked: amount,
      healthLost: 0,
      remainingHealth: currentHealth,
      remainingBlock,
    };
  }

  const blocked = currentBlock;
  const healthLost = amount - blocked;
  const remainingHealth = Math.max(0, currentHealth - healthLost);
  target.setAttributeBase('Block', 0);
  target.setAttributeBase('Health', remainingHealth);

  return {
    blocked,
    healthLost,
    remainingHealth,
    remainingBlock: 0,
  };
}

export function getEntityHealth(target: GameplayFrameworkComponent): number {
  return target.getAttribute('Health')?.currentValue ?? 0;
}

export function getEntityBlock(target: GameplayFrameworkComponent): number {
  return target.getAttribute('Block')?.currentValue ?? 0;
}

export function getEntityActionPoints(target: GameplayFrameworkComponent): number {
  return target.getAttribute('ActionPoints')?.currentValue ?? 0;
}

export type DamageTracePayload = {
  sourceId: EntityId;
  targetId: EntityId;
  amount: number;
  blocked: number;
  healthLost: number;
};
