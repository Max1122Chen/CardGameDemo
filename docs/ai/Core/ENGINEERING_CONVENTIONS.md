# Engineering conventions (Core)

Last updated: 2026-07-13

Applies to `packages/core` and future framework modules unless a feature spec overrides.

---

## Naming: `RuleEngine` and avoiding `Rule*`

| Name | Use |
|------|-----|
| **`RuleEngine`** | Root of one rules simulation instance (BattleOnly, debug session). **Only** prominent `Rule*` type. |
| **`GameWorld`** | ECS entity/component store owned by RuleEngine. **Not** `RuleWorld`. |
| **`EntityId`** | Opaque string entity handle in GameWorld. |
| **`Gameplay*`** | Framework types (Tag, Event, GFC, …). |
| **Avoid** | `RuleWorld`, `RuleContext`, `RuleEntity`, etc. unless literally naming the rules layer |

Variable shorthand: `engine` for RuleEngine, `world` for GameWorld, `gfc` for GameplayFrameworkComponent.

---

## System naming: `Manager` vs `System`

| Suffix | Use when | Examples |
|--------|----------|----------|
| **`Manager`** | Registry, lifecycle, lookup | `GameplayTagManager` |
| **`System`** | Dispatch, process, tick | `GameplayEventSystem` |

---

## Gameplay Framework types

| Type | Name | Notes |
|------|------|-------|
| Simulation root | `RuleEngine` | CORE-F04 |
| ECS world | `GameWorld` | CORE-F04 |
| Tag handle | `GameplayTag` | F02 |
| Tag bag | `GameplayTagContainer` | On GFC |
| Tag tree | `GameplayTagManager` | Per engine |
| Framework host | `GameplayFrameworkComponent` | **One per entity** (UE ASC); CORE-F05 |
| Event record | `GameplayEvent` | F03 |
| Event router | `GameplayEventSystem` | F03 |
| Channel label | `GameplayEventChannel` | Tag wrapper |

**GFC is not split** into Tag/Attribute components — single component aligned with UE ASC.

---

## Packages and purity

- `@cardgame/core` — no `console`, `fs`, `process` in library code.
- Hosts (`cli`, …) — I/O only.

---

## Tests and probes

- Each `CORE-Fnn` ships probe tests before the next feature.

---

## Related

- [CORE-F04-rule-engine-gameworld.md](./CORE-F04-rule-engine-gameworld.md)
- [CORE-F05-gfc-skeleton.md](./CORE-F05-gfc-skeleton.md)
