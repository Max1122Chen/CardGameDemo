# DUNGEON-F05 — Multi-level dungeon (descend / evacuate)

## Meta
- **ID:** DUNGEON-F05
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-18
- **Related:** [DUNGEON-F01](./DUNGEON-F01-minimal-level-slice.md)–[F04](./DUNGEON-F04-exploration-fog.md), [dungeon.md](../../design/systems/dungeon.md)
- **Depends on:** DUNGEON-F04 Done

---

## TL;DR

1. **`LevelSession`** — one floor (rename of former `AdventureSession`): map, fog, AP, rounds, combat pause.
2. **`AdventureSession`** — whole run: `runSeed`, level index/count, descend vs evacuate, shared lifecycle bus.
3. Stairs room = existing `kind: exit`. **One action** `LeaveLevel`: non-final → **Descend**; final → **Evacuate** (`LeaveDungeon` + run `victory`).
4. Cross-level: keep player GFC / inventory / loadout (host-owned). Per level: discard map/fog/loot/encounters; AP refill; rounds restart at 1; no return upstairs.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Outer `AdventureSession`, inner `LevelSession` | User 2026-07-18 |
| D2 | Single stairs action (Descend or Evacuate by depth) | User |
| D3 | Fixed small depth (default 2); `runSeed` + `levelIndex` for gen | Partner + user |
| D4 | No BOSS gate; exit room is enough | User |
| D5 | Upper `LevelSession` discarded on descend | User |

---

## API sketch

```text
AdventureSession.startRun({ runSeed, levelCount?, maxExploreAp? })
AdventureSession.start(level) / startFromLevel(level)  — single-floor run (tests / JSON / battle_only)

LeaveLevel @ exit:
  if levelIndex + 1 < levelCount → new LevelSession(seedForLevel)
  else → LeaveDungeon + phase victory
```

Lifecycle: `EnterDungeon` once at run start; per floor `EnterLevel` / `LeaveLevel`; evacuate emits `LeaveDungeon`.

---

## Out of scope

- BOSS distance / BOSS room gate
- Shops / narrative events / return upstairs
- Persisting buffs beyond what host already keeps on the player GFC

---

## 验收

- [x] Rename: level logic in `LevelSession`; run wrapper `AdventureSession`
- [x] Generated multi-level: leave mid → new map + EnterLevel; leave last → victory + LeaveDungeon
- [x] Single-level paths (JSON / battle_only) still evacuate on LeaveLevel
- [x] CLI shows depth; `L` / confirm-leave still one binding
- [x] `npm run verify` green

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Spec + In Progress |
| 2026-07-18 | Done: LevelSession + AdventureSession.startRun, CLI L1/N, 270 tests |
