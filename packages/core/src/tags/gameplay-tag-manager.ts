import { GameplayTagError } from './errors.js';
import { createGameplayTag, type GameplayTag } from './gameplay-tag.js';

const TAG_NAME_PATTERN = /^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$/;

export type TagDefinitionsInput = {
  native?: readonly string[];
  json?: readonly string[];
};

type TagNode = {
  name: string;
  parentName?: string;
};

export class GameplayTagManager {
  private readonly tagsByName = new Map<string, GameplayTag>();
  private readonly tagsByIndex: GameplayTag[] = [];
  private readonly parentByIndex: Array<GameplayTag | undefined> = [];

  private constructor(nodes: readonly TagNode[]) {
    for (const [index, node] of nodes.entries()) {
      const tag = createGameplayTag(this, index, node.name);
      this.tagsByName.set(node.name, tag);
      this.tagsByIndex.push(tag);
      this.parentByIndex.push(node.parentName ? this.tagsByName.get(node.parentName) : undefined);
    }
  }

  static fromDefinitions(input: TagDefinitionsInput = {}): GameplayTagManager {
    const names = new Set<string>();

    for (const source of [input.native ?? [], input.json ?? []]) {
      for (const name of source) {
        validateTagName(name);
        names.add(name);
        addImplicitParents(name, names);
      }
    }

    const sortedNames = [...names].sort((left, right) => left.localeCompare(right));
    const nodes = sortedNames.map((name) => ({
      name,
      parentName: getParentName(name),
    }));

    return new GameplayTagManager(nodes);
  }

  resolve(name: string): GameplayTag {
    validateTagName(name);
    const tag = this.tagsByName.get(name);
    if (!tag) {
      throw new GameplayTagError(`Unknown GameplayTag: ${name}`);
    }

    return tag;
  }

  tryResolve(name: string): GameplayTag | undefined {
    if (!TAG_NAME_PATTERN.test(name)) {
      return undefined;
    }

    return this.tagsByName.get(name);
  }

  getParent(tag: GameplayTag): GameplayTag | undefined {
    this.assertValidTag(tag);
    return this.parentByIndex[tag.index];
  }

  isValidTag(tag: GameplayTag): boolean {
    return this.tagsByIndex[tag.index]?.index === tag.index && this.tagsByIndex[tag.index]?.name === tag.name;
  }

  private assertValidTag(tag: GameplayTag): void {
    if (!this.isValidTag(tag)) {
      throw new GameplayTagError('GameplayTag does not belong to this GameplayTagManager');
    }
  }

  listTags(): readonly GameplayTag[] {
    return this.tagsByIndex;
  }
}

function validateTagName(name: string): void {
  if (name.length === 0) {
    throw new GameplayTagError('GameplayTag name cannot be empty');
  }

  if (!TAG_NAME_PATTERN.test(name)) {
    throw new GameplayTagError(`Invalid GameplayTag name: ${name}`);
  }
}

function getParentName(name: string): string | undefined {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) {
    return undefined;
  }

  return name.slice(0, lastDot);
}

function addImplicitParents(name: string, names: Set<string>): void {
  const parentName = getParentName(name);
  if (!parentName) {
    return;
  }

  names.add(parentName);
  addImplicitParents(parentName, names);
}
