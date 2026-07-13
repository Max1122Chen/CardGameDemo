import type { TraceSink } from '../trace/trace.js';
import type { GameplayTag } from './gameplay-tag.js';
import { GameplayTagError } from './errors.js';
import type { GameplayTagManager } from './gameplay-tag-manager.js';

export type GameplayTagContainerOptions = {
  manager: GameplayTagManager;
  entityId?: string;
  sink?: TraceSink;
};

type ContainerEntry = {
  tag: GameplayTag;
  count: number;
};

export class GameplayTagContainer {
  private readonly manager: GameplayTagManager;
  private readonly entityId?: string;
  private readonly sink?: TraceSink;
  private readonly entries = new Map<number, ContainerEntry>();

  constructor(options: GameplayTagContainerOptions) {
    this.manager = options.manager;
    this.entityId = options.entityId;
    this.sink = options.sink;
  }

  add(tag: GameplayTag, count = 1): void {
    this.assertValidTag(tag);
    if (!Number.isInteger(count) || count <= 0) {
      throw new GameplayTagError(`Tag add count must be a positive integer, got ${count}`);
    }

    const existing = this.entries.get(tag.index);
    const previousCount = existing?.count ?? 0;
    const nextCount = previousCount + count;

    this.entries.set(tag.index, { tag, count: nextCount });

    if (previousCount === 0) {
      this.emitTrace('tag.add', tag, nextCount);
    }
  }

  remove(tag: GameplayTag, count = 1): void {
    this.assertValidTag(tag);
    if (!Number.isInteger(count) || count <= 0) {
      throw new GameplayTagError(`Tag remove count must be a positive integer, got ${count}`);
    }

    const existing = this.entries.get(tag.index);
    if (!existing || existing.count === 0) {
      return;
    }

    const nextCount = existing.count - count;
    if (nextCount > 0) {
      this.entries.set(tag.index, { tag, count: nextCount });
      return;
    }

    this.entries.delete(tag.index);
    this.emitTrace('tag.remove', tag, 0);
  }

  getCount(tag: GameplayTag): number {
    this.assertValidTag(tag);
    return this.entries.get(tag.index)?.count ?? 0;
  }

  has(query: GameplayTag): boolean {
    this.assertValidTag(query);

    for (const entry of this.entries.values()) {
      if (entry.count > 0 && entry.tag.matches(query)) {
        return true;
      }
    }

    return false;
  }

  hasAll(queries: readonly GameplayTag[]): boolean {
    return queries.every((query) => this.has(query));
  }

  hasAny(queries: readonly GameplayTag[]): boolean {
    return queries.some((query) => this.has(query));
  }

  clear(): void {
    this.entries.clear();
  }

  toArray(): readonly { tag: GameplayTag; count: number }[] {
    return [...this.entries.values()].filter((entry) => entry.count > 0);
  }

  clone(): GameplayTagContainer {
    const cloned = new GameplayTagContainer({
      manager: this.manager,
      entityId: this.entityId,
    });

    for (const entry of this.toArray()) {
      cloned.restoreEntry(entry.tag, entry.count);
    }

    return cloned;
  }

  private restoreEntry(tag: GameplayTag, count: number): void {
    this.entries.set(tag.index, { tag, count });
  }

  private assertValidTag(tag: GameplayTag): void {
    if (!this.manager.isValidTag(tag)) {
      throw new GameplayTagError('GameplayTag does not belong to this container manager');
    }
  }

  private emitTrace(kind: 'tag.add' | 'tag.remove', tag: GameplayTag, count: number): void {
    if (!this.sink) {
      return;
    }

    this.sink.emit({
      kind,
      tag: tag.name,
      count,
      ...(this.entityId ? { entity: this.entityId } : {}),
    });
  }
}
