/** SetByCaller / CommitMode keys used by combat CardPlay (numbers only). */
export const SetByCallerKeys = {
  Damage: 'Data.Damage',
  BlockToGain: 'Data.BlockToGain',
  /** 0 = none, 1 = settleTakeDamage, 2 = applyBlock */
  CommitMode: 'Data.CommitMode',
} as const;

export const CommitMode = {
  None: 0,
  SettleTakeDamage: 1,
  ApplyBlock: 2,
} as const;

export const CARD_PLAY_HANDLER_ID = 'combat.cardPlay';
export const TAKE_DAMAGE_HANDLER_ID = 'combat.takeDamage';
export const CARD_PLAY_ABILITY_ID = 'ga.card.play';
