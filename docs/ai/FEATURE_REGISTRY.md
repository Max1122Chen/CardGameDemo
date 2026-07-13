# Feature Registry

Last updated: 2026-07-11  
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
| `CORE-F02` | GameplayTag registry, container, hierarchy matching | Planned | — | [gameplay-framework.md](../design/systems/gameplay-framework.md) |
| `CORE-F03` | GameplayEvent bus (tag-typed, payload, sync dispatch) | Planned | — | [gameplay-framework.md](../design/systems/gameplay-framework.md) |
| `CORE-F04` | GFC skeleton (tags, attribute sets, event entry) | Planned | — | [gameplay-framework.md](../design/systems/gameplay-framework.md) |
| `CORE-F05` | Attribute evaluation pipeline + minimal GE (Instant/Duration probe) | Planned | — | [gameplay-framework.md](../design/systems/gameplay-framework.md), [attributes.md](../design/systems/attributes.md) |
| `CLI-F01` | Host logging sink, ndjson trace output, debug console stubs | Planned | — | [demo-minimal-feature-set.md](../design/systems/demo-minimal-feature-set.md) |
| `COMBAT-F01` | BattleOnly vertical slice (minimal scenario after CORE-F05) | Planned | — | [combat.md](../design/systems/combat.md) |

---

## ID allocation by domain (next free)

| DOMAIN | Next Feature # | Notes |
|--------|----------------|-------|
| `WF` | F02 | Workflow / docs |
| `CORE` | F06 | After F05 pipeline probe |
| `COMBAT` | F02 | After F01 battle-only slice |
| `DUNGEON` | F01 | Map, encounters, loot |
| `DATA` | F01 | Schema, asset loading |
| `EFFECT` | F01 | May merge into CORE-F05+; register when split |
| `ED` | F01 | Visual data editor |
| `CLI` | F02 | After F01 host logging |
| `UI` | F01 | Simple human UI |
| `TEST` | F01 | Shared sim harness if split from verify |

Update **Next Feature #** when registering a new row.
