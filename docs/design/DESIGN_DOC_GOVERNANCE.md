# 玩法设计文档 — 编辑规则

Last updated: 2026-07-04

## 真源

| 文件 / 目录 | 角色 |
|-------------|------|
| **[Overview.md](./Overview.md)** | 玩法设计入口：索引、支柱、阅读顺序 |
| **[systems/*.md](./systems/)** | 各系统章节正文（git 追踪历史） |
| **本文件** | 编辑规则与分工 |

**位置：** `docs/design/` — 与 `docs/ai/`（工程协作）分离。

曾用 monolith：`卡牌游戏.md`（现为迁移 stub，计划删除）  
曾用路径：`docs/ai/design/卡牌游戏.md`；外部笔记仓库路径（仅历史参考）

## 所有权

- **玩法正文**由项目维护者（麦克斯大大）主笔与定稿。
- **Agent 默认：只读** — 可阅读 `Overview.md` 与 `systems/*.md`，讨论、起草实现规格 Draft；**不得**擅自修改玩法正文。
- Agent **仅在用户明确委托**时可做最小编辑（注明文件与章节范围）。

完整规则：`.cursor/rules/design-doc-governance.mdc`

## 与 in-repo 文档的分工

| 内容 | 位置 |
|------|------|
| 玩法、机制、数值意图、例子 | `docs/design/Overview.md` + `systems/*.md` |
| 工程协作、进度、Feature ID | `docs/ai/` |
| JSON Schema、规则引擎 TDD | `docs/ai/Core/` 等（实现阶段） |
| 可验收需求 | 未来 `docs/design/REQUIREMENTS.md` 等 |

## 状态

- **Design phase** — 各章 `Meta.Status` 以 Draft 为主；实现以 `docs/ai/ACTIVE_WORK.md` 为准。
