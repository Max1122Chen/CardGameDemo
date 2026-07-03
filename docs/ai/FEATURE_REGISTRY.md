# Feature Registry

Last updated: 2026-06-25  
Purpose: single source of truth for `<DOMAIN>-F<nn>` IDs.

**Rules:**

1. Register a row **before** creating Design Spec or using `<DOMAIN>-Fnn` in docs.
2. Pick next free number per DOMAIN (see [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) §3).
3. Status: `Planned` → `In Progress` → `Done` | `Deferred` | `Cancelled`.
4. Do not reuse IDs.

---

## Active & recent features

| Feature ID | Title | Status | Owner | Design / plan |
|------------|-------|--------|-------|----------------|
| `WF-F01` | Documentation templates and AI collaboration governance | In Progress | — | [templates/](./templates/), [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) |

---

## ID allocation by domain (next free)

| DOMAIN | Next Feature # | Notes |
|--------|----------------|-------|
| `WF` | F02 | Workflow / docs |
| `CORE` | F01 | Rules engine, state, RNG |
| `COMBAT` | F01 | Battle loop, deck |
| `DUNGEON` | F01 | Map, encounters, loot |
| `DATA` | F01 | Schema, asset loading |
| `EFFECT` | F01 | Trigger/condition/action interpreter |
| `ED` | F01 | Visual data editor |
| `CLI` | F01 | Console + agent host |
| `UI` | F01 | Simple human UI |
| `TEST` | F01 | Unit tests, sim harness |

Update **Next Feature #** when registering a new row.
