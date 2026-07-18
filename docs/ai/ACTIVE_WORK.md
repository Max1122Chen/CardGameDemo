# Active work (agent backlog)

Last updated: 2026-07-18

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase:** DUNGEON-F02 Done. Next: DUNGEON-F03 (explore round / AP) when promoted.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| — | **DUNGEON-F01** | Level explore↔combat, JSON+generator, virtual BattleOnly room | **Done** ([spec](./Dungeon/DUNGEON-F01-minimal-level-slice.md)) |
| — | **DUNGEON-F02** | Rect rooms, doors, cell position, CLI map, lifecycle stubs | **Done** ([spec](./Dungeon/DUNGEON-F02-spatial-level-gen.md)) |
| 1 | **DUNGEON-F03** | Explore round + AP on door moves | **Planned** |
| 2 | **DUNGEON-F04** | Exploration fog (shapes) | **Planned** |
| 3 | **DUNGEON-F05** | Multi-level descend / evacuate | **Planned** |

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| Equipment wear / dual-wield variants / passives | EQUIP-F02 | EQUIP-F01 |
| Dungeon narrative room events / shops / pools | DUNGEON-F06+ | After F05 |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
