# COMBAT-F03 — Combat describability probes (pre–JSON)

## Meta
- **ID:** COMBAT-F03
- **Status:** Review
- **Owner:** —
- **Last updated:** 2026-07-14
- **Related:** [COMBAT-F02](./COMBAT-F02-gfc-combat-integration.md), [CORE-F10](../Core/CORE-F10-data-driven-gfc-gaps.md), [DATA-F01](../Data/DATA-F01-card-asset-pipeline.md)
- **Gameplay (read-only):** [combat.md](../../design/systems/combat.md), [effects.md](../../design/systems/effects.md) §易伤堆叠

Depends on: COMBAT-F02, CORE-F10 (stacking, Ongoing, TakeDamage GA)  
Blocks: DATA-F01 schema freeze

---

## TL;DR

Prove early card logic in GFC before JSON. Five probes as `CardDefinition` TS objects. **Expanded CLI deck** includes probe cards for manual testing. Handoff checklist → DATA-F01.

---

## Locked decisions (2026-07-14)

| ID | Decision |
|----|----------|
| Q4 Vulnerable | **One Duration GE**: `grantedTags: Status.Vulnerable` + Multiply ×1.25 on `DamageToTake` @ absorb stage; **duration stacks** (层数 = 回合数，倍率不叠) via F10 `addDuration` |
| Q5 CLI deck | **Include probe cards in default starter** for richer CLI testing |
| Q6 commitEffects | Session applies `CardDefinition.commitEffects` on TryPlayCard |
| Q10 Duration tick | Combat must **emit turn-end timing events** so Duration GE progresses (COMBAT-F03-S01 dependency) |
| Q11 Settle rounding | `Math.floor` on HP loss from fractional `DamageToTake` |

---

## Goal

| Probe | Card (example id) | Proves |
|-------|-------------------|--------|
| **P1 Vulnerable** | `weaken` | Duration GE: tag + absorb ×1.25; stack duration |
| **P2 Self buff** | `flex` | commit Infinite/Duration GE on self → higher next Strike |
| **P3 Mark** | `mark` (or bundled in weaken) | `grantedTags` on target |
| **P4 Block stack** | `defend` ×2 | Block 5+5 same turn |
| **P5 Non-damage** | `wait` / `focus` | AP only; no TakeDamage |

---

## Vulnerable (canonical shape)

```ts
{
  id: 'ge.status.vulnerable',
  duration: { kind: 'Duration', unitTag: 'Timing.TurnEnd', magnitude: 1 },
  grantedTags: ['Status.Vulnerable'],
  stacking: { kind: 'byEffectId', onReapply: 'addDuration' },
  modifiers: [{
    attribute: 'DamageToTake',
    op: 'Multiply',
    magnitude: 1.25,
    evaluationStage: 'EvaluationStage.DamageAbsorb',
  }],
}
```

Applied on **commit** via `commitEffects: [{ target: 'target', effect: … }]`.

Second Weaken before expiry → 2-turn duration, preview Strike still ×1.25 (not ×1.5625).

---

## Architecture

```text
combat/defs/
  card-definition.ts
  strike.ts, defend.ts, bash.ts
  weaken.ts, flex.ts, wait.ts

CombatSession
  preview → ability activate
  commit → commitEffects + TakeDamage GA on target (if flagged) + AP + discard

STARTER_DECK (CLI)
  strike×4, defend×3, bash×1, weaken×2, flex×1, wait×1  (tunable)
```

### CardDefinition

```ts
type CardDefinition = {
  id: string;
  name: string;
  cost: number;
  targeting: 'none' | 'self' | 'single_enemy';
  ability: GameplayAbilityDefinition;
  commitEffects?: readonly { target: 'self' | 'target'; effect: GameplayEffectDefinition }[];
  settleTakeDamageOnTarget?: boolean;
};
```

---

## Slices

| Slice | Content |
|-------|---------|
| **S01** | Turn-end events + P1 Vulnerable card + tests |
| **S02** | P2 flex + P3 mark |
| **S03** | P4 + P5 + expressiveness checklist |
| **S04** | Unify Strike/Defend/Bash as CardDefinition; wire expanded CLI deck |

---

## Expressiveness checklist (DATA-F01)

- [x] Card fields + commitEffects + settleTakeDamageOnTarget + applyBlockFromPreview
- [x] Nested GA/GE (stacking, duration, grantedTags)
- [x] Duration unitTag `Timing.TurnEnd`

---

## Exit criteria

- [x] ≥4 probes with automated tests; CLI deck includes probe cards
- [x] TakeDamage via GA (from F10)
- [x] Checklist complete
- [ ] Status → Done after commit

---

## Approval

**Review** — implementation complete; awaiting commit approval.
