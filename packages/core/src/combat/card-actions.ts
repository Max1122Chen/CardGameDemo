import type { RuleEngine } from '../engine/rule-engine.js';
import type { GameplayFrameworkComponent } from '../gfc/gameplay-framework-component.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import { applyDamage, type DamageResult } from './combat-damage.js';
import { getCardSpec } from './card-catalog.js';
import type { CardActionId } from './types.js';

export type CardActionContext = {
  actionId: CardActionId;
  player: GameplayFrameworkComponent;
  enemy: GameplayFrameworkComponent;
  engine: RuleEngine;
  onPlayerDealsDamage: (amount: number, result: DamageResult) => void;
  onPlayerGainsBlock: (amount: number) => void;
};

const DEFEND_EFFECT: GameplayEffectDefinition = {
  id: 'ge.card.defend',
  duration: { kind: 'Instant' },
  modifiers: [{ attribute: 'Block', op: 'Add', magnitude: 5 }],
};

export function activateCardAction(ctx: CardActionContext): void {
  const spec = getCardSpec(ctx.actionId);

  if (spec.damage !== undefined) {
    const result = applyDamage(ctx.enemy, spec.damage);
    ctx.onPlayerDealsDamage(spec.damage, result);
    return;
  }

  if (spec.block !== undefined) {
    ctx.player.applyGameplayEffect(DEFEND_EFFECT);
    ctx.onPlayerGainsBlock(spec.block);
  }
}
