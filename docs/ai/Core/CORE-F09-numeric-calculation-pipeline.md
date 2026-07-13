# CORE-F09 — Numeric calculation pipeline (stub)

Status: Planned  
Feature ID: CORE-F09  
Updated: 2026-07-13

Gameplay reference (read-only): [attributes.md](../../design/systems/attributes.md), [gameplay-framework.md](../../design/systems/gameplay-framework.md), [effects.md](../../design/systems/effects.md)

Depends on: CORE-F06, CORE-F07, **CORE-F08**

Blocks: COMBAT-F02

---

## Goal (one paragraph)

Implement **core-side numeric evaluation**: primary attributes, at least **HP derived from Constitution** via Infinite GE on GFC, and a **minimal attacker-side damage pipeline** (stage attributes + recompute). Game design formulas are provisional; purpose is to validate GFC Attribute/GE aggregation before combat wires them.

**Full spec:** write after CORE-F08 is approved / in progress.

---

## Confirmed direction (from user)

- **Derived HP only** for first derivation slice — formula arbitrary (e.g. `Health.base = f(Constitution)`).
- Validation target: **Constitution as base attribute + Infinite GE** drives derived `Health`.
- Attacker computes outgoing damage using pipeline attributes; emits event (integration in COMBAT-F02).

---

## Placeholder slices

| Slice | Deliverable |
|-------|-------------|
| S01 | Primary attribute keys + Constitution → Health derivation GE |
| S02 | Damage stage attributes (minimal subset of effects.md pipeline) |
| S03 | `evaluateOutgoingDamage(attacker, ctx)` helper (pure core, no CombatSession) |
| S04 | Tests + trace |
