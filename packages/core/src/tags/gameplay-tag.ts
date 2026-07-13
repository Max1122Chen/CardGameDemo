import type { GameplayTagManager } from './gameplay-tag-manager.js';

export type GameplayTag = {
  readonly index: number;
  readonly name: string;
  matches(query: GameplayTag): boolean;
  isChildOf(ancestor: GameplayTag): boolean;
};

type GameplayTagInternal = GameplayTag & {
  readonly manager: GameplayTagManager;
};

export function createGameplayTag(
  manager: GameplayTagManager,
  index: number,
  name: string,
): GameplayTag {
  const tag: GameplayTagInternal = {
    index,
    name,
    manager,
    matches(query: GameplayTag): boolean {
      return tag.isChildOf(query) || tag.index === query.index;
    },
    isChildOf(ancestor: GameplayTag): boolean {
      if (tag.index === ancestor.index) {
        return false;
      }

      let current: GameplayTag | undefined = manager.getParent(tag);
      while (current) {
        if (current.index === ancestor.index) {
          return true;
        }
        current = manager.getParent(current);
      }

      return false;
    },
  };

  return tag;
}
