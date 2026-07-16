/** SetByCaller keys used by combat GE templates. */
export const SetByCallerKeys = {
  Damage: 'Data.Damage',
  AttributeBonus: 'Data.AttributeBonus',
  Heal: 'Data.Heal',
  BlockToGain: 'Data.BlockToGain',
  Amount: 'Data.Amount',
} as const;

export const TAKE_DAMAGE_HANDLER_ID = 'combat.takeDamage';
export const TAKE_DAMAGE_ABILITY_ID = 'ga.archetype.takeDamage';
export const CARD_PLAY_DAMAGE_ABILITY_ID = 'ga.archetype.cardPlayDamage';
export const CARD_PLAY_BLOCK_ABILITY_ID = 'ga.archetype.cardPlayBlock';
export const CARD_PLAY_STATUS_ABILITY_ID = 'ga.archetype.cardPlayStatus';
export const CARD_PLAY_HEAL_ABILITY_ID = 'ga.archetype.cardPlayHeal';
