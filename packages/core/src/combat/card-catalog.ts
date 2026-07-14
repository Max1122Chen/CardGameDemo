import type { CardActionId } from './types.js';

export type CardActionSpec = {
  id: CardActionId;
  name: string;
  cost: number;
};

/** Display metadata; full behavior lives in `createCardDefinitions`. */
export const CARD_CATALOG: Record<CardActionId, CardActionSpec> = {
  strike: { id: 'strike', name: 'Strike', cost: 1 },
  defend: { id: 'defend', name: 'Defend', cost: 1 },
  bash: { id: 'bash', name: 'Bash', cost: 2 },
  weaken: { id: 'weaken', name: 'Weaken', cost: 1 },
  flex: { id: 'flex', name: 'Flex', cost: 1 },
  wait: { id: 'wait', name: 'Wait', cost: 1 },
};

/** Expanded starter for CLI / probe testing (COMBAT-F03). */
export const STARTER_DECK: readonly CardActionId[] = [
  'strike',
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'bash',
  'weaken',
  'weaken',
  'flex',
  'wait',
];

export function getCardSpec(actionId: CardActionId): CardActionSpec {
  return CARD_CATALOG[actionId];
}
