# CORE-F13 — Thin GA runtime + legacy test/code purge

## Meta
- **ID:** CORE-F13
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-16
- **Related:** [CORE-F12](./CORE-F12-tech-debt-polish.md), [CORE-F08](./CORE-F08-gameplay-ability-framework.md), [CORE-F11](./CORE-F11-extensible-ga-assets.md), [COMBAT-F02](../Combat/COMBAT-F02-gfc-combat-integration.md)
- **Gameplay (read-only):** [gameplay-framework.md](../../design/systems/gameplay-framework.md)
- **Motivation:** F12 moved **combat** to hook-driven GA, but **core runtime** still embeds F08/F11 policy (auto cost, auto `effectsOnActivate`, declarative listen, auto end). Production works only because data sets `costApplyTiming: manual` / `endPolicy: manual` to **opt out** of framework defaults — a smell F13 fixes.

Depends on: CORE-F12 Done (local; uncommitted batch)

---

## TL;DR

| Pillar | Target |
|--------|--------|
| **1. Framework boundary** | `tryActivate` = tag gates + create instance + invoke hook. **No** auto cost, auto GE apply, declarative listen, or auto end. |
| **2. Code hygiene** | Remove deprecated Def fields, dead combat helpers, dual TakeDamage source, and **F08-era unit tests** that assert removed behavior. |

**Kept in core (agreed pushback):**
- Tag gates in `canActivate` / `evaluateActivation`
- `endAbility` → stop all instance listeners (resource cleanup, not lifecycle policy)
- Hook **services**: `startListen`, `stopListen`, `checkCost`, `applyCost`, `commitAbility`, `applyEffectBindings`, `endAbility`
- Grant / revoke / active instance map / trace

**Deferred sub-decision (not blocking S01):**
- **Passive / reaction GA** (`passiveTrigger`, grant-time auto-activate) — keep minimal core helper vs move to `@cardgame/combat`; see §Passive.

---

## Problem statement

### A. Framework overreach (runtime)

Current `GameplayAbilityRuntime.tryActivate` pipeline:

```text
canActivate (incl. cost afford check when costApplyTiming === 'activate')
→ create ActiveAbilityRecord
→ [auto] applyCost when costApplyTiming === 'activate'
→ [auto] foreach effectsOnActivate → applyGameplayEffectTo
→ handler.onActivate(services)
→ [auto] attachDeclarativeListeners if listenWhileActive
→ [auto] endAbility if shouldAutoEnd()
```

Combat card abilities **already** implement the correct flow inside hooks (`applyEffectBindings`, `startListen`, `commitAbility`, `endAbility`). The bracketed steps are **F08 spine** that contradicts F12’s “trust the hook author” model.

**Symptom:** Every combat archetype JSON carries workaround fields:

```json
"costApplyTiming": "manual",
"endPolicy": "manual",
"effectsOnActivate": []
```

These exist to **disable** framework policy, not to express game design.

### B. Legacy code and tests

| Area | Issue |
|------|--------|
| `GameplayAbilityCost`, `spendLegacyCost`, `chargeCostOnActivate` | F08 cost path; F12 uses Cost GE + services only in production |
| `listenWhileActive`, `onActiveEvent`, `onActiveAbilityEvent` | Third listen path; combat uses `services.startListen` |
| `shouldAutoEnd` / `endPolicy` heuristics | Hook-owned lifecycle; combat survives via `endPolicy: manual` |
| `effectsOnActivate` auto-apply in runtime | Duplicates `applyEffectBindings`; production archetypes use `[]` |
| `spendActionPointsEffect()` | Dead export in `card-abilities.ts` (Session path removed in F12) |
| `createTakeDamageAbilityDefinition()` TS factory | Dual source vs `data/abilities/take-damage.json` (D7 incomplete) |
| `gameplay-ability.test.ts` | Majority asserts F08 auto-behavior |
| `data-f01.test.ts` wait round-trip | Inline wire still models pre-F12 `listenWhileActive` card ability |
| `attribute-evaluation-pipeline.test.ts` probe 11 | Asserts GA auto-applies `effectsOnActivate` |

F08 and F11 tests that encoded **then-valid** framework contracts are now **misleading** if left unchanged after runtime slimming.

---

## Target architecture

### Thin `tryActivate`

```text
tryActivate(handle, ctx):
  1. evaluateActivation → tag gates only
     (optional: omit cost affordability here — hook calls checkCost when needed)
  2. create ActiveAbilityRecord (merge parameters)
  3. if handlerId: handler.onActivate(services)
  4. return { ok, instanceId, activationData }
  // never: auto cost, effectsOnActivate, listenWhileActive, shouldAutoEnd
```

### Hook services (unchanged surface)

| Service | Role |
|---------|------|
| `startListen` / `stopListen` | Explicit event subscription for this active instance |
| `checkCost` / `applyCost` / `commitAbility` | Cost GE path (UE-aligned) |
| `applyEffectBindings(when)` | Resolve `$Param` → `setByCaller`, apply bound GEs |
| `endAbility` | End instance; runtime stops all listens for that instance |

### `canActivate` contract

| Keep | Change |
|------|--------|
| Owner / source / target tag gates | Remove automatic legacy-cost and `costApplyTiming === 'activate'` affordability branches |
| Return `cannot_activate` with reason | Affordability: hook calls `checkCost()` before `commitAbility` (combat already does) |

**Rationale:** Tag gates answer “may this ability be attempted?” — not “what happens during activation.” Cost timing is hook policy.

### Def schema (after F13)

**Retained (authoring):**
- `id`, `kind`, `tags`, `handlerId`
- `parameterSchema`, `parameterValues` (grant/card overrides)
- `effectBindings`, `costEffectRef`, `costBindings`
- `passiveTrigger` — see §Passive (narrow retention or combat-only)

**Remove from types + parse + JSON:**
- `cost`, `chargeCostOnActivate`, `costApplyTiming`
- `effectsOnActivate` (on Def — GE apply only via bindings + hook or direct host apply)
- `listenWhileActive`
- `endPolicy`
- `autoActivateOnGrant` (unless folded into passive helper)
- `handler.onActiveEvent`, `ActiveAbilityEventInfo`, `GFC.onActiveAbilityEvent`

**Note:** Instant buff abilities without hooks (early F08 demos) are **out of product path**. Tests that need “apply GE on activate” should use a **test hook** or call `host.applyGameplayEffectTo` directly — not framework auto-apply.

---

## Passive / reaction abilities

F08 introduced grant-time `passiveTrigger` → listen → `tryActivate` with `effectsOnActivate`. TakeDamage today uses **handler** (`combat.takeDamage`) + JSON archetype; bootstrap still grants via TS factory.

| Option | Pros | Cons |
|--------|------|------|
| **P1 — Minimal core passive module** | Small API for “on event X, tryActivate handle Y” without declarative Def fields | Still policy in core |
| **P2 — Combat/app only** | Thinnest core | TakeDamage grant wiring moves to combat bootstrap |

**Recommendation:** **P2 for F13** — combat bootstrap explicitly grants TakeDamage and registers reaction wiring; core drops `passiveTrigger` auto pipeline. If a second passive appears before COMBAT-F04, extract a **combat** `registerPassiveReaction()` helper, not a new Def flag.

**Slice note:** S02 migrates TakeDamage to JSON-only grant; removes TS factory if redundant.

---

## Scope

### In (P0 — framework)

1. Slim `tryActivate` — remove auto cost, `effectsOnActivate` loop, `listenWhileActive`, `shouldAutoEnd`.
2. Slim `canActivate` — tag gates only (drop legacy cost timing checks).
3. Remove deprecated types, parse wire fields, and runtime helpers (`spendLegacyCost`, `attachDeclarativeListeners`, `shouldAutoEnd`, etc.).
4. Remove `onActiveEvent` / `onActiveAbilityEvent` from handler + GFC options.
5. Rewrite `gameplay-ability.test.ts` to **thin-runtime contract** (grant/revoke, tag gates, hook invocation, services, endAbility cleanup).
6. `npm run verify` green.

### In (P1 — data + combat hygiene)

7. Strip `costApplyTiming`, `endPolicy`, empty `effectsOnActivate` from `data/abilities/*.json`.
8. Delete `spendActionPointsEffect`; keep `gainBlockFromPreviewEffect` until block archetype uses JSON GE only (optional P1 stretch).
9. Single TakeDamage source — `data/abilities/take-damage.json` + bootstrap load; delete or thin `take-damage-ability.ts` factory.
10. Update `data-f01.test.ts` wait round-trip to `abilityRef` + archetype shape (no inline `listenWhileActive`).
11. Update `attribute-evaluation-pipeline.test.ts` probe 11 — direct GE apply or minimal test hook (no `effectsOnActivate` on Def).

### Out

- New card mechanics or archetypes
- Script VM / Blueprint-style graphs
- Reintroducing declarative `listenWhileActive` under another name
- Gameplay design doc edits (`docs/design/systems/*`)
- EQUIP / dungeon / enemy data Features
- Block GE full JSON migration (unless trivial alongside P1)

---

## Locked decisions (draft — implement as written unless user revises)

| ID | Decision |
|----|----------|
| D1 | **`tryActivate` never applies cost or GE automatically** |
| D2 | **Lifecycle end only via `services.endAbility()`** (or revoke semantics unchanged) |
| D3 | **Listen only via `startListen` / `stopListen` in hooks** |
| D4 | **Tag gates stay in `canActivate`** |
| D5 | **`endAbility` always unsubscribes instance listeners** |
| D6 | **Remove F08 legacy cost struct path** (`GameplayAbilityCost`) |
| D7 | **Remove Def `effectsOnActivate` from schema** — bindings + hook only |
| D8 | **Delete or rewrite tests that assert removed F08 behavior** — not shim runtime to keep them green |
| D9 | **Passive/reaction: combat bootstrap, not declarative Def spine** (P2) |
| D10 | **`applyEffectBindings` remains a core service** — resolves bindings; hook chooses when |

---

## Test migration matrix

### `packages/core/src/ga/gameplay-ability.test.ts`

| Test | Action |
|------|--------|
| grants and revokes abilities | **Keep** |
| tryActivate applies instant GE to self | **Remove** — replace with hook test using test `handlerId` + `applyEffectBindings` or direct GE apply |
| canActivate respects owner blocked tags | **Keep** |
| checks source and target tag gates | **Keep** tag assertions; **drop** `effectsOnActivate` damage — use hook or manual GE in test |
| spends cost on successful activation | **Remove** — legacy cost; cover Cost GE via services test |
| passive ability auto-activates on default channel | **Remove** from core — move to `core-f12.test.ts` / combat if still needed |
| emits ga trace entries | **Keep** (adjust setup to use hook) |
| endAbility is independent from revoke | **Keep** (use Infinite GE via hook or direct apply before activate) |
| endPolicy manual keeps Active after Instant | **Remove** — `endPolicy` deleted |
| listenWhileActive notifies host… | **Remove** — replace with `startListen` service test |
| autoActivateOnGrant with listenWhileActive | **Remove** |

### Other files

| File | Action |
|------|--------|
| `attribute-evaluation-pipeline.test.ts` probe 11 | Rewrite: `applyGameplayEffectTo` directly, or test handler |
| `data-f01.test.ts` wait round-trip | Use `abilityRef: ga.archetype.cardPlay…` pattern |
| `core-f12.test.ts` | **Keep** — already hook/archetype oriented; extend for `checkCost`/`commitAbility` if needed |
| `gameplay-framework-component.test.ts` | Audit for empty `effectsOnActivate` only — likely fine |

### New tests (thin runtime)

- Hook receives `services` and calling `endAbility` clears listeners started via `startListen`
- `checkCost` false → hook can abort without framework spending
- `commitAbility` applies cost GE once
- No `handlerId` on Def → `tryActivate` succeeds with instance created but no hook (edge case) or fail fast — **pick in S01** (recommend: require `handlerId` for `kind: active` in combat data; core allows no-op activate for generic GE-less utilities)

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **S01** | Runtime slimming + type/parse cleanup + `gameplay-ability.test.ts` rewrite; verify green |
| **S02** | JSON/data cleanup (`costApplyTiming`, `endPolicy`, …); TakeDamage single source; delete `spendActionPointsEffect` |
| **S03** | Secondary test updates (`data-f01`, attribute probe 11); remove `onActiveAbilityEvent` from RuleEngine/GFC API; docs DoD |

User review gate after **S01** (runtime behavior change is the riskiest).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Silent behavior change for hypothetical non-combat GA users | Codebase search + test rewrite; only combat uses GA in repo |
| TakeDamage grant regression | `core-f12.test.ts` + combat session tests |
| Over-deleting passive path | P2: explicit combat bootstrap grant before deleting `passiveTrigger` |
| F08 doc reads as current law | Add cross-link in F08 header: “Runtime policy superseded by F13” (one line, no rewrite) |

---

## Exit criteria

- [x] `tryActivate` does not auto-apply cost, `effectsOnActivate`, declarative listen, or auto end
- [x] `canActivate` performs tag gates only (no legacy cost / costApplyTiming)
- [x] Removed from codebase: `GameplayAbilityCost`, `listenWhileActive`, `endPolicy`, `costApplyTiming`, `onActiveEvent`, `onActiveAbilityEvent`, `shouldAutoEnd`, `attachDeclarativeListeners`, `spendLegacyCost`
- [x] `data/abilities/*.json` free of workaround timing/policy fields
- [x] No `spendActionPointsEffect` export
- [x] TakeDamage: single JSON archetype path in production bootstrap
- [x] No unit test asserts removed F08 auto-behavior without intentional legacy shim (shim **not** in scope)
- [x] `npm run verify` green (131 tests)
- [x] FEATURE_REGISTRY / ACTIVE_WORK / PROGRESS_LOG updated on completion

---

## Pre-flight

| Item | Assessment |
|------|------------|
| Context | User confirmed F13 for framework boundary + code/test purge (2026-07-16) |
| Prerequisites | CORE-F12 implemented locally |
| Tech-debt risk | **Medium** — behavior change in core; combat tests are safety net |
| WIP | F12 commit pending; dungeon/random design docs dirty — exclude from F13 commit |
| Recommendation | **Done** |

---

## Approval

**Done** — implemented 2026-07-16 after F12 commit.

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-16 | Initial F13 spec: thin runtime + legacy test/code purge |
| 2026-07-16 | **Implemented:** thin tryActivate; removed F08 policy fields/APIs; test rewrite; JSON cleanup; TakeDamage JSON-only |
