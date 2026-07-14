# Active work (agent backlog)

Last updated: 2026-07-14

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: Data-driven cards** — framework gaps ? combat expressiveness ? JSON cards ? equipment/deck.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–12 | CORE-F01–F09, COMBAT-F01–F02, CLI-F02 | GFC depth + GFC combat | **Done** |
| **13** | **CORE-F10** | GFC gaps for JSON cards (Ongoing GE gates, serde) | **Done** ([spec](./Core/CORE-F10-data-driven-gfc-gaps.md)) |
| **14** | **COMBAT-F03** | Describability probes (Vulnerable, buff, mark, …) | **Done** ([spec](./Combat/COMBAT-F03-combat-describability-probes.md)) |
| **15** | **DATA-F01** | Card JSON schema + loader ? starter deck from data | **Done** ([spec](./Data/DATA-F01-card-asset-pipeline.md)) |
| — | **CLI-F01** | ndjson / debug stubs | Planned (parallel, not blocking) |

**Execution rhythm:** Implement Feature ? stop for commit approval ? next Feature. User confirmed three Features back-to-back with one pause per Feature.

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| Equipment + equipment-driven deck | EQUIP-F01 | DATA-F01 |
| Enemy data + AI | COMBAT-F04 | DATA-F01 |
| Dungeon / loot / events | DUNGEON-F01 | Combat + equipment data |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
