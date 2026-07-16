# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase:** CLI-F03 Done — next: EQUIP-F02 / COMBAT-F05 when promoted; UI layout polish deferred.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–22 | … through EQUIP-F01 | Equipment loadout | **Done** |
| 23 | **CLI-F03** | IMC/IA input, frame buffer, ScrollZone auto-tail | **Done** ([spec](./CLI/CLI-F03-host-foundation.md)) |
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
