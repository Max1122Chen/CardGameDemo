import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEventSystem, GameplayEventSubscribeOptions } from '../events/gameplay-event-system.js';
import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import { GameplayNotImplementedError } from './errors.js';
import type { AttributeChangeCallback, GfcSnapshot } from './types.js';

export type GameplayFrameworkComponentOptions = {
  entityId: EntityId;
  tagManager: GameplayTagManager;
  eventSystem: GameplayEventSystem;
};

let nextAbilityHandle = 0;

export class GameplayFrameworkComponent {
  readonly entityId: EntityId;

  private readonly tagManager: GameplayTagManager;
  private readonly eventSystem: GameplayEventSystem;
  private readonly tags: GameplayTagContainer;
  private readonly listenerIds: string[] = [];
  private readonly grantedAbilityHandles = new Set<string>();
  private readonly attributeSets = new Map<string, unknown>();
  private readonly preAttributeChangeCallbacks: AttributeChangeCallback[] = [];
  private readonly postAttributeChangeCallbacks: AttributeChangeCallback[] = [];
  private disposed = false;

  constructor(options: GameplayFrameworkComponentOptions) {
    this.entityId = options.entityId;
    this.tagManager = options.tagManager;
    this.eventSystem = options.eventSystem;
    this.tags = new GameplayTagContainer({
      manager: options.tagManager,
      entityId: options.entityId,
    });
  }

  addTag(tag: GameplayTag, count = 1): void {
    this.assertActive();
    this.tags.add(tag, count);
  }

  removeTag(tag: GameplayTag, count = 1): void {
    this.assertActive();
    this.tags.remove(tag, count);
  }

  hasTag(query: GameplayTag): boolean {
    this.assertActive();
    return this.tags.has(query);
  }

  getTagContainer(): GameplayTagContainer {
    this.assertActive();
    return this.tags;
  }

  dispatch(channel: GameplayEventChannel, event: GameplayEvent): void;
  dispatch(event: GameplayEvent): void;
  dispatch(channelOrEvent: GameplayEventChannel | GameplayEvent, maybeEvent?: GameplayEvent): void {
    this.assertActive();

    if (maybeEvent === undefined) {
      this.eventSystem.dispatch(channelOrEvent as GameplayEvent);
      return;
    }

    this.eventSystem.dispatch(channelOrEvent as GameplayEventChannel, maybeEvent);
  }

  subscribe(
    options: Omit<GameplayEventSubscribeOptions, 'channel'> & { channel?: GameplayEventChannel },
  ): string {
    this.assertActive();

    const channel = options.channel ?? this.eventSystem.defaultChannel;
    const listenerId = this.eventSystem.subscribe({
      ...options,
      channel,
    });
    this.listenerIds.push(listenerId);
    return listenerId;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const listenerId of this.listenerIds) {
      this.eventSystem.unsubscribe(listenerId);
    }

    this.listenerIds.length = 0;
    this.disposed = true;
  }

  registerAttributeSet(id: string, set: unknown): void {
    this.assertActive();
    this.attributeSets.set(id, set);
  }

  getAttribute(_setId: string, _attrId: string): number {
    this.assertActive();
    throw new GameplayNotImplementedError('GameplayFrameworkComponent.getAttribute');
  }

  applyGameplayEffect(_effect: unknown, _context?: unknown): void {
    this.assertActive();
    throw new GameplayNotImplementedError('GameplayFrameworkComponent.applyGameplayEffect');
  }

  grantAbility(_spec: unknown): string {
    this.assertActive();
    const handle = `ability-${nextAbilityHandle++}`;
    this.grantedAbilityHandles.add(handle);
    return handle;
  }

  revokeAbility(handle: string): void {
    this.assertActive();
    this.grantedAbilityHandles.delete(handle);
  }

  onPreAttributeChange(callback: AttributeChangeCallback): () => void {
    this.assertActive();
    this.preAttributeChangeCallbacks.push(callback);
    return () => {
      const index = this.preAttributeChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.preAttributeChangeCallbacks.splice(index, 1);
      }
    };
  }

  onPostAttributeChange(callback: AttributeChangeCallback): () => void {
    this.assertActive();
    this.postAttributeChangeCallbacks.push(callback);
    return () => {
      const index = this.postAttributeChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.postAttributeChangeCallbacks.splice(index, 1);
      }
    };
  }

  toJSON(): GfcSnapshot {
    this.assertActive();
    return {
      entityId: this.entityId,
      tags: this.tags.toArray().map((entry) => ({
        name: entry.tag.name,
        count: entry.count,
      })),
    };
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error(`GameplayFrameworkComponent disposed: ${this.entityId}`);
    }
  }
}
