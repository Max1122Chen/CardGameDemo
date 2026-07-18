# INTERACT-F02 — Content expansion (compressed)

## Meta
- **ID:** INTERACT-F02
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-18
- **Related:** [INTERACT-F01](./INTERACT-F01-dialogue-shell.md), [interaction.md](../../design/systems/interaction.md), [random.md](../../design/systems/random.md)
- **Depends on:** INTERACT-F01 Done

---

## TL;DR

1. **d20 check helper** (normal / advantage / disadvantage; nat 1 fail / nat 20 success; modifier).
2. **Trap** script Interactable using the check.
3. **Blood altar** + **abandoned forge** facility samples.
4. Mount samples on `level.probe` rooms; generated runs get a start-room fountain stub.
5. Still explicit `i` interact (no enter-room auto popup).

---

## Scope

**In:**
- `rollD20Check` pure helper + `InteractionHost.nextRandom` / `damage` / `tryGiveItem` / `getCheckModifier`
- Trap, blood altar, forge (English copy)
- Probe: start fountain+beggar; hall_a trap; hall_b altar; exit forge
- Generated dungeon: fountain on start room when no custom interactables

**Out:**
- Shop UI, NPC AI, rest events, full JSON wire schema for interactables

---

## 验收

- [x] d20 nat1/nat20 + advantage/disadvantage covered by tests
- [x] Trap uses dex check; altar/forge work via same shell
- [x] Probe rooms mount samples; `npm run verify` green

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Planned (compressed) |
| 2026-07-18 | In Progress |
| 2026-07-18 | Done |
