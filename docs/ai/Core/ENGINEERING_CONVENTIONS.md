# Engineering conventions (Core)

Last updated: 2026-07-13

Applies to `packages/core` and future framework modules unless a feature spec overrides.

---

## System naming: `Manager` vs `System`

Unless explicitly documented otherwise, a **framework module** (coordinates a domain of state or services) uses:

| Suffix | Use when | Examples (planned / actual) |
|--------|----------|----------------------------|
| **`Manager`** | Owns **registry, lifecycle, lookup**, or **authoritative store** for a resource family | `GameplayTagManager` |
| **`System`** | **Processes**, **dispatches**, or **runs logic** over time/events (pub-sub, tick, pipeline pass) | `GameplayEventSystem` (CORE-F03) |

**Heuristic**

- “Where is X defined / resolved / stored?” → **Manager**
- “Who handles / routes / executes X when something happens?” → **System**

Do **not** shorten type names (`Manager`, `System` alone). Full names: `GameplayTagManager`, not `TagRegistry`.

---

## Gameplay Framework types

Align with [gameplay-framework.md](../../design/systems/gameplay-framework.md) and UE-GAS vocabulary where noted.

| Type | Name | Notes |
|------|------|-------|
| Tag handle | `GameplayTag` | Opaque, registry-backed; not a free string at runtime |
| Tag bag on entity | `GameplayTagContainer` | Mutable container on GFC / entities |
| Tag tree + lookup | `GameplayTagManager` | Singleton per rules context (not `Registry` suffix) |
| Framework host | `GameplayFrameworkComponent` or `Gfc` variable name | CORE-F04 |
| Event record | `GameplayEvent` | `tags` + optional `payload`; no built-in src/target |
| Event router | `GameplayEventSystem` | Channel-partitioned pub-sub (CORE-F03) |
| Event bus label | `GameplayEventChannel` | Wrapper around a `GameplayTag` used as channel name |

---

## Packages and purity

- `@cardgame/core` — no `console`, `fs`, `process`; see CORE-F01 ESLint rules.
- Hosts (`cli`, future `editor`/`ui`) — I/O and logging sinks only.

---

## Tests and probes

- Each `CORE-Fnn` ships a **probe test** proving minimal behavior before the next feature.
- Prefer domain names in test `describe` blocks (`GameplayTagManager`, `GameplayTagContainer`).

---

## Related

- [CORE-F01-monorepo-tooling-logging.md](./CORE-F01-monorepo-tooling-logging.md) — toolchain
- [CORE-F02-gameplay-tag.md](./CORE-F02-gameplay-tag.md) — Tag Manager + Container
