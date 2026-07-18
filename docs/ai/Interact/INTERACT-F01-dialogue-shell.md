# INTERACT-F01 — Dialogue shell + fountain + beggar

## Meta
- **ID:** INTERACT-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-18
- **Related:** [interaction.md](../../design/systems/interaction.md), [DUNGEON-F05](../Dungeon/DUNGEON-F05-multi-level.md)
- **Depends on:** DUNGEON-F05 Done

---

## TL;DR

1. **Interactable** protocol + **Dialogue/Options** session shell (no fat Interaction bag).
2. Samples: **生命之泉** (facility) + **乞丐** (NPC).
3. Explicit interact in explore CLI; host bridge for HP / inventory.

---

## Scope

**In:**
- `Interactable` + `DialogueFrame` / choose → next frame or end
- `InteractionHost` (heal, tryTakeItem, log) — host-owned player state
- Per-room interactable list on `LevelSession`
- Explore actions: `BeginInteract` / `ChooseInteractOption` / `CancelInteract`
- CLI: `i` begin, digits choose, `x` cancel
- Probe/tests: fountain on `start`, beggar on `start`

**Out:**
- d20 / trap, altar, forge, shop, auto-popup on enter, generator quotas
- GameplayEvent broadcast for interact begin/end

---

## 验收

- [x] Same room: fountain + beggar both use one dialogue shell
- [x] Fountain depletes; beggar remembers gift
- [x] CLI interact path works; `npm run verify` green

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Spec + In Progress |
| 2026-07-18 | Done: Interactable + fountain/beggar; CLI `i`/digits/`x`; 273 tests |
