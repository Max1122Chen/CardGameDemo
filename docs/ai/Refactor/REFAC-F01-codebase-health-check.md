# REFAC-F01 — Codebase health check & consolidation

## Meta
- **ID:** REFAC-F01
- **Status:** In Progress
- **Owner:** —
- **Last updated:** 2026-07-19
- **Related:** [TECH_DEBT.md](../TECH_DEBT.md), [ACTIVE_WORK.md](../ACTIVE_WORK.md)

---

## TL;DR

全仓体检 + P0 完成 + P1 大部分完成。`@cardgame/repo-data` 统一资产加载；删除死伤害 API / 重复 bootstrap / 废弃别名；`EnemyCombatAi` 从 `CombatSession` 抽出。CLI session-controller 与 GFC 拆分仍挂债。

---

## Scope

**In:** 删除死代码/死文件；合并重复加载与伤害路径；收敛过渡 API；合理拆模块。

**Out:** 玩法规则变更；重写 GFC/GA 运行时；编辑器。

---

## Findings（按优先级）

### P0-1 — 重复的 repo 根目录 / JSON 加载 — **Done**
### P0-2 — 战斗伤害死代码 — **Done**
### P0-3 — 卡牌 wire 遗留字段 — **Done**
### P1-1 — Dungeon `visibleRoomIds` — **Done**（legacy grid/exits → TD-REFAC-03）
### P1-2 — CombatSession 拆分 — **Partial**
- Done: `enemy-combat-ai.ts`（BT registry / intent / 出牌）
- Open: preview/snapshot 再拆、GFC 文件体量（TD-REFAC-01）
### P1-3 — Items 废弃 API — **Done**
### P2-1 — CLI session-controller — **Pending**（TD-REFAC-02）
### P2-2 — `splitColumnWidths` — **Done**

---

## Execution order

1. ~~P0 全套~~
2. ~~P1-1 / P1-3 / P2-2~~
3. ~~P1-2 EnemyCombatAi 抽取~~
4. P2 CLI session-controller（下一批）
5. 可选：CombatSession preview/snapshot 再拆

**Verify:** 287 tests green (2026-07-19).

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Health check written; execution started |
| 2026-07-19 | P0 + P1-1/P1-3/P2-2 done |
| 2026-07-19 | Extracted `EnemyCombatAi` from CombatSession |
