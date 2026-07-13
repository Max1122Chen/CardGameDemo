# CORE-F07 — Event-driven Duration for GameplayEffect

Status: Done  
Feature ID: CORE-F07  
Updated: 2026-07-13

---

## Scope

Add duration support to GE using event-driven units instead of real-time seconds.

Core idea:

- Duration is defined by a `unitTag` + `magnitude`.
- A GE progresses when GFC receives events whose `event.tags` match that `unitTag`.
- GFC subscribes to channels **actively** based on its own active duration effects (not globally routed).

This preserves flexibility across combat, dungeon, card-play, and future custom timing units.

---

## Decisions

| # | Topic | Decision | Why |
|---|------|----------|-----|
| D1 | Duration unit | `DurationSpec { unitTag, magnitude }` | User-defined timing signal model |
| D2 | Trigger match | Progress when incoming `GameplayEvent.tags` contains `unitTag` (hierarchy-aware) | Reuse existing GameplayTag matching |
| D3 | Channel coupling | Duration does not bind to one channel in definition | Unit semantics independent from routing |
| D4 | Subscription owner | GFC actively manages channel subscriptions by its active effects | Different entities need different channels |
| D5 | Progress granularity | Each matching event contributes 1 unit by default | Deterministic and simple baseline |
| D6 | Expiration | Effect removed when progress reaches `magnitude` | Clear and replayable lifecycle |

---

## Data model (proposed)

```typescript
type DurationSpec = {
  unitTag: GameplayTag;
  magnitude: number;
};

type GameplayEffectDuration =
  | { kind: 'Instant' }
  | { kind: 'Infinite' }
  | { kind: 'Duration'; spec: DurationSpec };

type ActiveGameplayEffect = {
  id: string;
  definition: GameplayEffectDefinition;
  stacks: number;
  durationProgress?: number; // for Duration only
};
```

Optional per-effect channel hint (for performance, not semantic requirement):

```typescript
type GameplayEffectDefinition = {
  // ...
  durationChannelHints?: GameplayEventChannel[];
};
```

If omitted, host logic may attach GFC to broad default channels for that entity domain.

---

## Runtime behavior

1. On applying a Duration GE:
   - Insert into `activeEffects` with `durationProgress = 0`.
   - Register/update duration drivers and required channel subscriptions.
2. On event received by GFC:
   - Check each active Duration GE:
     - if `event.tags.has(unitTag)` then `progress += 1`.
   - Remove any GE whose progress reaches magnitude.
   - Recompute attributes/tags after removals.
3. On removal/dispose:
   - Update driver table.
   - Unsubscribe channels with zero remaining demand.

---

## Driver/subscription strategy

Internal structure example:

```typescript
type DurationDriver = {
  unitTag: GameplayTag;
  effectIds: Set<string>;
};
```

Recommended GFC internals:

- `durationDriversByUnitTag: Map<string, DurationDriver>`
- `channelSubscriptions: Map<string, SubscriptionId>`

Key rule:

- Subscriptions are reference-counted by active duration demand; avoid duplicate subscriptions.

---

## Edge handling

- `magnitude <= 0` is invalid and throws.
- Event with multiple matching tags still increments once per GE per dispatch (default policy).
- Re-entrant dispatch follows existing event system depth guard.
- Removing an effect during iteration must be safe (snapshot or deferred remove list).

---

## Trace events (additions)

- `ge.duration.progress` with `{ effectId, unitTag, before, after, target }`
- `ge.duration.expired` with `{ effectId, unitTag, finalProgress }`
- `gfc.channel.subscribe` / `gfc.channel.unsubscribe` for duration driver changes

These traces are essential for deterministic replay and tuning.

---

## Test plan (probe level)

1. Duration GE progresses only on matching `unitTag`.
2. Non-matching events do not progress.
3. Progress reaches magnitude then removes effect.
4. Multiple duration effects with different units progress independently.
5. GFC subscribes only to needed channels and unsubscribes when no demand remains.
6. Entity A duration listeners do not affect entity B.

---

## Exit criteria (F07)

- Duration GE lifecycle works with event-driven progression.
- GFC active subscription behavior implemented and tested.
- Attribute state recomputes correctly on duration expiry.
- Verify pipeline green.
- Docs/logs updated.
