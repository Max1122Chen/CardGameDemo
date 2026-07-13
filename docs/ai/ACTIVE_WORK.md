# Active work (agent backlog)

Last updated: 2026-07-11

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: Framework foundation (code)** — infrastructure before full gameplay; each layer validated with a thin probe test.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1 | **CORE-F01** | Monorepo, TS/tooling, verify, logging trace model | **Done** ([spec](./Core/CORE-F01-monorepo-tooling-logging.md)) |
| 2 | **CORE-F02** | GameplayTag + Container | **Next** |
| 3 | CORE-F03 | GameplayEvent bus | Planned |
| 4 | CORE-F04 | GFC skeleton | Planned |
| 5 | CORE-F05 | Attribute pipeline + minimal GE probe | Planned |
| 6 | CLI-F01 | ndjson host sink + debug console stubs | Planned |
| 7 | COMBAT-F01 | BattleOnly vertical slice | Planned |

- **WF-F01** Documentation & AI collaboration — In Progress (design split landed 2026-07-11; ongoing governance)

---

## Not backlog (until promoted)

- Full GE/GA feature parity with UE-GAS
- Dungeon, equipment editors, UI
- `DATA-F01` schema tooling (after core probes)

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [Overview.md](../design/Overview.md) | Design index |
| [gameplay-framework.md](../design/systems/gameplay-framework.md) | Framework target |
| [demo-minimal-feature-set.md](../design/systems/demo-minimal-feature-set.md) | Demo end-state capabilities |
