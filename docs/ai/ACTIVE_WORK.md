# Active work (agent backlog)

Last updated: 2026-07-13

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: Framework foundation (code)** — RuleEngine → GFC → Attribute/GE; each layer with probe tests.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1 | **CORE-F01** | Monorepo, verify, trace | **Done** ([spec](./Core/CORE-F01-monorepo-tooling-logging.md)) |
| 2 | **CORE-F02** | `GameplayTagManager` + `GameplayTagContainer` | **Done** ([spec](./Core/CORE-F02-gameplay-tag.md)) |
| 3 | **CORE-F03** | `GameplayEventSystem` | **Done** ([spec](./Core/CORE-F03-gameplay-event.md)) |
| 4 | **CORE-F04** | `RuleEngine` + `GameWorld` (ECS) | **Next — implement** ([spec](./Core/CORE-F04-rule-engine-gameworld.md)) |
| 5 | **CORE-F05** | `GameplayFrameworkComponent` skeleton | Planned ([spec](./Core/CORE-F05-gfc-skeleton.md)) |
| 6 | **CORE-F06** | Attribute + minimal GE (UE-aligned) | Planned |
| 7 | CLI-F01 | ndjson / debug stubs | Planned |
| 8 | COMBAT-F01 | BattleOnly vertical slice | Planned |

- **WF-F01** Documentation & AI collaboration — In Progress

**Conventions:** [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md)

---

## Not backlog (until promoted)

- Full GA activation, equipment wear → passive GA grant
- Dungeon, editors, UI
- `DATA-F01` schema tooling

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [gameplay-framework.md](../design/systems/gameplay-framework.md) | Framework target |
