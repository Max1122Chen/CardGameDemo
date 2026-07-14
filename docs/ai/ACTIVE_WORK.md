# Active work (agent backlog)

Last updated: 2026-07-13

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: GFC depth** — GA → numeric pipeline → combat integration.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–9 | CORE-F01–F07, CLI-F02, COMBAT-F01 | Foundation + minimal battle | **Done** |
| 10 | **CORE-F08** | GameplayAbility on GFC | **Done** ([spec](./Core/CORE-F08-gameplay-ability-framework.md)) |
| 11 | **CORE-F09** | Staged GE evaluation & Attribute Based magnitudes | **Done** ([spec](./Core/CORE-F09-numeric-calculation-pipeline.md)) |
| 12 | **COMBAT-F02** | Apply GA + pipeline to `CombatSession` | Planned ([stub](./Combat/COMBAT-F02-gfc-combat-integration.md)) |
| — | **CLI-F01** | ndjson / debug stubs | Planned (not blocking F08–F02 chain) |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
