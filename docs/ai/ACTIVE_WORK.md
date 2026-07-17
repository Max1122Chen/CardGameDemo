# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase:** CLI-F04 Done — next: EQUIP-F02 / COMBAT-F05 when promoted; inventory UI later.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–23 | … through CLI-F03 | Host IMC/paint/ScrollZone | **Done** |
| 24 | **CLI-F04** | Two-column combat UI, hand\|log row, in-pane P/E stats | **Done** ([spec](./CLI/CLI-F04-combat-ui-layout.md)) |
| — | **CLI-F01** | ndjson / debug stubs | Planned (parallel) |

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| Equipment wear / dual-wield variants / passives | EQUIP-F02 | EQUIP-F01 |
| Enemy data + AI (JSON catalog) | COMBAT-F05 | COMBAT-F04 |
| Dungeon / loot / events | DUNGEON-F01 | Combat + equipment data |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
