# CORE-F10 — GFC gaps for data-driven cards

## Meta
- **ID:** CORE-F10
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-14
- **Related:** [CORE-F08](./CORE-F08-gameplay-ability-framework.md), [CORE-F09](./CORE-F09-numeric-calculation-pipeline.md), [COMBAT-F02](../Combat/COMBAT-F02-gfc-combat-integration.md), [COMBAT-F03](../Combat/COMBAT-F03-combat-describability-probes.md), [DATA-F01](../Data/DATA-F01-card-asset-pipeline.md)
- **Gameplay (read-only):** [gameplay-framework.md](../../design/systems/gameplay-framework.md) §GameplayEffect Tag Requirements; [effects.md](../../design/systems/effects.md) §堆叠

Depends on: CORE-F08, CORE-F09, COMBAT-F02  
Blocks: COMBAT-F03 (Vulnerable stacking), DATA-F01

---

## TL;DR

Close GFC/GA holes for data-driven cards: **Ongoing Tag Requirements** (owner + source + target sides), **GE stacking policy**, wire parse for GE/GA, tag resolution, and **TakeDamage as a grantable GA**. Not a full UE-GAS port.

---

## Locked decisions (2026-07-14)

| ID | Decision |
|----|----------|
| Q1 Ongoing gates | **Source + target only** (no owner side); target defaults to host entity |
| Q2 TakeDamage | **Upgrade to GA** — grantable definition; commit activates GA instead of ad-hoc session function |
| Q3 Parse location | `packages/core/src/definitions/` (parse only; no I/O) |
| Q9 Stacking | **In scope** — minimal policy on `GameplayEffectDefinition`; Vulnerable uses **duration stack** (see S05) |

---

## Goal

After F10:

1. GE: modifiers, duration, granted tags, ongoing gates, **stacking policy**.
2. GA: preview / listen / endPolicy — serializable + parseable.
3. Tag names in assets → resolved at load.
4. **TakeDamage GA** on target (or bootstrap grant) for commit settlement.

---

## Product stance

| Topic | Decision |
|-------|----------|
| Inactive GE (ongoing fail) | Still applied; modifiers + granted tags **off** until gates pass |
| Stacking default | **`none`** — each apply = new instance (backward compatible) |
| Vulnerable stack rule | `stackBy: 'effectId'`, `onReapply: 'addDuration'` — 2 层 = 持续 2 回合，倍率仍 ×1.25 |
| TakeDamage GA | Wraps Block→HP settlement; **may** keep `settleTakeDamage()` as internal impl called by GA activate |
| Application Tag Requirements | **Defer** (apply-time gate); Ongoing covers Vulnerable P0 |

---

## Scope

### In (P0)

1. **Ongoing Tag Requirements** — owner / source / target sides (Duration + Infinite).
2. **GE stacking policy** — keyed by `effect.id`; policies: `none`, `addDuration`, `refreshDuration`, `addMagnitude` (implement subset needed for Vulnerable).
3. **Wire parse** for GE + GA + helpers.
4. **Tag resolution** at parse time.
5. **TakeDamage GA** — `createTakeDamageAbilityDefinition()`; tests for activate → Block/HP delta.
6. **`stacks` / duration magnitude** on active effect where stacking applies.

### Out

| Topic | Target |
|-------|--------|
| File I/O, JSON on disk | DATA-F01 |
| SetByCaller / CalculationClass | Later |
| Conditional DSL | Later |
| Cross-entity dependent invalidation graph | Later |
| Equipment / editor | Later |

---

## Architecture

```text
packages/core/src/
  definitions/
    wire-types.ts
    parse-definitions.ts
  gfc/
    types.ts              + ongoingTagRequirements, stacking
    gameplay-framework-component.ts  + gate, stack-on-reapply
  combat/
    take-damage.ts        + createTakeDamageAbilityDefinition()
    take-damage-ability.ts  (optional split)
```

### Ongoing Tag Requirements

```ts
type OngoingTagRequirements = {
  sourceRequiredTags?: readonly string[];
  sourceBlockedTags?: readonly string[];
  targetRequiredTags?: readonly string[];
  targetBlockedTags?: readonly string[];
};
```

| Side | Resolved from `applicationContext` |
|------|--------------------------------------|
| Source | `sourceEntityId` ?? `instigatorEntityId` |
| Target | `targetEntityId` ?? host entity (GFC that holds the effect) |

No separate **owner** side — gate the unit holding the effect via **target** when context target is omitted.

Missing entity when a side has gates → **inactive**.

### GE stacking (minimal)

```ts
type GameplayEffectStacking =
  | { kind: 'none' }
  | {
      kind: 'byEffectId';
      /** When same definition.id is applied again to same owner */
      onReapply: 'addDuration' | 'refreshDuration' | 'addMagnitude';
    };
```

| Policy | Behavior |
|--------|----------|
| `none` | New active instance (current F06–F09 behavior) |
| `addDuration` | Merge into existing instance: `duration.magnitude += incoming.magnitude` (or +1 per layer); **one** modifier set |
| `refreshDuration` | Reset `durationProgress = 0`; optionally refresh magnitude |
| `addMagnitude` | Stack numeric contribution (for “+1 每层” debuffs); **not** used for Vulnerable P0 |

**Granted tags:** on stack merge, re-apply tag grants (refcount via TagContainer). On expiry, remove once.

**Snapshot:** expose `stacks` or effective `durationRemaining` on active effect snapshot when Duration.

### TakeDamage GA

```text
Grant: ga.combat.take-damage (passive or active, auto not required)
Activate ctx: target = self (the damaged entity)
effectsOnActivate: internal — calls same math as settleTakeDamage (Instant GE Block/HP)
```

Session on TryPlayCard: `target.tryActivate(takeDamageHandle, { instigator, source, target })` then reset meta.

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **S01** | Ongoing gates (owner/source/target) + inactive/active + tests |
| **S02** | Wire DTOs + parse GE/GA |
| **S03** | Tag resolution + errors |
| **S04** | TakeDamage GA + migrate session to activate GA |
| **S05** | Stacking policy + `addDuration` probe |
| **S06** | **Timing events** — native `Timing.TurnEnd` tags + combat turn-end dispatch (Duration tick) |

---

## Exit criteria

- [x] S01–S06 green; `npm run verify` (118 tests)
- [x] Ongoing gates: source + target only
- [x] Stacking `addDuration` + TakeDamage GA + parse + `Timing.TurnEnd`
- [ ] Status → Done after commit; PROGRESS_LOG

---

## Approval

**Review** — implementation complete; awaiting commit approval.
