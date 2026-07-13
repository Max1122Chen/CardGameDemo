# CORE-F06 — Attribute + minimal GameplayEffect on GFC

Status: Done  
Feature ID: CORE-F06  
Updated: 2026-07-13

---

## Scope

Implement the first usable Attribute + GE layer on top of GFC, aligned with GAS shape but intentionally smaller:

- Attribute uses UE-like `BaseValue` + `CurrentValue`.
- Attribute writes are **GE-only** (no direct set API on GFC).
- Modifier op `Multiply` uses **continuous multiplication** (product), not UE additive aggregation.
- GE supports minimal lifecycle for F06: `Instant` and `Infinite` only.
- Duration behavior is deferred to `CORE-F07`.

Out of scope for F06:

- Duration ticking and expiration.
- Stacking policy beyond a minimal deterministic rule.
- Full GA integration and cooldown/cost pipelines.

---

## Decisions

| # | Topic | Decision | Why |
|---|------|----------|-----|
| D1 | Attribute shape | `AttributeValue = { baseValue, currentValue }` | Keep explicit state; easy trace + debug |
| D2 | Write authority | Only GE application mutates attributes | Preserve GAS-like central control |
| D3 | Multiply semantics | `current = base + addSum`; then apply multiply as product | User requirement: continuous multiply |
| D4 | GE lifecycle in F06 | `Instant` applies once; `Infinite` applies and remains active | Provides immediate utility before Duration |
| D5 | Effect storage | GFC keeps `activeEffects` for non-instant effects | Needed for future F07 duration + cleanup |
| D6 | Determinism | Stable modifier evaluation order by effect application order | Reproducible replay/tests |

---

## Data model (proposed)

```typescript
type AttributeKey = string;

type AttributeValue = {
  baseValue: number;
  currentValue: number;
};

type GameplayModifierOp = 'Add' | 'Multiply' | 'Override';

type GameplayEffectModifier = {
  attribute: AttributeKey;
  op: GameplayModifierOp;
  magnitude: number;
};

type GameplayEffectDurationKind = 'Instant' | 'Infinite' | 'Duration'; // Duration implemented in F07

type GameplayEffectDefinition = {
  id: string;
  duration: GameplayEffectDurationKind;
  modifiers: GameplayEffectModifier[];
  grantedTags?: GameplayTag[];
};
```

Notes:

- Keep `Duration` enum member for forward-compat, but F06 execution path rejects/guards it.
- `Override` follows last-applied-wins among active modifiers.

---

## GFC API changes (target)

- `getAttribute(attribute: AttributeKey): AttributeValue | undefined`
- `setAttributeBase(attribute: AttributeKey, value: number): void` (framework/internal only; not exposed as arbitrary gameplay write API)
- `applyGameplayEffect(def: GameplayEffectDefinition): AppliedEffectId`
- `removeGameplayEffect(id: AppliedEffectId): boolean`
- `listActiveEffects(): readonly ActiveGameplayEffect[]`

Behavior:

1. Applying GE validates modifier schema.
2. `Instant`: execute once, do not store in `activeEffects`.
3. `Infinite`: store in `activeEffects`, then recompute affected attributes.
4. Any add/remove of active non-instant effects triggers deterministic recompute for affected attributes.

---

## Attribute recompute rule

For each attribute:

1. Start from `baseValue`.
2. Sum all `Add` magnitudes into `addSum`.
3. Multiply all `Multiply` magnitudes into `mulProduct` (default `1`).
4. Compute `value = (baseValue + addSum) * mulProduct`.
5. If any `Override` exists, use last-applied override value.
6. Write to `currentValue`.

This keeps math simple and deterministic, while matching user-stated multiply semantics.

---

## Trace events (minimal additions)

Introduce or extend trace kinds:

- `attribute.base.set`
- `attribute.current.recompute`
- `ge.applied`
- `ge.removed`

Payload guidance:

- Record `entityId`, `attribute`, `before`, `after`, `effectId`, `effectDefId`.
- Avoid dumping entire effect payload when noisy; include key IDs and changed values.

---

## Test plan (probe level)

1. Attribute initialize and base/current default behavior.
2. `Instant` add modifies current once and does not stay active.
3. `Infinite` effect remains active and recomputes after removal.
4. Multiple `Multiply` modifiers use continuous product.
5. Add + Multiply mixed order remains deterministic.
6. Override wins with last-applied rule.
7. Unsupported `Duration` in F06 throws explicit not-implemented error.

---

## Exit criteria (F06)

- GFC can hold and query attributes.
- GE can be applied/removed with `Instant` + `Infinite`.
- Recompute is deterministic and covered by tests.
- Verify pipeline green.
- Documentation synced in `FEATURE_REGISTRY`, `ACTIVE_WORK`, `PROGRESS_LOG`.

---

## Next

`CORE-F07` adds event-driven Duration (`unitTag` + magnitude) and GFC active channel subscription management.
