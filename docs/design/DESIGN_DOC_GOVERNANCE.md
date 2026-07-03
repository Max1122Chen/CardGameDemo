# 玩法设计文档 — 编辑规则

Last updated: 2026-07-03

## 真源

| 文件 | 角色 |
|------|------|
| **[卡牌游戏.md](./卡牌游戏.md)** | 玩法设计唯一真源（git 追踪历史） |

**位置：** `docs/design/` — 与 `docs/ai/`（工程协作上下文）分离；玩法设计地位高于 AI 工作流文档。

曾用路径（已弃用）：`docs/ai/design/卡牌游戏.md`  
曾用外部路径（仅历史参考）：`Max1122Chen.github.io/docs/各种笔记和随笔/游戏设计艺术/Idea/卡牌游戏.md`

## 所有权

- **玩法正文**由项目维护者（麦克斯大大）主笔与定稿。
- **Agent 默认：只读** — 可阅读、摘要、讨论、基于文档起草实现规格或需求清单 Draft，**不得**擅自修改 `卡牌游戏.md`。
- Agent **仅在用户明确委托**时可做最小编辑（例如：「帮我在卡牌游戏.md 里改这一处公式」）。

完整规则：`.cursor/rules/design-doc-governance.mdc`

## 与 in-repo 文档的分工

| 内容 | 位置 |
|------|------|
| 玩法、机制、数值意图、例子 | `docs/design/卡牌游戏.md` |
| 工程协作、进度、Feature ID | `docs/ai/` |
| JSON Schema、模块 API、实现计划 | `docs/ai/Core/`、`Combat/`、`Data/` 等（实现阶段） |
| 可验收需求条目 | 未来 `docs/design/REQUIREMENTS.md` 等（用户 Approved 后为准） |

## 状态

- **Design phase** — 设计持续迭代；实现以 `docs/ai/ACTIVE_WORK.md` 中 promote 的任务为准。
