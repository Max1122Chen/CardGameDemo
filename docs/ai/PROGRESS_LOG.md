# CardGameDemo Progress Log (for AI)

Last updated: 2026-07-16

## Purpose

AI-oriented timeline of **what landed in the repo**. Not a full changelog. Append new entries at the top of **Recent entries**.

---

## Recent entries

### 2026-07-16 — CORE-F12 implemented: parameterized defs + Cost GE + @cardgame/combat

- **Shipped:** GA `parameters` / `effectBindings` / `costEffectRef`; `checkCost`/`applyCost`/`commitAbility`; hook `startListen`; three card-play hooks + TakeDamage archetype; `dealDamageToEntity`; open `CardId`; combat moved to `@cardgame/combat`.
- **Data:** `data/abilities/card-play-{damage,block,status}.json`, `take-damage.json`, `data/effects/spend-ap.json`; cards use `parameters` (no CommitMode).
- **Verify:** typecheck + 134 tests + lint green.
- **Spec:** [CORE-F12-tech-debt-polish.md](./Core/CORE-F12-tech-debt-polish.md) → Done.

### 2026-07-16 — CORE-F12: parameterized defs + hooks (subclass model withdrawn)

- **Model:** GA archetype Defs + `parameters` (CDO) + `effectBindings`; GE JSON templates + SetByCaller; small `activateHookId` set — **not** per-card TS subclasses.
- **Parameters:** GA parameters (config, Blackboard-like) vs GE SetByCaller (apply-time magnitude holes); explicit bind `$Param` → `Data.*`.
- **Cost:** Cost GE + `checkCost`/`applyCost`/`commitAbility` (UE-aligned); D10.
- **Spec:** [CORE-F12-tech-debt-polish.md](./Core/CORE-F12-tech-debt-polish.md) rewritten; ACTIVE_WORK aligned.

### 2026-07-16 — CORE-F12: listen-as-Activate-action + full GE tree

- *(Superseded by parameterized defs revision same day.)*

### 2026-07-16 — CORE-F12 redesign: GA/GE subclass polymorphism

- **Model:** Framework GA/GE = bases; cards/statuses = subclasses with virtual overrides (UE-like).
- **Demote:** Freestanding `handlerId` registry and shared `ga.card.play` as end state.
- **Spec:** [CORE-F12-tech-debt-polish.md](./Core/CORE-F12-tech-debt-polish.md); superseded in part by listen-action revision same day.

### 2026-07-14 — CORE-F12 redesign: per-card GA owns commit

- *(Superseded by 2026-07-16 subclass polymorphism rewrite.)*

### 2026-07-14 — CORE-F11: Activation registry, SetByCaller, reusable assets

- **Goal:** UE-aligned Activate (app TS handlers), full SetByCaller, thin card JSON via abilityRef/effectRef.
- **Main changes:** `AbilityActivationRegistry`; CardPlay + TakeDamage handlers; `data/abilities` + `data/effects`; six cards thin + CommitMode; removed builtinActivation / card settle flags.
- **Verify:** 136 tests green.

### 2026-07-14 — DATA-F01: card JSON assets + parse pipeline

- **Goal:** Load CardDefinition graphs from `data/cards/*.json`; bootstrap combat from data.
- **Main changes:** `parseCardDefinition` / `buildCardCatalog`; six card JSON files + `data/decks/starter.json`; CLI fs loader; removed TS card factories; CombatSession requires injected catalog + deck.
- **Verify:** 131 tests green.

### 2026-07-14 — COMBAT-F03: CardDefinition probes + expanded starter deck

- **Goal:** Prove GFC expressiveness before JSON migration.
- **Main changes:** Weaken/Flex/Wait probes; `commitEffects`; expanded starter deck; CLI manual probes OK.
- **Verify:** 124 tests green.

### 2026-07-14 — CORE-F10: GE stacking, ongoing gates, TakeDamage GA, timing

- **Goal:** Close GFC gaps for data-driven cards.
- **Main changes:** Ongoing source/target gates; `byEffectId` duration stacking; wire parse; `Timing.TurnEnd`; TakeDamage GA; combat uses `tryActivate`.
- **Verify:** 118 tests green.

### 2026-07-14 - Design Review: CORE-F10 / COMBAT-F03 / DATA-F01

- **Specs:** Expanded to Review-ready design docs (slices, stance, exit criteria, open Qs).
- **Rhythm:** Implement 3 Features back-to-back; one commit pause per Feature after approval.
- **Blocked on:** User board Q1-Q8 (or as-recommended).

### 2026-07-14 ? Roadmap: data-driven cards phase registered

- **Registered:** CORE-F10, COMBAT-F03, DATA-F01 (Planned); ACTIVE_WORK phase updated.
- **Order:** CORE-F10 ? COMBAT-F03 ? DATA-F01 ? EQUIP / enemies / dungeon.
- **Next:** Start CORE-F10 when user scopes implementation (F03-S01 optional spike in parallel).

### 2026-07-14 ? COMBAT-F02: GFC combat + CLI full preview UX

- **Goal:** Full select?preview meta?cancel/commit loop in terminal battle.
- **Main changes:** CombatSnapshot.preview; CLI refresh on select; show DamageToTake/BlockToGain; Esc/x cancel.
- **Verify:** 113 tests green.

### 2026-07-14 ? COMBAT-F02-A: stay-Active GA + listenWhileActive

- **Goal:** UE-aligned GA listening on Active instances; endPolicy manual; F08 passive shim kept.
- **Main changes:** endPolicy, listenWhileActive, chargeCostOnActivate, autoActivateOnGrant, onActiveAbilityEvent.
- **Next:** Track B Strike preview/commit

### 2026-07-14 ? COMBAT-F02 spec: GFC combat + CORE gap track

- **Goal:** Evolve combat numerics from F01 functions to GFC language; split Track A (CORE GA lifecycle/listen) vs Track B (preview/commit cards).
- **Gameplay:** Extended [combat.md](../design/systems/combat.md) ?????????? (card GA ? play action; TryPlayCard/CancelPlayCard).
- **Impl doc:** [COMBAT-F02-gfc-combat-integration.md](./Combat/COMBAT-F02-gfc-combat-integration.md) Status Review
- **GA correction:** Listening is Active-instance capability; passive ? grant then auto-Activate (UE-aligned).
- **Next:** Implement A01 stay-Active + listen-on-Activate

### 2026-07-14 ? CORE-F09: staged GE evaluation pipeline

- **Goal:** Generic GE evaluation ? Attribute Based magnitudes, GE ctx, EvaluationPipeline per character/attribute.
- **Main changes:** ttribute-evaluation.ts, GFC pipeline binding, GameplayEffectApplicationContext, 11 probe tests (106 total green).
- **Decisions:** Q1 throw on missing src/tgt; Q2 unknown stage ? unstaged + warning; Q3 snapshot ctx + live attribute reads; D19 same-entity dependent invalidation.
- **Next:** COMBAT-F02 spec / GFC combat integration.

### 2026-07-13 ? CORE-F09 spec: staged GE evaluation pipeline

- **Goal:** Generic GE evaluation ? Attribute Based magnitudes, GE ctx, EvaluationPipeline per character/attribute.
- **Main changes:** [CORE-F09-numeric-calculation-pipeline.md](./Core/CORE-F09-numeric-calculation-pipeline.md) (Review)
- **Aligned with:** gameplay-framework.md ?AttributeEvaluationPipeline + user decisions (no meta attr, no evaluateOutgoingDamage, Multiply *=)
- **Next step:** User review Q1?Q3 ? implement S01

### 2026-07-13 ? CORE-F08: GameplayAbility framework on GFC

- **Goal:** Typed GA grant/activate/passive on GFC; cost check; owner/source/target tag gates.
- **Main changes:** `packages/core/src/ga/*`, GFC integration, `ga.*` trace kinds, 8 GA tests
- **Verify:** `npm run verify` ? 95 tests green
- **Next step:** CORE-F09 numeric pipeline (Constitution ? HP derivation)

### 2026-07-13 ? CORE-F08 spec + F09/F02 registration (GFC depth chain)

- **Goal:** Three-feature split ? GA (core), numeric pipeline (core), combat integration (combat).
- **Main changes:**
  - [CORE-F08-gameplay-ability-framework.md](./Core/CORE-F08-gameplay-ability-framework.md) (Review)
  - Stubs: [CORE-F09](./Core/CORE-F09-numeric-calculation-pipeline.md), [COMBAT-F02](./Combat/COMBAT-F02-gfc-combat-integration.md)
  - User model: attacker evaluates damage ? damage event ? target DealDamage passive GA
- **Next step:** User approves CORE-F08 + answers Q1?Q6 ? implement S01

### 2026-07-13 ? COMBAT-F01: minimal battle rules slice implemented

- **Goal:** Closed-loop battle in `packages/core` + playable via CLI TUI.
- **Main changes:**
  - `CombatSession` with deck/hand/discard, AP, Strike/Defend/Bash, Slime AI, win/lose
  - Combat events on `Combat` channel + combat trace kinds
  - CLI wired to `legalActions` / `applyAction`; `E` ends turn
- **Verify:** `npm run verify` ? 87 tests green
- **Next step:** CLI-F01 ndjson/debug stubs or COMBAT-F02 polish

### 2026-07-13 ? COMBAT-F01 spec: minimal battle-only rules slice

- **Goal:** Define P0 combat rules machine scope for GFC validation (turn loop, deck, CardAction, fixed enemy AI).
- **Main changes:** [COMBAT-F01-minimal-battle-slice.md](./Combat/COMBAT-F01-minimal-battle-slice.md)
- **Next step:** User review ? implement S01?S04 after approval

### 2026-07-13 ? CLI-F02 terminal gameplay UI shell

- **Goal:** Terminal-first host with immediate key feedback, overlays, and in-game debug console.
- **Main changes:**
  - `@cardgame/cli` app shell with raw keypress routing, frame renderer, and session controller
  - Runtime modes: `battle`, `debug`, and existing `trace`
  - Global shortcuts: `Esc` settings, `B` inventory, `` ` `` console, immediate hand/enemy navigation
  - Console overlay commands: `help`, `state`, `trace`, `event`, `attr`
  - Spec: [CLI-F02-terminal-tui.md](./CLI/CLI-F02-terminal-tui.md)
- **Validation done:** `npm run verify` (69 tests)
- **Next step:** COMBAT-F01 battle-only vertical slice

### 2026-07-13 ? CORE-F06/F07 implementation: Attribute, GE, event-driven Duration

- **Goal:** Finish the first usable GFC gameplay-state layer with UE-style attributes, minimal GE lifecycle, and event-driven duration.
- **Main changes:**
  - `GameplayFrameworkComponent` now supports attribute base/current state, `Instant` / `Infinite` / `Duration` GE, granted tags, active effect storage, and duration-driven channel subscriptions
  - New exported gameplay types for attributes/effects/duration snapshots
  - New trace kinds for attribute recompute, GE apply/remove, duration progress/expire, and GFC channel subscribe/unsubscribe
  - Probe tests expanded to cover F06/F07 behavior
- **Validation done:** `npm run verify` (55 tests)
- **Next step:** CLI-F01 host logging/debug stubs, then COMBAT-F01 battle-only vertical slice

### 2026-07-13 ? CORE-F06/F07 specs: Attribute/GE + event-driven Duration

- **Goal:** Lock down F06 Attribute + minimal GE, and F07 event-driven Duration model (unitTag-driven).
- **Main changes:** Spec docs:
  - [CORE-F06-attribute-minimal-ge.md](./Core/CORE-F06-attribute-minimal-ge.md)
  - [CORE-F07-event-driven-duration.md](./Core/CORE-F07-event-driven-duration.md)
- **Next step:** Implement CORE-F06 in `@cardgame/core` + probe tests; then move to CORE-F07.

### 2026-07-13 ? CORE-F04/F05 RuleEngine, GameWorld, GFC skeleton

- **Goal:** Session root + ECS; ASC-shaped GFC per entity.
- **Main changes:** `RuleEngine`, `GameWorld`, `GameplayFrameworkComponent`, probe tests (48 total).
- **Validation done:** `npm run verify`
- **Next step:** CORE-F06 Attribute + GE

### 2026-07-13 ? CORE-F03 GameplayEventSystem

- **Goal:** Tag-labeled channel pub-sub; unrestricted event tags; optional payload only.
- **Main changes:**
  - `GameplayEventSystem`, `GameplayEvent`, `GameplayEventChannel`, `createGameplayEvent`
  - Default channel `Channel.Default`; explicit channel isolation
  - Listener filters, priority, re-entrancy depth guard
  - Trace kind `event.dispatch`
  - Spec: [CORE-F03-gameplay-event.md](./Core/CORE-F03-gameplay-event.md)
- **Validation done:** `npm run verify` (30 tests)
- **Next step:** CORE-F04 GFC skeleton

### 2026-07-13 ? CORE-F02 GameplayTag Manager and Container

- **Goal:** UE-aligned hierarchical tags with Manager/Container and trace integration.
- **Main changes:**
  - `GameplayTagManager`, `GameplayTagContainer`, `NATIVE_GAMEPLAY_TAGS`
  - Native + JSON merge (`data/tags.json`, fixtures); strict unknown tag errors
  - Trace kinds `tag.add` / `tag.remove`
  - Engineering conventions doc (Manager/System naming)
  - Spec: [CORE-F02-gameplay-tag.md](./Core/CORE-F02-gameplay-tag.md)
- **Validation done:** `npm run verify` (20 tests)
- **Next step:** CORE-F03 GameplayEventSystem

### 2026-07-11 ? CORE-F01 monorepo + trace scaffold

- **Goal:** npm workspaces, verify gate, structured trace model in core, CLI ndjson output.
- **Main changes:**
  - `packages/core` ? `TraceBuffer`, `NoopTraceSink`, `GameTraceEntry` kinds
  - `packages/cli` ? `--trace ndjson|off`, `--seed`, `--scenario` stub session
  - Root toolchain: TypeScript project refs, Vitest, ESLint 9, Prettier
  - Spec: [CORE-F01-monorepo-tooling-logging.md](./Core/CORE-F01-monorepo-tooling-logging.md)
- **Validation done:** `npm run verify`; `npm run start -w @cardgame/cli -- --trace ndjson --seed 42 --scenario probe`
- **Next step:** CORE-F02 GameplayTag

### 2026-07-11 ? Design systems split + gameplay framework vision (WF-F01)

- **Goal:** Replace monolith with book-style design docs; document rules framework and Demo target capabilities.
- **Main changes:**
  - `docs/design/Overview.md` + `docs/design/systems/*` (combat, dungeon, equipment, attributes, character, etc.)
  - `gameplay-framework.md` ? GAS-inspired pipeline, design constraints, open questions
  - `demo-minimal-feature-set.md` ? final Demo vision (multi-mode, console, battle-only)
  - `effects.md` ? Deprecated; `game-rule-specification.md` stub added
  - `????.md` ? migration stub; rules/skills/docs/ai references updated
- **Validation done:** N/A (docs only)
- **Next step:** Discuss and scope first code slice (likely battle-only + core framework)

### 2026-07-04 ? Split gameplay design into Overview + systems (WF-F01)

- **Goal:** Replace monolith `????.md` with book-style layout.
- **Main changes:**
  - Added `docs/design/Overview.md`, `docs/design/systems/*.md` (10 chapters, content migrated)
  - `????.md` ? migration stub
  - Updated rules, skills, docs/ai references
- **Next step:** User refines chapters; formalize effects spec; rule engine design

### 2026-07-03 ? Design doc layout + initial repo (WF-F01)

- **Goal:** Move gameplay design to `docs/design/`; prepare initial commit.
- **Main changes:** `docs/design/????.md`, governance, Cursor rules/skills, `docs/ai` workflow
- **Next step:** Formalize spec sections; rule engine design

### 2026-07-03 ? Migrate gameplay design into repo (WF-F01)

- **Goal:** `????.md` as in-repo source of truth; remove external pointer; keep agent read-only policy.
- **Main changes:**
  - Added `docs/ai/design/????.md` (from external copy, 2026-07-01)
  - Added `DESIGN_DOC_GOVERNANCE.md`; removed `GAME_DESIGN_POINTER.md`
  - Replaced `external-design-governance.mdc` ? `design-doc-governance.mdc`; updated all references
- **Next step:** User continues design iteration; agent helps with effect-system guidance when asked

### 2026-06-25 ? AI collaboration infrastructure (WF-F01-S01)

- **Goal:** Port minEngine-style docs/ai + Cursor rules/skills; external design pointer; no gameplay implementation yet.
- **Main changes:**
  - `.cursor/rules/` ? session bootstrap, hard constraints, trust tiers, workflow triggers, external design governance, docs layout
  - `.cursor/skills/` ? `cardgame-prototype-mentor`, `git-commit-mentor`
  - `docs/ai/` ? PROJECT_CONTEXT, ACTIVE_WORK, BOOTSTRAP_DIGEST, FEATURE_REGISTRY, templates, GAME_DESIGN_POINTER
- **Docs:** this log, WORKING_WITH_AI, README
- **Validation done:** N/A (docs/rules only)
- **Next step:** User continues external gameplay design; promote tasks in ACTIVE_WORK when ready for code

---

## Timeline summary (high level)

1. **2026-06-25 ? Workflow foundation**
   - Established human?AI collaboration skeleton adapted from minEngine.
   - Gameplay design stays external; agents read-only by default.
