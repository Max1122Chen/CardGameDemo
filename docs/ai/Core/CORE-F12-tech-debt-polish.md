# CORE-F12 — Parameterized GA/GE defs + Activate hooks (F11 correction)

## Meta
- **ID:** CORE-F12
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-16
- **Related:** [CORE-F11](./CORE-F11-extensible-ga-assets.md), [CORE-F08](./CORE-F08-gameplay-ability-framework.md), [DATA-F01](../Data/DATA-F01-card-asset-pipeline.md)
- **Gameplay (read-only):** [gameplay-framework.md](../../design/systems/gameplay-framework.md)
- **External reference (non-authoritative):** [GASDocumentation](https://github.com/tranek/GASDocumentation) — use for *intent*; this repo only ports what we need

Depends on: CORE-F11 Done (`0ab928c`)

---

## TL;DR

Correct F11 toward **data-first** authoring. Port UE GAS **roles and vocabulary**, not UE **C++/Blueprint subclass mechanics**:

| Concept | Target |
|---------|--------|
| GA content | **Reusable GA Definition assets** + small set of **`activateHookId`** (TS; scripts later) — **not** one TS subclass per card |
| GA config | **Parameter map** (CDO defaults on Def + overrides on card/grant) — Blackboard-like **for ability logic** |
| GE content | **Reusable GE Definition templates** (JSON) — **no GE subclasses** |
| GE params | **SetByCaller** slots in modifiers — **apply-time inputs** filled by caller |
| Wiring | Card/GA **binds** GA parameters → GE SetByCaller when applying effects |
| Activate | Hook code; may **start/stop listens as explicit actions** — not declarative `listenWhileActive` as spine |
| Spec | UE has Specs; **we keep instances + defs** (no Spec layer this Feature) |
| Commit / settle | Inside **activate hook** + listen callbacks — not Session switchboard |
| **Cost** | **Cost GE template** on GA Def + **`checkCost` / `applyCost`** (UE `CommitAbility`) — not `{ attribute, amount }` struct |

**Withdrawn (2026-07-16):** GA/GE TS subclass trees, `abilityClass` per card, full GE class factory, `handlerId` + shared `ga.card.play` if-ladder as end state, **`GameplayAbilityCost` attribute+amount shortcut**.

---

## Parameter model (aligned — authoritative)

Two related but distinct “named value slot” concepts. Same *feel* (expose a hole, caller fills it); different **layer**, **lifetime**, and **consumer**.

### GE SetByCaller — apply-time magnitude interface

**What it is:** A GE Definition declares a modifier magnitude as `{ "kind": "SetByCaller", "key": "Data.Damage" }`. The template does **not** hard-code the number; it exposes an **interface** that the **apply caller** must satisfy.

**Who fills it:** Whoever calls `applyGameplayEffect(def, target, context)` builds `context.setByCaller["Data.Damage"] = <number>` at **runtime, per apply**.

**Who consumes it:** GFC evaluation pipeline resolves magnitudes when the effect is applied.

**Analogy (UE):** EffectSpec / ExecutionContext SetByCaller magnitudes — values supplied when applying an effect from an ability or cue.

```json
{
  "id": "ge.template.damage-face",
  "modifiers": [{
    "attribute": "Damage",
    "op": "Override",
    "magnitude": { "kind": "SetByCaller", "key": "Data.Damage" }
  }]
}
```

### GA parameters — CDO / instance config (Blackboard-like)

**What it is:** A GA Definition (archetype) declares a **parameter schema** with defaults (CDO). Card or grant supplies **overrides**. At load/grant time, values merge into the **ability instance parameter map**.

**Who fills it:** Data files — archetype Def defaults + card `parameters` overrides (equivalent to Blueprint CDO edits).

**Who consumes it:** **Activate hook logic** (branching, targeting, commit rules) and **effect binding** (see below). Parameters are read throughout the ability lifetime, not only at apply.

**Analogy (UE):** Blueprint member variables on the GA class + per-instance overrides — used inside Activate, not only as GE magnitudes.

```json
{
  "id": "ga.archetype.cardPlayPreviewCommit",
  "activateHookId": "combat.cardPlayPreviewCommit",
  "parameters": {
    "Damage": { "type": "number", "default": 0 },
    "ApCost": { "type": "number", "default": 0 }
  }
}
```

Card override:

```json
{
  "id": "strike",
  "abilityRef": "ga.archetype.cardPlayPreviewCommit",
  "parameters": { "Damage": 6 }
}
```

### Binding — connecting GA params to GE SetByCaller

**What it is:** Explicit wiring from ability instance parameters (or runtime-computed values) into `EffectContext.setByCaller` when an effect is applied.

**Where it lives:** Prefer **data** on the GA Def (`effectBindings`) with `$ParameterName` references; hook may also bind imperatively for dynamic cases.

```json
"effectBindings": [
  {
    "defRef": "ge.template.damage-face",
    "target": "selectedEnemy",
    "bind": { "Data.Damage": "$Damage" }
  }
]
```

At apply time the framework/hook resolves `$Damage` → `instance.parameters.Damage` → `setByCaller["Data.Damage"]`.

### Alignment summary

| | GE SetByCaller | GA parameters |
|--|----------------|---------------|
| **Role** | Hole in **effect magnitude** | **Ability instance config** (CDO + overrides) |
| **Declared on** | GE Definition (modifier) | GA Definition (archetype) |
| **Filled when** | Each **applyGameplayEffect** call | **Load/grant** (data merge) |
| **Filled by** | Apply caller (hook / binding resolver) | Card JSON / grant config |
| **Used by** | GE evaluation pipeline | Activate hook, bindings, optional runtime math |
| **Typical key style** | `Data.*` (magnitude namespace) | Short names on GA (`Damage`, `BlockToGain`) |

**Shared rule:** Neither is “magic globals”. Both are **named slots** with explicit declaration and explicit fill. GA parameters often **source** values that **bind into** GE SetByCaller; they are not the same storage.

**F11 transitional note:** Today cards use flat `setByCaller` on the card JSON, which blurs the two layers. F12 migrates to `parameters` on GA + `bind` into GE SetByCaller; card-level `setByCaller` is retired except as legacy during migration.

---

## Cost model — Cost GE + checkCost / applyCost (aligned)

In UE GAS, ability **Cost is not a fixed struct** — it is a **Gameplay Effect class** assigned on the GA (`Cost Gameplay Effect Class`). The GA exposes:

| UE API | Role |
|--------|------|
| `CheckCost` | Can the owner afford this cost **right now**? (no state change) |
| `ApplyCost` | Apply the **Cost GE** to **self** (owner) |
| `CommitAbility` | Convenience: CheckCost + ApplyCost (+ cooldown GE) at a chosen point in Activate |

Cost can deduct AP, Mana, HP, or anything expressible as Instant GE modifiers — same pipeline as other effects.

### Today (F08/F11 — misaligned)

| Layer | Problem |
|-------|---------|
| GA Def | `cost?: { attribute, amount }` — hard-coded attribute + scalar |
| Runtime | `canAffordCost` / `spendCost` bypass GE pipeline; direct `setAttributeBase` |
| Card JSON | Top-level `cost: number` (AP only) |
| CombatSession | Manual `spendActionPointsEffect(def.cost)` on commit — **third** cost path |

We already have `spendActionPointsEffect()` as a GE-shaped helper, but it is **not** wired through GA cost APIs.

### Target (F12)

Cost uses the **same GE template + binding** model as effect bindings:

```json
{
  "id": "ge.template.spend-ap",
  "duration": { "kind": "Instant" },
  "modifiers": [{
    "attribute": "ActionPoints",
    "op": "Add",
    "magnitude": { "kind": "SetByCaller", "key": "Data.Amount" }
  }]
}
```

GA archetype declares cost like any other GE apply:

```json
{
  "id": "ga.archetype.cardPlayPreviewCommit",
  "costEffectRef": "ge.template.spend-ap",
  "costBindings": { "Data.Amount": "$ApCost" },
  "costApplyTiming": "manual",
  "parameters": {
    "ApCost": { "type": "number", "default": 0 },
    "Damage": { "type": "number", "default": 0 }
  }
}
```

Card (authoring sugar — parser may map top-level `cost` → `parameters.ApCost`):

```json
{
  "id": "strike",
  "cost": 1,
  "abilityRef": "ga.archetype.cardPlayPreviewCommit",
  "parameters": { "Damage": 6 }
}
```

### Framework API (core)

On `GameplayAbilityRuntime` / host (names align with UE intent):

| Method | Behavior |
|--------|----------|
| **`checkCost(ctx)`** | Resolve `costEffectRef` + `costBindings` → build cost GE context; evaluate whether apply would succeed (read-only / pipeline check). Used in `canActivate` when timing warrants. |
| **`applyCost(ctx)`** | Apply cost GE to **self** (`instigatorEntityId` / ability owner) with bound SetByCaller. UE `ApplyCost`. |
| **`commitAbility(ctx)`** (optional sugar) | `checkCost` → if ok `applyCost` → return bool. UE `CommitAbility`. |

Hooks call **`applyCost` / `commitAbility` at the correct moment** — not always at Activate start.

### Cost apply timing

| `costApplyTiming` | When framework charges | Card combat example |
|-------------------|------------------------|---------------------|
| **`activate`** (default) | Start of successful `tryActivate` | Instant abilities, passives |
| **`manual`** | Hook calls `applyCost` / `commitAbility` | Preview → TryPlay: cost on **commit**, not preview |

Replaces F08 `chargeCostOnActivate: false` + Session AP checks. Preview activate skips cost; TryPlay callback calls `commitAbility`.

**Rejected as end state:** Session `if (ap < def.cost)` + `spendActionPointsEffect`; GA `cost: { attribute, amount }`.

### Multiple resource types

Same mechanism — different cost GE templates:

| Template | Example use |
|----------|-------------|
| `ge.template.spend-ap` | Card AP |
| `ge.template.spend-hp` | Blood-price skill |
| `ge.template.spend-mana` | Future mana system |

Optional future: generic `ge.template.spend-attribute` with SetByCaller attribute name; F12 MVP: one template per resource is enough.

### Relation to parameters / SetByCaller

Cost is **not a separate parameter system**. It is:

1. A **Cost GE Definition** (template),
2. **`costBindings`** from GA parameters → GE SetByCaller (same `$ApCost` syntax as `effectBindings`),
3. **`checkCost` / `applyCost`** as the GA framework entry points (UE-aligned).

Card top-level `cost` remains **authoring convenience**; normalized to `parameters.ApCost` at parse time so hooks and bindings stay uniform.

---

## Alignment principle (process + product)

**Ideal:** Stay close to UE-GAS *roles* (Ability, Effect, Activate, ASC≈GFC); implement with **data defs + few hooks** because we lack UE’s compile-free Blueprint editor.

| Do | Don’t |
|----|-------|
| Map UE Blueprint Class → **parameterized GA Def + activateHookId** | Map UE Blueprint Class → **TS subclass per card** |
| Map UE GE Definition → **JSON template + SetByCaller** | Map UE GE → **TS Effect subclass per template** |
| Keep a **small set of activate archetypes** (3–5 hooks) | Add a new hook for every card |
| Ownership table + UE-vs-us before coding | Cargo-cult GAS C++ inheritance samples |
| Strike vertical slice before migrating all six cards | Big-bang rewrite without user ack |

### Collaboration fix (reduce misalignment)

1. **Ownership table first** (Activate / listen / commit / apply / bind).
2. **UE-vs-us column** in this doc and slice notes.
3. **One vertical spike** (Strike) reviewed before full migration.
4. **User ack** on this revision before “开始做”.
5. Gameplay *what* in `docs/design/systems/*` (read-only); engineering *how* here.

---

## UE vs us (locked mapping)

| UE | Us (F12) | Omit |
|----|----------|------|
| Blueprint GA class | GA **archetype Def** + `activateHookId` | Per-card TS class |
| Blueprint member vars | GA **`parameters`** (schema + CDO + overrides) | Untyped flat maps |
| C++ `Activate` override | Registered **activate hook** (TS) | Declarative `listenWhileActive` spine |
| GE Definition asset | **`data/effects/*.json`** template | GE subclass tree |
| SetByCaller magnitude | Modifier `{ kind: SetByCaller, key }` | Hard-coded Scalable only for card params |
| Apply GE from Activate | **`effectBindings`** + hook apply | Session `commitPreview` settlement |
| **Cost** | **`costEffectRef` + `costBindings`**; **`checkCost` / `applyCost`** | `cost: { attribute, amount }`; Session `spendActionPointsEffect` |
| **CommitAbility** | Hook calls **`commitAbility()`** on TryPlay | Session AP if-check + manual GE |
| AbilitySpec | **Ability instance** + merged parameters | Full Spec graph |
| Listen in Activate | **`startListen` / `stopListen`** in hook | Framework auto-listen from Def |

---

## Mental model (authoritative)

### Layers

```text
[Framework — packages/core]
  GameplayAbilityRuntime, GFC apply pipeline
  activateHookRegistry (was handlerId registry)
  startListen / stopListen services
  parameter schema merge (CDO + overrides)
  effect binding resolver ($Param → setByCaller)

[Archetype defs — data/abilities/*.json]
  ga.archetype.cardPlayPreviewCommit
  parameters, effectBindings, activateHookId

[GE templates — data/effects/*.json]
  ge.template.damage-face, block-to-gain, vulnerable, …
  SetByCaller keys declare apply-time holes

[Cards — data/cards/*.json]
  abilityRef + parameters overrides
  (optional per-card effectBindings override)

[Combat hooks — packages/combat]
  combat.cardPlayPreviewCommit.ts  ← one hook, many cards
  combat.takeDamage.ts
  … small set, not six card classes
```

### Activate and event listening

**Wrong (F08/F11 spine):** Def declares `listenWhileActive`; framework always attaches listeners.

**Right:**

- Hook invoked on Activate; hook **chooses** when to `startListen` / `stopListen`.
- `endPolicy: manual` — hook ends ability when done.

```text
cardPlayPreviewCommit hook(ctx):
  resolve effectBindings → apply preview GEs (setByCaller filled from instance.parameters)
  handle = startListen(Combat, TryPlay|Cancel)
  on TryPlay → commitAbility() (checkCost + applyCost GE), settle via bindings, sessionBridge, stopListen, endAbility
  on Cancel  → clear preview meta, stopListen, endAbility
```

### Card play ownership

| Step | Owner |
|------|--------|
| Select card + target → `tryActivate` | Session / GFC |
| Load instance parameters (CDO merge) | Framework + data loader |
| Preview GEs | Activate hook (via effectBindings) |
| Subscribe Try/Cancel | Hook (explicit listen) |
| Commit / AP / settle | Hook listen callback; **cost via `applyCost` / `commitAbility`** |
| Discard / log / win check | Narrow Session **bridge** only |

**Rejected:** `Data.CommitMode`, Session `commitPreview` settlement, card JSON `"commit"` field, shared `ga.card.play` if-ladder as end state.

---

## Target data shapes

### GA archetype (`data/abilities/card-play-preview-commit.json`)

```json
{
  "id": "ga.archetype.cardPlayPreviewCommit",
  "kind": "active",
  "activateHookId": "combat.cardPlayPreviewCommit",
  "costEffectRef": "ge.template.spend-ap",
  "costBindings": { "Data.Amount": "$ApCost" },
  "costApplyTiming": "manual",
  "endPolicy": "manual",
  "parameters": {
    "ApCost": { "type": "number", "default": 0 },
    "Damage": { "type": "number" },
    "BlockToGain": { "type": "number" }
  },
  "effectBindings": [
    {
      "when": "preview",
      "defRef": "ge.template.damage-face",
      "target": "selectedEnemy",
      "bind": { "Data.Damage": "$Damage" }
    }
  ]
}
```

### Card (`data/cards/strike.json`)

```json
{
  "id": "strike",
  "name": "Strike",
  "cost": 1,
  "targeting": "single_enemy",
  "abilityRef": "ga.archetype.cardPlayPreviewCommit",
  "parameters": { "Damage": 6 }
}
```

(`cost: 1` parsed → `parameters.ApCost` unless explicitly overridden.)

### GE cost template (`data/effects/spend-ap.json`)

```json
{
  "id": "ge.template.spend-ap",
  "duration": { "kind": "Instant" },
  "modifiers": [{
    "attribute": "ActionPoints",
    "op": "Add",
    "magnitude": { "kind": "SetByCaller", "key": "Data.Amount" }
  }]
}
```

### GE effect template (unchanged pattern)

See `data/effects/damage-face.json` — SetByCaller declares the apply-time hole; binding supplies the value.

### Serialization rules

| Field | Rule |
|-------|------|
| `abilityRef` | Points to GA archetype Def (not per-card class) |
| `parameters` | Card overrides only; must match archetype schema |
| `effectBindings` | On archetype by default; card may extend/override if needed later |
| `costEffectRef` | GE template id for ability cost; optional if ability is free |
| `costBindings` | `$Param` → SetByCaller for cost GE |
| `costApplyTiming` | `activate` \| `manual` — replaces `chargeCostOnActivate` |
| `activateHookId` | On GA Def; registered in combat bootstrap |
| GE `id` | Stable template id; **no `effectClass`** required |

---

## Debt inventory (carry-forward)

| ID | Original debt | F12 resolution |
|----|---------------|----------------|
| D1 | Settlement in `CombatSession.commitPreview` | Hook + listen callback owns commit; Session = bridge |
| D2 | Combat under `packages/core` | `@cardgame/combat`: hooks, loaders, session bridge — **not** card subclass tree |
| D3 | `Data.CommitMode` in card JSON | **Delete**; commit behavior from hook + GA parameters / archetype |
| D4 | Shared CardPlay `if Data.Damage` / `if Block` | **effectBindings** on archetype; hook interprets, no magnitude if-ladder |
| D5 | Dual GE source (JSON + TS factory) | Production **JSON only**; remove or test-only TS template factory |
| D6 | Closed six-literal `CardActionId` | Open `string` + catalog validation |
| D7 | TakeDamage via TS-only factory | **`ga.archetype.takeDamage`** + hook + asset path (same pattern as cards) |
| D8 | Enemy attack hand-rolled damage | Shared `dealDamageToEntity` for hook commit + enemy turn |
| D9 | Registry silent overwrite | Duplicate `register` **throws** (hook registry + effect catalog) |
| D10 | GA `cost: { attribute, amount }` + Session manual AP spend | **Cost GE** on GA Def; **`checkCost` / `applyCost`**; remove `GameplayAbilityCost` + Session `spendActionPointsEffect` path |
| — | Flex Infinite duration | Not debt (user) |
| — | Card `"commit"` field | Cancelled |
| — | Subclass polymorphism / GE class tree | **Withdrawn** — superseded by this doc |
| — | WIP `packages/combat/src/abilities/*Ability.ts` | **Discard or rewrite** to hooks during S01 |

### Forget-me-not checklist

1. Remove `CommitMode` + card `Data.CommitMode`.
2. Split card `setByCaller` → `parameters` (GA) + binding → GE SetByCaller.
3. Replace `GameplayAbilityCost` + `chargeCostOnActivate` → `costEffectRef` + `costApplyTiming` + `checkCost`/`applyCost` (**D10**).
4. Remove Session AP if-check + `spendActionPointsEffect` on commit — hook `commitAbility` only.
5. Remove production `createCombatEffectTemplates()` (D5).
6. Open card ids (D6).
7. Enemy + card share damage helper (D8).
8. `@cardgame/combat` owns hooks/session, not six ability classes (D2).
9. Purge unified `ga.card.play` handler if-ladder and declarative `listenWhileActive` card path.

---

## Scope

### In (architecture — P0)

1. GA **parameter schema** + CDO merge on grant/load.
2. **effectBindings** + **costBindings** resolver (`$Param` → `setByCaller`).
3. **`checkCost` / `applyCost` / `commitAbility`** on ability runtime; Cost GE templates in `data/effects/`.
4. **activateHookRegistry** + `startListen` / `stopListen` usable from hooks.
5. **`cardPlayPreviewCommit`** hook + Strike vertical slice (preview → TryPlay → **commitAbility** → settle).
6. Migrate remaining five cards to archetypes (may share hooks with different parameters/bindings).
7. TakeDamage as archetype + hook (D7).
8. Session bridge only; remove commit settlement switchboard (D1, D3, D4, **D10**).

### In (structural polish — P1)

8. **D2** — `@cardgame/combat` package (hooks, bootstrap, session).
9. **D5** — JSON-only GE load in production.
10. **D6** — Open card ids.
11. **D8** — Shared damage helper.
12. **D9** — Registry duplicate throws.
13. Auto-derive `Card.<id>` tag when missing.
14. Dead-code purge (old handler path, subclass WIP if not adopted).

### Out

- GA/GE TS subclass per card/effect
- UE AbilitySpec/EffectSpec graph
- Net / Prediction / GameplayCue
- Script VM for card Activate (TS hooks only this Feature)
- Card schema `"commit"` field
- Flex Infinite duration change
- EQUIP / enemy data / dungeon Features

---

## Locked decisions (2026-07-16)

| ID | Decision |
|----|----------|
| Content model | **Parameterized defs + hooks** — not subclass polymorphism |
| GE | **JSON templates + SetByCaller** — no GE subclasses |
| GA | **Archetype defs + parameters + activateHookId** — not per-card TS classes |
| Parameters | GA **parameters** (CDO) distinct from GE **SetByCaller** (apply-time); explicit **bind** |
| **Cost** | **Cost GE** + `costBindings`; **`checkCost` / `applyCost`**; card `cost` → `ApCost` param at parse |
| Listen | **Action inside activate hook** — not declarative spine |
| Spec | **Instances + defs** — no Spec type |
| Package | `@cardgame/combat` for hooks and combat host |
| Card.`commit` field | Rejected |
| CommitMode | Rejected — use archetype/hook/parameters |

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **S01** | Parameter schema + merge; binding resolver; **`checkCost`/`applyCost`/`commitAbility`** + `ge.template.spend-ap`; `startListen`/`stopListen`; `cardPlayPreviewCommit` hook; **Strike only**; user review gate |
| **S02** | Remaining five cards; remove CommitMode / Session commit / unified CardPlay if-ladder (**D1,D3,D4**) |
| **S03** | TakeDamage archetype (**D7**); JSON-only GE load (**D5**); purge dual TS templates |
| **S04** | `@cardgame/combat` (**D2**); open card ids (**D6**); shared damage helper (**D8**); registry assert (**D9**) |
| **S05** | Dead-code purge; docs DoD; `npm run verify` green |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Parameter vs SetByCaller confusion | This section + typed schema; bind syntax in data |
| Too many activate hooks | Cap archetypes; shared hooks + different bindings |
| WIP subclass code in `packages/combat` | S01 explicitly deletes or rewrites; do not merge both models |
| Listen lifetime bugs | ListenHandle; `endAbility` always stops listens |
| Alignment drift | Strike gate; ownership table in slice notes |

---

## Exit criteria

- [x] GA archetypes use `parameters` + optional `effectBindings`; cards override via `parameters`
- [x] GE apply fills SetByCaller via binding resolver, not ad-hoc handler if-ladder
- [x] Activate hooks start/stop listens explicitly; no card dependence on `listenWhileActive` spine
- [x] No unified `ga.card.play` if-ladder — three hooks: damage / block / status
- [x] No GE TS subclass tree; production GE from `data/effects/*.json` only (**D5**)
- [x] Cost via **Cost GE** + `applyCost`/`commitAbility`; Session no longer spends AP (**D10**). Legacy `{attribute,amount}` kept only for F08 unit tests.
- [x] Commit/AP in hook via `commitAbility`; no CommitMode / Session settlement switchboard (**D1,D3**)
- [x] Card ids open `string` + catalog validation (**D6**)
- [x] TakeDamage archetype + hook + `data/abilities/take-damage.json` (**D7**)
- [x] Enemy and card share `dealDamageToEntity` (**D8**)
- [x] Duplicate register throws (**D9**)
- [x] `@cardgame/combat` owns combat hooks/session/parse (**D2**)
- [x] F03 + session + CLI tests green (`npm run verify`)
- [x] ACTIVE_WORK / FEATURE_REGISTRY / PROGRESS updated

**Follow-up:** Runtime policy slimming → [CORE-F13](./CORE-F13-thin-ga-runtime.md) (**Done**).

---

## Pre-flight

| Item | Assessment |
|------|------------|
| Context | User ack parameter model + Cost-as-GE + withdraw subclass (2026-07-16) |
| Prerequisites | F11 Done |
| Risk | Medium rewrite; completed in one batch |
| Recommendation | **Done** |

---

## Approval

**Done** — implemented 2026-07-16 after “开始做”.

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-14 | Debt / per-card handler drafts |
| 2026-07-16 | Subclass polymorphism rewrite (superseded same day) |
| 2026-07-16 | Listen = Activate action; full GE tree draft (superseded) |
| 2026-07-16 | **Cost-as-GE:** `costEffectRef`, `checkCost`/`applyCost`/`commitAbility`; D10; withdraw `GameplayAbilityCost` |
| 2026-07-16 | **Final design:** Parameterized GA/GE defs + hooks; GA parameters vs GE SetByCaller alignment; withdraw subclass model |
| 2026-07-16 | **Implemented:** params/bindings/cost GE/hooks; `@cardgame/combat`; six cards migrated; verify green |
