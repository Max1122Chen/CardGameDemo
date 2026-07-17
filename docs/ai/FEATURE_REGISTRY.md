# Feature Registry

Last updated: 2026-07-16  
Purpose: single source of truth for `<DOMAIN>-F<nn>` IDs.

**Rules:**

1. Register a row **before** creating Design Spec or using `<DOMAIN>-Fnn` in docs.
2. Pick next free number per DOMAIN (see [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) ?3).
3. Status: `Planned` ? `In Progress` ? `Done` | `Deferred` | `Cancelled`.
4. Do not slice IDs across phases without a row (use `-Snn` in impl docs only).

---

## Active & recent features

| Feature ID | Title | Status | Owner | Design / plan |
|------------|-------|--------|-------|----------------|
| `WF-F01` | Documentation templates and AI collaboration governance | In Progress | ? | [templates/](./templates/), [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) |
| `CORE-F01` | Monorepo scaffold, verify pipeline, code standards | Done | ? | [CORE-F01-monorepo-tooling-logging.md](./Core/CORE-F01-monorepo-tooling-logging.md) |
| `CORE-F02` | GameplayTag Manager, Container, hierarchy matching | Done | ? | [CORE-F02-gameplay-tag.md](./Core/CORE-F02-gameplay-tag.md) |
| `CORE-F03` | GameplayEvent System (tag-channel pub-sub) | Done | ? | [CORE-F03-gameplay-event.md](./Core/CORE-F03-gameplay-event.md) |
| `CORE-F04` | RuleEngine and GameWorld (ECS skeleton) | Done | ? | [CORE-F04-rule-engine-gameworld.md](./Core/CORE-F04-rule-engine-gameworld.md) |
| `CORE-F05` | GameplayFrameworkComponent skeleton (ASC on entity) | Done | ? | [CORE-F05-gfc-skeleton.md](./Core/CORE-F05-gfc-skeleton.md) |
| `CORE-F06` | Attribute (UE-style) + minimal GE on GFC | Done | ? | [CORE-F06-attribute-minimal-ge.md](./Core/CORE-F06-attribute-minimal-ge.md), [gameplay-framework.md](../design/systems/gameplay-framework.md), [attributes.md](../design/systems/attributes.md) |
| `CORE-F07` | Event-driven Duration for GameplayEffect | Done | ? | [CORE-F07-event-driven-duration.md](./Core/CORE-F07-event-driven-duration.md) |
| `CORE-F08` | GameplayAbility framework on GFC (grant, activate, passive) | Done | ? | [CORE-F08-gameplay-ability-framework.md](./Core/CORE-F08-gameplay-ability-framework.md), [gameplay-framework.md](../design/systems/gameplay-framework.md) |
| `CORE-F09` | Staged GE evaluation, Attribute Based magnitudes, EvaluationPipeline | Done | ? | [CORE-F09-numeric-calculation-pipeline.md](./Core/CORE-F09-numeric-calculation-pipeline.md) |
| `CLI-F01` | Host logging sink, ndjson trace output, debug console stubs | Planned | ? | [demo-minimal-feature-set.md](../design/systems/demo-minimal-feature-set.md) |
| `CLI-F02` | Terminal gameplay UI shell with overlays and immediate input | Done | ? | [CLI-F02-terminal-tui.md](./CLI/CLI-F02-terminal-tui.md), [demo-minimal-feature-set.md](../design/systems/demo-minimal-feature-set.md) |
| `CLI-F03` | Host foundation: Enhanced Input IMC/IA, frame buffer, TUI widgets | Done | — | [CLI-F03-host-foundation.md](./CLI/CLI-F03-host-foundation.md) |
| `CLI-F04` | Combat main UI: two-column layout, in-pane stats, field typography | Done | — | [CLI-F04-combat-ui-layout.md](./CLI/CLI-F04-combat-ui-layout.md) |
| `CLI-F05` | Post-combat VICTORY/DEFEAT + loot in Hand pane + inventory top-row | Done | — | [CLI-F05-postcombat-inventory-layout.md](./CLI/CLI-F05-postcombat-inventory-layout.md) |
| `COMBAT-F01` | BattleOnly vertical slice (minimal scenario after CORE-F06) | Done | ? | [COMBAT-F01-minimal-battle-slice.md](./Combat/COMBAT-F01-minimal-battle-slice.md), [combat.md](../design/systems/combat.md) |
| `COMBAT-F02` | GFC-language combat: CORE GA gaps + preview/commit card loop | Done | ? | [COMBAT-F02-gfc-combat-integration.md](./Combat/COMBAT-F02-gfc-combat-integration.md), [combat.md](../design/systems/combat.md) ?????????? |
| `COMBAT-F03` | Combat describability probes (pre?JSON cards) | Done | ? | [COMBAT-F03-combat-describability-probes.md](./Combat/COMBAT-F03-combat-describability-probes.md) |
| `COMBAT-F04` | Combat numeric depth: caps, six stats, damage pipeline, probes | Done | — | [COMBAT-F04-combat-numeric-depth.md](./Combat/COMBAT-F04-combat-numeric-depth.md) |
| `COMBAT-F05` | Data-driven enemies: characters pkg, BT-driven turns, slime+orc spawn | Review | — | [COMBAT-F05-enemy-data-driven.md](./Combat/COMBAT-F05-enemy-data-driven.md) |
| `COMBAT-F06` | Context-aware enemy BT AI (orc tactical, blackboard + Wisdom) | Planned | — | [COMBAT-F06-enemy-bt-ai.md](./Combat/COMBAT-F06-enemy-bt-ai.md) |
| `ITEM-F01` | Item definitions, fragments, inventory, battle loot pickup/discard | Done | — | [ITEM-F01-item-foundation.md](./Items/ITEM-F01-item-foundation.md) |
| `ITEM-F02` | Rectangular grid backpack (4×6), place/move/tidy | Done | — | [ITEM-F02-grid-backpack.md](./Items/ITEM-F02-grid-backpack.md) |
| `EQUIP-F01` | Equipment loadout, equip/unequip, deck injection | Done | — | [EQUIP-F01-equipment-loadout.md](./Equipment/EQUIP-F01-equipment-loadout.md) |
| `CORE-F10` | GFC gaps for data-driven cards (Ongoing GE gates, serde) | Done | — | [CORE-F10-data-driven-gfc-gaps.md](./Core/CORE-F10-data-driven-gfc-gaps.md) |
| `DATA-F01` | Card & effect JSON schema + loader | Done | ? | [DATA-F01-card-asset-pipeline.md](./Data/DATA-F01-card-asset-pipeline.md) |
| `CORE-F11` | Extensible GA activation, SetByCaller, reusable GE/GA assets | Done | — | [CORE-F11-extensible-ga-assets.md](./Core/CORE-F11-extensible-ga-assets.md) |
| `CORE-F12` | Parameterized GA/GE defs, activate hooks, Cost GE, F11 debt polish | Done | — | [CORE-F12-tech-debt-polish.md](./Core/CORE-F12-tech-debt-polish.md) |
| `CORE-F13` | Thin GA runtime (no framework policy) + legacy test/code purge | Done | — | [CORE-F13-thin-ga-runtime.md](./Core/CORE-F13-thin-ga-runtime.md) |
| `CORE-F14` | Behavior tree runtime: JSON assets, tick, blackboard, task registry | Done | — | [CORE-F14-behavior-tree.md](./Core/CORE-F14-behavior-tree.md) |
| `CHAR-F01` | `@cardgame/characters` package: defs, spawn, instances | Done | — | [CHAR-F01-character-package.md](./Characters/CHAR-F01-character-package.md) |

---

## ID allocation by domain (next free)

| DOMAIN | Next Feature # | Notes |
|--------|----------------|-------|
| `WF` | F02 | Workflow / docs |
| `CORE` | F15 | F14 Done |
| `COMBAT` | F07 | F06 Planned |
| `CHAR` | F02 | F01 Done |
| `ITEM` | F03 | F02 Done |
| `EQUIP` | F02 | F01 equipment loadout registered |
| `DUNGEON` | F01 | Map, encounters, loot |
| `DATA` | F02 | F01 card asset pipeline registered |
| `EFFECT` | F01 | May fold into CORE-F06; register if split |
| `ED` | F01 | Visual data editor |
| `CLI` | F05 | F04 combat UI layout Review |
| `UI` | F01 | Simple human UI |
| `TEST` | F01 | Shared sim harness if split from verify |

Update **Next Feature #** when registering a new row.
