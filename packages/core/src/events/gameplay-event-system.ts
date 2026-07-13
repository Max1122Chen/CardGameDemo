import type { TraceSink } from '../trace/trace.js';
import { GameplayTagError } from '../tags/errors.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import { DEFAULT_CHANNEL_TAG } from '../tags/native-tags.js';
import { GameplayEventError } from './errors.js';
import { createGameplayEventChannel, type GameplayEventChannel } from './gameplay-event-channel.js';
import type { GameplayEvent } from './gameplay-event.js';

export type GameplayEventSubscribeOptions = {
  channel: GameplayEventChannel;
  listenerId?: string;
  priority?: number;
  requiredAll?: readonly GameplayTag[];
  requiredAny?: readonly GameplayTag[];
  handler: (event: GameplayEvent) => void;
};

export type GameplayEventSystemOptions = {
  manager: GameplayTagManager;
  sink?: TraceSink;
  maxDispatchDepth?: number;
};

type ListenerRecord = {
  listenerId: string;
  channelIndex: number;
  priority: number;
  registrationIndex: number;
  requiredAll?: readonly GameplayTag[];
  requiredAny?: readonly GameplayTag[];
  handler: (event: GameplayEvent) => void;
};

let nextListenerSequence = 0;

export class GameplayEventSystem {
  readonly defaultChannel: GameplayEventChannel;

  private readonly manager: GameplayTagManager;
  private readonly sink?: TraceSink;
  private readonly maxDispatchDepth: number;
  private readonly listenersByChannel = new Map<number, ListenerRecord[]>();
  private readonly listenerIndex = new Map<string, ListenerRecord>();
  private dispatchDepth = 0;
  private nextRegistrationIndex = 0;

  constructor(options: GameplayEventSystemOptions) {
    this.manager = options.manager;
    this.sink = options.sink;
    this.maxDispatchDepth = options.maxDispatchDepth ?? 16;
    this.defaultChannel = this.channel(this.manager.resolve(DEFAULT_CHANNEL_TAG));
  }

  channel(tag: GameplayTag): GameplayEventChannel {
    if (!this.manager.isValidTag(tag)) {
      throw new GameplayTagError('GameplayTag does not belong to this GameplayTagManager');
    }

    return createGameplayEventChannel(tag);
  }

  dispatch(event: GameplayEvent): void;
  dispatch(channel: GameplayEventChannel, event: GameplayEvent): void;
  dispatch(channelOrEvent: GameplayEventChannel | GameplayEvent, maybeEvent?: GameplayEvent): void {
    if (maybeEvent === undefined) {
      this.dispatchOnChannel(this.defaultChannel, channelOrEvent as GameplayEvent);
      return;
    }

    this.dispatchOnChannel(channelOrEvent as GameplayEventChannel, maybeEvent);
  }

  subscribe(options: GameplayEventSubscribeOptions): string {
    const channelIndex = options.channel.tag.index;
    const listenerId = options.listenerId ?? `listener-${nextListenerSequence++}`;
    const registrationIndex = this.nextRegistrationIndex++;

    if (this.listenerIndex.has(listenerId)) {
      throw new GameplayEventError(`Listener id already registered: ${listenerId}`);
    }

    const record: ListenerRecord = {
      listenerId,
      channelIndex,
      priority: options.priority ?? 0,
      registrationIndex,
      requiredAll: options.requiredAll,
      requiredAny: options.requiredAny,
      handler: options.handler,
    };

    const listeners = this.listenersByChannel.get(channelIndex) ?? [];
    listeners.push(record);
    this.listenersByChannel.set(channelIndex, listeners);
    this.listenerIndex.set(listenerId, record);

    return listenerId;
  }

  unsubscribe(listenerId: string): boolean {
    const record = this.listenerIndex.get(listenerId);
    if (!record) {
      return false;
    }

    const listeners = this.listenersByChannel.get(record.channelIndex);
    if (listeners) {
      const index = listeners.findIndex((entry) => entry.listenerId === listenerId);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }

    this.listenerIndex.delete(listenerId);
    return true;
  }

  private dispatchOnChannel(channel: GameplayEventChannel, event: GameplayEvent): void {
    if (this.dispatchDepth >= this.maxDispatchDepth) {
      throw new GameplayEventError(
        `GameplayEvent dispatch depth exceeded maxDispatchDepth=${this.maxDispatchDepth}`,
      );
    }

    this.dispatchDepth += 1;

    try {
      const snapshot: GameplayEvent = {
        tags: event.tags.clone(),
        payload: event.payload,
      };

      const listeners = [...(this.listenersByChannel.get(channel.tag.index) ?? [])]
        .filter((listener) => this.matchesListener(snapshot, listener))
        .sort(compareListeners);

      for (const listener of listeners) {
        listener.handler(snapshot);
      }

      this.emitTrace(channel, snapshot);
    } finally {
      this.dispatchDepth -= 1;
    }
  }

  private matchesListener(event: GameplayEvent, listener: ListenerRecord): boolean {
    if (listener.requiredAll && !event.tags.hasAll(listener.requiredAll)) {
      return false;
    }

    if (listener.requiredAny && !event.tags.hasAny(listener.requiredAny)) {
      return false;
    }

    return true;
  }

  private emitTrace(channel: GameplayEventChannel, event: GameplayEvent): void {
    if (!this.sink) {
      return;
    }

    const tagNames = event.tags.toArray().map((entry) => entry.tag.name);
    const payloadKeys = event.payload ? Object.keys(event.payload) : undefined;

    this.sink.emit({
      kind: 'event.dispatch',
      channel: channel.name,
      tags: tagNames,
      ...(payloadKeys && payloadKeys.length > 0 ? { payloadKeys } : {}),
    });
  }
}

function compareListeners(left: ListenerRecord, right: ListenerRecord): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.registrationIndex - right.registrationIndex;
}
