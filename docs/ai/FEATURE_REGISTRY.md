# Feature Registry

Last updated: 2026-07-13  
Purpose: single source of truth for `<DOMAIN>-F<nn>` IDs.

**Rules:**

1. Register a row **before** creating Design Spec or using `<DOMAIN>-Fnn` in docs.
2. Pick next free number per DOMAIN (see [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) §3).
3. Status: `Planned` → `In Progress` → `Done` | `Deferred` | `Cancelled`.
4. Do not slice IDs across phases without a row (use `-Snn` in impl docs only).

---

## Active & recent features

| Feature ID | Title | Status | Owner | Design / plan |
|------------|-------|--------|-------|----------------|
| `WF-F01` | Documentation templates and AI collaboration governance | In Progress | — | [templates/](./templates/), [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) |
| `CORE-F01` | Monorepo scaffold, verify pipeline, code standards | Done | — | [CORE-F01-monorepo-tooling-logging.md](./Core/CORE-F01-monorepo-tooling-logging.md) |
| `CORE-F02` | GameplayTag Manager, Container, hierarchy matching | Done | — | [CORE-F02-gameplay-tag.md](./Core/CORE-F02-gameplay-tag.md) |
| `CORE-F03` | GameplayEvent System (tag-channel pub-sub) | Done | — | [CORE-F03-gameplay-event.md](./Core/CORE-F03-gameplay-event.md) |
| `CORE-F04` | RuleEngine and GameWorld (ECS skeleton) | Done | — | [CORE-F04-rule-engine-gameworld.md](./Core/CORE-F04-rule-engine-gameworld.md) |
| `CORE-F05` | GameplayFrameworkComponent skeleton (ASC on entity) | Done | — | [CORE-F05-gfc-skeleton.md](./Core/CORE-F05-gfc-skeleton.md) |
| `CORE-F06` | Attribute (UE-style) + minimal GE on GFC | Done | — | [CORE-F06-attribute-minimal-ge.md](./Core/CORE-F06-attribute-minimal-ge.md), [gameplay-framework.md](../design/systems/gameplay-framework.md), [attributes.md](../design/systems/attributes.md) |
| `CORE-F07` | Event-driven Duration for GameplayEffect | Done | — | [CORE-F07-event-driven-duration.md](./Core/CORE-F07-event-driven-duration.md) |
| `CORE-F08` | GameplayAbility framework on GFC (grant, activate, passive) | Done | — | [CORE-F08-gameplay-ability-framework.md](./Core/CORE-F08-gameplay-ability-framework.md), [gameplay-framework.md](../design/systems/gameplay-framework.md) |
| `CORE-F09` | Staged GE evaluation, Attribute Based magnitudes, EvaluationPipeline | Done | — | [CORE-F09-numeric-calculation-pipeline.md](./Core/CORE-F09-numeric-calculation-pipeline.md) |
| `CLI-F01` | Host logging sink, ndjson trace output, debug console stubs | Planned | — | [demo-minimal-feature-set.md](../design/systems/demo-minimal-feature-set.md) |
| `CLI-F02` | Terminal gameplay UI shell with overlays and immediate input | Done | — | [CLI-F02-terminal-tui.md](./CLI/CLI-F02-terminal-tui.md), [demo-minimal-feature-set.md](../design/systems/demo-minimal-feature-set.md) |
| `COMBAT-F01` | BattleOnly vertical slice (minimal scenario after CORE-F06) | Done | — | [COMBAT-F01-minimal-battle-slice.md](./Combat/COMBAT-F01-minimal-battle-slice.md), [combat.md](../design/systems/combat.md) |
| `COMBAT-F02` | GFC-language combat: CORE GA gaps + preview/commit card loop | Done | — | [COMBAT-F02-gfc-combat-integration.md](./Combat/COMBAT-F02-gfc-combat-integration.md), [combat.md](../design/systems/combat.md) §出牌、预计算与结算 |

---

## ID allocation by domain (next free)

| DOMAIN | Next Feature # | Notes |
|--------|----------------|-------|
| `WF` | F02 | Workflow / docs |
| `CORE` | F10 | F08 GA, F09 numeric pipeline registered |
| `COMBAT` | F03 | F02 GFC combat integration registered |
| `DUNGEON` | F01 | Map, encounters, loot |
| `DATA` | F01 | Schema, asset loading |
| `EFFECT` | F01 | May fold into CORE-F06; register if split |
| `ED` | F01 | Visual data editor |
| `CLI` | F03 | After F02 terminal TUI |
| `UI` | F01 | Simple human UI |
| `TEST` | F01 | Shared sim harness if split from verify |

Update **Next Feature #** when registering a new row.
