# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: ITEM-F01 Done** — next: EQUIP-F01 when promoted.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–19 | … through COMBAT-F04 | Combat numeric depth | **Done** |
| 20 | **ITEM-F01** | Item defs + fragments, 12-slot inventory, static loot, CLI pickup/discard | **Done** ([spec](./Items/ITEM-F01-item-foundation.md)) |
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
