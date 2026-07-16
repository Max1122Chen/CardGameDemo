# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: COMBAT-F04 (Implemented — await playtest)** — combat numeric depth complete in working tree.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–18 | … through CORE-F13 | Thin runtime + legacy purge | **Done** |
| 19 | **COMBAT-F04** | Max attrs, six stats, damage pipeline, probe deck, CLI stats | **Implemented** ([spec](./Combat/COMBAT-F04-combat-numeric-depth.md)) — await user test |
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
| Equipment + equipment-driven deck | EQUIP-F01 | COMBAT-F04 |
| Enemy data + AI (JSON catalog) | COMBAT-F05 | COMBAT-F04 |
| Dungeon / loot / events | DUNGEON-F01 | Combat + equipment data |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
