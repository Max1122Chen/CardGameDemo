import type { GameplayTag } from '@cardgame/core';

import type { ItemFragment } from './fragments.js';

export type ItemId = string;

export type ItemDefinition = {
  id: ItemId;
  name: string;
  tags: readonly GameplayTag[];
  maxStack: number;
  sellValue: number;
  fragments: readonly ItemFragment[];
};
