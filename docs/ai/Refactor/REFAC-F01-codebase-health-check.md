# REFAC-F01 — Codebase health check & consolidation

## Meta
- **ID:** REFAC-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-19
- **Related:** [TECH_DEBT.md](../TECH_DEBT.md), [ACTIVE_WORK.md](../ACTIVE_WORK.md)

---

## TL;DR

全仓体检 + P0/P1/P2 执行完毕。共享 `@cardgame/repo-data`；清理 combat 死 API；`EnemyCombatAi` 抽出；CLI `session-controller` 拆为 factory / view-sync / apply-ui-action。剩余可选：GFC 体量、CombatSession preview 再拆（TD-REFAC-01）。

---

## Findings status

| ID | Item | Status |
|----|------|--------|
| P0-1 | `@cardgame/repo-data` + 删 CLI 重复 bootstrap | **Done** |
| P0-2 | 删除死伤害 API / 合并 meta reset | **Done** |
| P0-3 | 卡牌 wire 瘦身 | **Done** |
| P1-1 | 删除 `visibleRoomIds` | **Done** |
| P1-2 | `EnemyCombatAi` 抽取 | **Done**（GFC/preview 可选 → TD-REFAC-01） |
| P1-3 | Items 废弃 API | **Done** |
| P2-1 | CLI session-controller 拆分 | **Done** |
| P2-2 | 删除 `splitColumnWidths` | **Done** |

**Verify:** 287 tests green (2026-07-19).

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Health check written; execution started |
| 2026-07-19 | P0 + P1 + EnemyCombatAi; commit `64dd8d4` |
| 2026-07-19 | CLI session split (types / view-sync / apply-ui-action / factory) |
