# CORE-F11 — Extensible GA activation, SetByCaller, and reusable GE/GA assets

## Meta
- **ID:** CORE-F11
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-14
- **Related:** [CORE-F08](./CORE-F08-gameplay-ability-framework.md), [CORE-F09](./CORE-F09-numeric-calculation-pipeline.md), [DATA-F01](../Data/DATA-F01-card-asset-pipeline.md), [COMBAT-F03](../Combat/COMBAT-F03-combat-describability-probes.md)
- **Gameplay (read-only):** [gameplay-framework.md](../../design/systems/gameplay-framework.md)

Depends on: CORE-F08–F10, DATA-F01  
Touches (same Feature, not separate registry rows): combat card play, `data/` asset layout

---

## TL;DR

One CORE Feature that moves card/ability authoring toward UE GAS shape:

1. **Core** exposes an **Activation registry** (TS handlers registered by the app; no card logic in core).
2. **SetByCaller** magnitudes resolve from application/activation context.
3. **Reusable GE/GA assets** (`data/effects/`, `data/abilities/`) referenced by cards with params.
4. **Combat** migrates preview/commit into a **unified app CardPlay GA**; retire card-only session hooks.

DATA-F01 inline JSON remains the migration starting point, not the end state.

---

## Product stance (locked from user 2026-07-14)

| Topic | Decision |
|-------|----------|
| Activate code | **TS only** (no Lua/DSL yet) |
| Parameters | **Full SetByCaller** (runtime resolve from context), not only JSON-time magnitude merge |
| Commit ownership | **Unified CardPlay GA** for now; per-card Commit handlers deferred |
| Feature granularity | **Single CORE-F11**; combat/data changes are slices inside this Feature |
| Core purity | Handlers live in app/combat host; core only provides registry + lifecycle hooks |

---

## Problem with DATA-F01 shape

| Gap | Today |
|-----|--------|
| No reuse | Each card inlines full GA/GE trees |
| Fixed semantics | `effectsOnActivate` + `commitEffects` + `settleTakeDamageOnTarget` / `applyBlockFromPreview` |
| Builtin escape hatch | `builtinActivation: 'combat.takeDamage'` is core-owned combat policy |
| Weak params | Magnitudes are Scalable / AttributeBased only — no SetByCaller |

Framework expectation: Activate = app-defined TS; data configures which handler + params. Parameterized `effectsOnActivate` may still be used **inside app handlers** as a convenience — that is application pattern, not core’s only Activate model.

---

## Target architecture

```text
packages/core
  GA lifecycle: grant / tryActivate / end / listenWhileActive
  ActivationRegistry: register(id, handler) → tryActivate dispatches
  GE magnitude: Scalable | AttributeBased | SetByCaller
  Asset resolve: templateId + setByCaller map → runtime Def (I/O-free)

packages/cli | combat host (app)
  registerCombatAbilityHandlers(registry)
  ga.card.play (unified preview/commit)
  ga.combat.takeDamage (moved out of core builtin enum)

data/
  effects/*.json          # reusable GE templates
  abilities/*.json        # reusable GA templates (handlerId + default structure)
  cards/*.json            # refs + params (thin)
  decks/starter.json
```

### Card JSON sketch (target)

```json
{
  "id": "strike",
  "name": "Strike",
  "cost": 1,
  "targeting": "single_enemy",
  "abilityRef": "ga.card.play",
  "setByCaller": {
    "Data.Damage": 6,
    "Data.CommitMode": "settleTakeDamage"
  }
}
```

Exact key naming (`Data.Damage` vs free strings) is an open board item; prefer tag-like or dotted names for UE familiarity.

### GE modifier sketch

```json
{
  "attribute": "Damage",
  "op": "Override",
  "magnitude": { "kind": "SetByCaller", "key": "Data.Damage" }
}
```

Resolve order at apply/activate: caller map on `GameplayEffectApplicationContext` / `AbilityActivationContext` → missing key fails loudly (or optional default — board item).

---

## Core responsibilities

| Module | Responsibility |
|--------|----------------|
| `ActivationRegistry` | Map `handlerId` → `(ctx, def, host) => ActivationResult` |
| `GameplayAbilityDefinition` | `handlerId?: string`; keep optional `effectsOnActivate` for simple / host convenience |
| Magnitude resolve | Add `SetByCaller`; wire through `resolveModifierMagnitude` |
| Apply/Activate context | Carry `setByCaller: ReadonlyMap` or `Record<string, number>` (extend to string/bool later if needed) |
| Asset parse | `resolveGameplayEffectRef` / `resolveGameplayAbilityRef` — pure merge, no fs |

**Remove / deprecate in this Feature (no long-lived shims unless needed for one commit):**

- CardDefinition `commitEffects`, `settleTakeDamageOnTarget`, `applyBlockFromPreview`
- Core `builtinActivation: 'combat.takeDamage'` (handler registered by combat host)
- Inline-only expectation that every card embeds a full GA tree

---

## App / combat responsibilities

| Piece | Notes |
|-------|--------|
| Unified **CardPlay** GA | Preview on activate (meta GEs); on TryPlayCard → Commit path inside same handler (or endPolicy + listenWhileActive as today) |
| Commit modes (params) | e.g. settle damage / apply block / apply commit GEs — expressed as **handler + SetByCaller**, not CardDefinition flags |
| TakeDamage | App-registered GA handler |
| Per-card Commit | **Out** — allow later via `handlerId` override on a few cards without CORE redesign |

---

## Slices (implementation order inside CORE-F11)

| Slice | Deliverable |
|-------|-------------|
| **S01** | SetByCaller magnitude + context plumbing + unit tests |
| **S02** | ActivationRegistry; migrate TakeDamage off core builtin |
| **S03** | GE/GA template assets + ref resolve; migrate 2–3 cards as proof |
| **S04** | Unified CardPlay GA; retire card session hooks; migrate all six cards + starter |
| **S05** | Docs DoD: registry Done, ACTIVE_WORK, PROGRESS_LOG, delete stale DATA-F01 “end state” claims |

Slices are sequential but one Feature / one commit-pause rhythm unless user prefers multi-commit.

---

## Open decisions (short board)

| ID | Question | Default if “按建议” |
|----|----------|---------------------|
| Q1 | SetByCaller value type | `number` only in F11; string tags via separate keys later |
| Q2 | Missing SetByCaller key | Hard error on resolve |
| Q3 | Asset dirs | `data/effects/`, `data/abilities/` next to `data/cards/` |
| Q4 | Card still embeds listenWhileActive? | Prefer ability template owns listen; card only refs + params |
| Q5 | Keep empty `effectsOnActivate` on ability JSON? | Optional; CardPlay handler may ignore list and apply its own GEs |

---

## Out of scope

- Script languages / Blueprint visual scripting
- Per-card custom Commit handlers (design allows later; not built here)
- Equipment injection (EQUIP-F01)
- Editor UI
- Zod-first schema freeze (hand parse + tests enough; Zod optional)

---

## Exit criteria

- [x] SetByCaller resolves from activation/application context in tests
- [x] At least one ability handler registered outside core (TakeDamage or CardPlay)
- [x] Strike (and preferably all six) use asset refs + params; shared DealDamage (or equivalent) GE template reused
- [x] No CardDefinition commit/settle/block flags; no core `builtinActivation` enum requirement for combat
- [x] `npm run verify` green
- [x] Status → Done; FEATURE_REGISTRY + PROGRESS_LOG + ACTIVE_WORK

---

## Pre-flight (design-time)

| Item | Assessment |
|------|------------|
| Context | DATA-F01 JSON works; magnitude already has AttributeBased; GA has listenWhileActive |
| Prerequisites | Sound for S01–S02; S03–S04 need combat migration care |
| Tech-debt risk | **Medium** — if we half-migrate (refs without registry), debt increases |
| WIP | CORE/COMBAT/DATA phase features Done; CLI-F01 Planned only |
| Recommendation | **Go** after board Q1–Q5 (or as-recommended) |

---

## Approval

**Review** — implement after user confirms board (or “按建议”) and promotes implementation.
