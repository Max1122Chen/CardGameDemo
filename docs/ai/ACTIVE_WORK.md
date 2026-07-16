# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: ITEM-F02 Done** — next: EQUIP-F01 when promoted.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–20 | … through ITEM-F01 | Item foundation | **Done** |
| 21 | **ITEM-F02** | 4×6 grid bag, auto/manual place, move, tidy | **Done** ([spec](./Items/ITEM-F02-grid-backpack.md)) |
| — | **CLI-F01** | ndjson / debug stubs | Planned (parallel) |

**Architecture lock (F04 target):**

- HP/AP ceilings = `MaxHealth` / `MaxActionPoints` attrs + AttributeChange clamp.
- Damage = panel base + global attribute correction + pipeline (mult / corr / offset).
- Attribute Bonus grade table = `data/combat/attribute-bonus.json`; cards declare grade + stats only.
- flex **removed**; probe deck replaces strike/defend spam.

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| Equipment + equipment-driven deck | EQUIP-F01 | ITEM-F01 |
| Enemy data + AI (JSON catalog) | COMBAT-F05 | COMBAT-F04 |
| Dungeon / loot / events | DUNGEON-F01 | Combat + equipment data |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
