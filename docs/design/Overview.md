# CardGameDemo — 玩法设计 Overview

作者：麦克斯大大  
版本：0.3（框架增强版）  
最后更新：2026-07-09

## Meta

- **Status:** Draft
- **Owner:** 麦克斯大大
- **See also:** [DESIGN_DOC_GOVERNANCE.md](./DESIGN_DOC_GOVERNANCE.md)

## TL;DR

CardGameDemo 是一个 Roguelike **装备驱动卡组** 游戏，目标是通过可扩展规则机器快速验证玩法。  
玩法设计分为 `Overview + systems/*`；工程实现与协作放在 `docs/ai/`。  
当前阶段重点是完善 Gameplay Framework、效果结算与可独立运行的调试模式（尤其控制台战斗模式）。

## Design pillars

1. **丰富的随机性** — 地牢、敌人、装备（卡组）、事件每局不同  
2. **丰富的策略选择** — 开局 build、路线、战斗打法、背包与撤离时机  

详见 [vision-and-pillars.md](./systems/vision-and-pillars.md)。

## Core loop（宏观）

```text
局外准备 → 进入地牢（一场冒险）→ 探索（轮/行动力）
    → 遭遇战斗（回合/费用）→ 战利品/背包
    →  deeper 或 携带战利品撤离 → 局外
```

细节与叙述：[core-loop.md](./systems/core-loop.md)  
*（思维导图占位：见 core-loop 文末）*

## 系统索引

| # | 系统 | 文档 | Status | 一句话 |
|---|------|------|--------|--------|
| 1 | 目标体验 | [vision-and-pillars.md](./systems/vision-and-pillars.md) | Draft | 随机性 + 策略深度 |
| 2 | 核心循环 | [core-loop.md](./systems/core-loop.md) | Draft | 地牢↔战斗↔战利品↔撤离 |
| 3 | 属性 | [attributes.md](./systems/attributes.md) | Draft | 基础/派生、中性值、补正 |
| 4 | 物品 | [items.md](./systems/items.md) | Draft | 稀有度、堆叠、背包格子 |
| 5 | 装备与卡牌 | [equipment-and-cards.md](./systems/equipment-and-cards.md) | Draft | 装备即卡组、双持、补正等级 |
| 6 | **效果语义（旧版）** | [effects.md](./systems/effects.md) | Deprecated | 旧语义与规则素材，逐步迁移到 Framework |
| 7 | **Gameplay Framework** | [gameplay-framework.md](./systems/gameplay-framework.md) | Draft | 规则框架、Pipeline、GE/GA/Event、事件系统 |
| 8 | 战斗 | [combat.md](./systems/combat.md) | Draft | 回合循环、先手、NPC 与 AI |
| 9 | 角色与单位 | [character.md](./systems/character.md) | Draft | Character 定义、初始化倾向、探索 AI |
| 10 | 地牢 | [dungeon.md](./systems/dungeon.md) | Draft | 图生成、探索轮、掉落池 |
| 11 | 局外 | [meta-progression.md](./systems/meta-progression.md) | Draft | 准备、配装、携带 |
| 12 | Demo 最终愿景 | [demo-minimal-feature-set.md](./systems/demo-minimal-feature-set.md) | Draft | 本 Demo 的目标能力边界（非首版范围） |

## 推荐阅读顺序

### 设计阶段（通读）

1. 本页 → [vision-and-pillars.md](./systems/vision-and-pillars.md) → [core-loop.md](./systems/core-loop.md)  
2. [gameplay-framework.md](./systems/gameplay-framework.md)（规则引擎核心，优先理解）  
3. [effects.md](./systems/effects.md)（旧版语义/案例库，用于补充规则细节）  
4. [equipment-and-cards.md](./systems/equipment-and-cards.md) + [attributes.md](./systems/attributes.md)  
5. [combat.md](./systems/combat.md) + [character.md](./systems/character.md)  
6. [items.md](./systems/items.md) → [dungeon.md](./systems/dungeon.md)  
7. [meta-progression.md](./systems/meta-progression.md) → [demo-minimal-feature-set.md](./systems/demo-minimal-feature-set.md)

### 准备实现 P0 战斗 / 控制台调试

1. [gameplay-framework.md](./systems/gameplay-framework.md)  
2. [combat.md](./systems/combat.md)  
3. [equipment-and-cards.md](./systems/equipment-and-cards.md)  
4. [attributes.md](./systems/attributes.md)  
5. [effects.md](./systems/effects.md)（仅查旧规则语义与待迁移细节）

### 准备实现地牢（Post-MVP）

1. [dungeon.md](./systems/dungeon.md) + [character.md](./systems/character.md)  
2. [items.md](./systems/items.md) + [core-loop.md](./systems/core-loop.md)

## 文档约定

- **玩法正文：** `docs/design/systems/*.md`（用户主笔；Agent 默认只读）  
- **工程协作：** `docs/ai/`  
- **编辑规则：** [DESIGN_DOC_GOVERNANCE.md](./DESIGN_DOC_GOVERNANCE.md)  
- **旧 monolith：** [卡牌游戏.md](./卡牌游戏.md) 已迁移为 stub，稳定后删除  
- **运行形态约束：** 必须支持完整冒险模式 + 战斗独立模式 + 控制台调试模式（详见 `gameplay-framework` 与 `demo-minimal-feature-set`）  

## Changelog

| 日期 | 变更 |
|------|------|
| 2026-07-09 | 更新索引与阅读顺序；纳入 Gameplay Framework、Character、Demo 愿景与控制台模式约束 |
| 2026-07-04 | 自 `卡牌游戏.md` 拆分为 Overview + systems/* |
| 2026-07-01 | 原 monolith 最后内容更新 |
| 2026-07-03 | 设计迁入本仓库 `docs/design/` |
