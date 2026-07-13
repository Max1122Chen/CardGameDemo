# CORE-F03 — GameplayEvent System

## Meta

- **ID:** CORE-F03
- **Status:** Done
- **Owner:** 麦克斯大大
- **Last updated:** 2026-07-13
- **Related:** [gameplay-framework.md](../../design/systems/gameplay-framework.md), [CORE-F02-gameplay-tag.md](./CORE-F02-gameplay-tag.md), [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md)

> **Agent:** Implementation design only. Gameplay rules → `docs/design/systems/` (user-owned).

## TL;DR

`GameplayEventSystem` provides **sync pub-sub** partitioned by **Channel**. A **Channel** is identified by a **`GameplayTag`** (a distinguishing label—not a fixed enum, not bound to specific tag roots). Each **`GameplayEvent`** carries a **`GameplayTagContainer`** (any registered tags allowed; **no tag-type assumptions**) and an optional **`payload`**. No built-in `sourceId` / `targetId`; identity lives in payload when callers need it. Unqualified dispatch routes to a **default channel**. Any listener may subscribe to any channel.

---

## Scope

### In

- `GameplayEvent` — `tags` + optional `payload`
- `GameplayEventChannel` — handle keyed by a `GameplayTag`
- `GameplayEventSystem` — `channel()`, `dispatch()`, `subscribe()`, `unsubscribe()`
- Default channel for dispatch without explicit channel
- Listener matching via `event.tags` (`hasAll` / `hasAny` / `has`)
- Priority + stable registration order (Open Q C.2)
- Re-entrant dispatch depth guard (Open Q C.3)
- Trace kind `event.dispatch`
- Probe tests

### Out (later)

- Async / queued dispatch
- Global “listen to everything” bus without channel (use default + broad filters if needed)
- GA integration (CORE-F04+)
- Access control / listener permissions
- Payload JSON Schema enforcement (DATA-F01)

---

## Context

Design doc requires **publish-subscribe** for equipment passives, combat hooks, and future GA “listen then react”. CORE-F02 provides Tag matching; F03 adds **event records** and **routed dispatch**.

User refinements (2026-07-13):

1. **Do not restrict** which tags may appear on `GameplayEvent.tags`.
2. **Do not** embed `sourceId` / `targetId` on `GameplayEvent`; use `payload` when needed.
3. **Channel = Tag as name**, replacing hard-coded enums; channels are **not** tied to mandated roots like `GameplayEvent.Combat`.
4. Dispatch **without** channel → **default channel**; **any** code may listen on **any** channel.

---

## Decision log

| # | Topic | Decision | Rationale |
|---|--------|----------|-----------|
| D1 | System name | **`GameplayEventSystem`** | System suffix: dispatch/process |
| D2 | Event shape | **`{ tags, payload? }` only** | User: no fixed src/target fields |
| D3 | Event `tags` | **`GameplayTagContainer`**, any registered tags | User: no assumptions on tag namespaces |
| D4 | Tag validation on event | **None** (empty container allowed) | User: do not limit usage; listeners decide relevance |
| D5 | Channel identity | **`GameplayTag`** via `GameplayTagManager` | User: Tag replaces enum; label only |
| D6 | Channel binding | **Not** tied to specific roots | User: `Combat` channel could use tag `Combat` or `MyMod.CombatBus` |
| D7 | Default channel | **Built-in**; tag name **`Channel.Default`** (registered in native tags) | Unqualified dispatch target |
| D8 | Dispatch API | `dispatch(channel, event)` or `dispatch(event)` → default | Explicit or default routing |
| D9 | Subscribe scope | **Any listener, any channel** | User: no listener restrictions |
| D10 | Listener filter | Optional `requiredAll` / `requiredAny` on **`event.tags`** | Reuse F02 matching |
| D11 | Dispatch snapshot | **Clone** `event.tags` at dispatch entry | Listeners see stable tags during handler chain |
| D12 | Sync only | Handlers run inline in F03 | Deterministic replay |
| D13 | Order | Higher **`priority`** first; tie → **registration order** | Design Open Q C.2 |
| D14 | Re-entrancy | **`maxDispatchDepth`** (default 16); overflow throws | Design Open Q C.3 |
| D15 | Trace | `event.dispatch` with channel tag name + tag list + payload keys (not full payload dump) | Observability without huge logs |

---

## Architecture

```text
GameplayTagManager
        │
        ▼
GameplayEventSystem
  ├── defaultChannel: GameplayEventChannel
  ├── channels: Map<tagIndex, ListenerList>   // lazy create on channel()
  ├── channel(tag): GameplayEventChannel
  ├── dispatch(channel?, event)
  └── subscribe(options) / unsubscribe(listenerId)

GameplayEvent
  ├── tags: GameplayTagContainer   (snapshot cloned on dispatch)
  └── payload?: GameplayEventPayload
```

### `GameplayEvent`

```typescript
type GameplayEventPayload = Record<string, unknown>;

type GameplayEvent = {
  tags: GameplayTagContainer;
  payload?: GameplayEventPayload;
};
```

**Construction helpers** (implementation):

- `createGameplayEvent(manager, { tags?: GameplayTag[], payload? })` — builds container from tag list
- Callers may attach **any** tags: event kinds, facets, debug markers, channel-unrelated labels

**Not on `GameplayEvent`:** `sourceId`, `targetId`, `instigator`, `channel` (channel is a **routing argument**, not stored on the event unless callers add a tag/payload field themselves).

**Payload examples** (convention only, not enforced):

```typescript
{ sourceId: 'player-1', targetId: 'enemy-3', amount: 6 }
{ cardInstanceId: 'c_42', handIndex: 2 }
```

### `GameplayEventChannel`

A **thin wrapper** around one `GameplayTag`:

```typescript
type GameplayEventChannel = {
  readonly tag: GameplayTag;
  readonly name: string; // tag.name alias for logs
};
```

- Obtained via `eventSystem.channel(someTag)` — **any** resolved tag the project registered
- Two channels are distinct if their tag indices differ
- **No validation** that channel tag matches tags inside `event.tags`

**Default channel:** `eventSystem.defaultChannel` or `channel(manager.resolve('Channel.Default'))`.

### `GameplayEventSystem`

**Dependencies:** `GameplayTagManager`, optional `TraceSink`.

| Method | Behavior |
|--------|----------|
| `channel(tag)` | Return (or lazily register) channel for this tag |
| `dispatch(event)` | `dispatch(defaultChannel, event)` |
| `dispatch(channel, event)` | Route to listeners registered on that channel only |
| `subscribe(options)` | Register listener; returns `listenerId` |
| `unsubscribe(listenerId)` | Remove listener |

**Subscribe options:**

```typescript
type GameplayEventSubscribeOptions = {
  channel: GameplayEventChannel;
  listenerId?: string;           // auto-generated if omitted
  priority?: number;               // default 0
  requiredAll?: GameplayTag[];     // optional filter on event.tags
  requiredAny?: GameplayTag[];
  handler: (event: GameplayEvent) => void;
};
```

**Matching algorithm** (per listener, on dispatch):

1. If `requiredAll` set → `event.tags.hasAll(requiredAll)`
2. If `requiredAny` set → `event.tags.hasAny(requiredAny)`
3. If both set → **both** must pass
4. If neither set → handler receives **all** events on that channel

**Dispatch algorithm:**

1. Increment dispatch depth; throw if `> maxDispatchDepth`
2. Clone `event.tags` into read-only snapshot; pass `{ tags: snapshot, payload: event.payload }` to handlers
3. Collect listeners for **this channel only**
4. Sort: `priority` desc, then registration index asc
5. Invoke handlers synchronously
6. Emit trace (if sink)
7. Decrement dispatch depth

**Re-entrant dispatch:** Handler may call `dispatch` again (same or other channel); depth guard applies.

---

## Channel vs event tags (mental model)

| Concept | Role |
|---------|------|
| **Channel tag** | **Router label** — which subscriber list to consult (like a named bus) |
| **Event `tags`** | **Description** of this occurrence — any facets the publisher chooses |

Example:

```typescript
const combat = eventSystem.channel(manager.resolve('Combat'));

eventSystem.dispatch(combat, {
  tags: containerWith([
    'GameplayEvent.Combat.DamageDealt',
    'Character.Player',
    'Status.Marked',
  ]),
  payload: { sourceId: 'p1', targetId: 'e1', amount: 8 },
});

eventSystem.subscribe({
  channel: combat,
  requiredAll: [manager.resolve('Status.Marked')],
  handler: (ev) => { /* ... */ },
});
```

Channel tag `Combat` does **not** have to appear in `event.tags`.

---

## Native tags (F03 additions)

Add to `native-tags.ts` / `data/tags.json`:

```json
"Channel.Default"
```

Project may register additional channel labels (`Combat`, `Dungeon`, `Debug`, …) as ordinary tags—**not** mandated by the framework.

---

## Trace

```typescript
type EventDispatchEntry = {
  kind: 'event.dispatch';
  t: number;
  channel: string;       // channel.tag.name
  tags: string[];        // explicit tag names on event
  payloadKeys?: string[]; // Object.keys(payload) if present
};
```

Extend `GameTraceEntry` union in `trace.ts` when implementing.

---

## File layout (planned)

```text
packages/core/src/
  events/
    gameplay-event.ts
    gameplay-event-channel.ts
    gameplay-event-system.ts
    errors.ts                 # GameplayEventError
    index.ts
  tags/native-tags.ts         # + Channel.Default
data/tags.json                # optional channel labels
```

**Public exports:** `GameplayEvent`, `GameplayEventChannel`, `GameplayEventSystem`, `GameplayEventError`, `createGameplayEvent` (helper name TBD).

---

## Probe tests (acceptance)

| # | Case | Assert |
|---|------|--------|
| 1 | Default dispatch | `dispatch(event)` invokes listener on default channel only |
| 2 | Channel isolation | Listener on `Combat` not called when dispatching to `Dungeon` |
| 3 | Tag filter | `requiredAll` / `requiredAny` on **event.tags**; unrestricted tags work |
| 4 | Multi-facet event | Event with unrelated tag namespaces still matches listener filters |
| 5 | Order | Higher priority first; same priority → registration order |
| 6 | Depth guard | Handler re-dispatch until max depth throws |
| 7 | Snapshot | Mutating publisher container after dispatch does not affect handler |
| 8 | Trace | `event.dispatch` recorded with channel + tag names |

Each test uses fresh `GameplayTagManager` + `GameplayEventSystem`.

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **CORE-F03-S01** | `GameplayEvent`, channel handle, default channel tag |
| **CORE-F03-S02** | `GameplayEventSystem` subscribe / unsubscribe / dispatch |
| **CORE-F03-S03** | Filters, priority, depth guard |
| **CORE-F03-S04** | Trace + probe tests; `npm run verify` green |

---

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Single global bus | User: channels for partition; default for unqualified |
| Channel as string enum | User: Tag as name instead |
| Require `GameplayEvent.*` on event tags | User: no tag-type assumptions |
| Built-in source/target on event | User: payload optional fields |
| Mandate channel tag ∈ event.tags | User: channel is routing only |
| Async queue | Deferred; sync for replay |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Empty `event.tags` matches too broadly | Document; listeners use `requiredAll` / `requiredAny` |
| Channel tag proliferation | Convention doc; not enforced in code |
| Payload shape drift | Later DATA-F01 schema; F03 `Record<string, unknown>` |

---

## Acceptance (CORE-F03)

- [x] `GameplayEvent` with unrestricted `GameplayTagContainer` + optional payload
- [x] Channel = any `GameplayTag`; default channel for bare dispatch
- [x] Subscribe/dispatch with isolation, filters, priority, depth guard
- [x] Probe tests 1–8 pass; trace `event.dispatch`
- [x] FEATURE_REGISTRY + ACTIVE_WORK updated on completion

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-13 | Implemented S01–S04; 10 event system tests; trace event.dispatch |
| 2026-07-13 | Initial accepted spec; user: unrestricted event tags, no src/target, Tag-as-channel |
