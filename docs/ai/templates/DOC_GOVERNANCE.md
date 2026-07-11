# 文档与协作规范 v1

Last updated: 2026-06-25  
Status: **Active**

---

## 1) 目标

让不了解上下文的读者（含 Agent）能回答：在做什么、做到哪、下一步怎么验收、暂停原因是什么。

---

## 2) 文档类型

| 类型 | 用途 | 典型文件 |
|------|------|----------|
| **Roadmap** | 顺序与优先级 | `*_ROADMAP.md` |
| **Design Spec** | 实现方案（非玩法定稿） | `*_DESIGN.md` |
| **Implementation Plan** | 切片与验收 | `*_IMPLEMENTATION.md` |
| **ADR** | 架构决策 | `ADR-*.md` |
| **Progress Log** | 时间线 | `PROGRESS_LOG.md` |
| **Bug Record** | 缺陷 | `bugs/*.md` |

**玩法设计真源** — [Overview.md](../../design/Overview.md) + [systems/](../../design/systems/)；编辑规则见 [DESIGN_DOC_GOVERNANCE.md](../../design/DESIGN_DOC_GOVERNANCE.md)。

---

## 3) ID 与领域

### 3.1 领域（DOMAIN）

| 代号 | 范围 |
|------|------|
| `WF` | 工程流程、文档、CI |
| `CORE` | 规则引擎、状态、RNG、事件 |
| `COMBAT` | 战斗、卡组、属性 |
| `DUNGEON` | 地牢、遭遇、战利品 |
| `DATA` | Schema、资产加载 |
| `EFFECT` | 效果解释器 |
| `ED` | 可视化编辑器 |
| `CLI` | 控制台、Agent Host |
| `UI` | 简易 UI |
| `TEST` | 测试、模拟 |

### 3.2 Feature / Slice / Bug

- Feature: `<DOMAIN>-F<nn>`
- Slice: `<FeatureID>-S<nn>`
- Bug: `BUG-<DOMAIN>-<nnn>`
- ADR: `ADR-<yyyyMMdd>-<nn>`

登记：[`FEATURE_REGISTRY.md`](../FEATURE_REGISTRY.md)

---

## 4) 长文档 Meta（防失忆）

Design / Roadmap / Implementation / ADR 顶部：

```markdown
## Meta
- **ID:** CORE-F01
- **Status:** Draft | Planned | In Progress | Review | Done | Deferred | Cancelled | Snapshot | Reference
- **Owner:** ...
- **Last updated:** YYYY-MM-DD
- **Related:** [links]

## TL;DR
（3–5 行）

## Scope
- **In:** ...
- **Out:** ...
```

---

## 5) 状态与 Agent 信任

### 5.1 状态机

`Draft → Planned → In Progress → Review → Done`（可 Blocked / Deferred / Cancelled）

### 5.2 Agent doc trust

- **Planning:** ACTIVE_WORK, FEATURE_REGISTRY (In Progress/Planned), TECH_DEBT (Open), user-scoped in-repo design, code/tests
- **Not planning:** unscoped ideas in `docs/design/systems/*`
- **Conflict:** code + tests > stale prose; **gameplay what** > `docs/design/systems/*` > in-repo impl

### 5.3 玩法设计文档

- 入口：`docs/design/Overview.md`；正文：`docs/design/systems/*.md`
- Agent **默认只读**；仅用户明确委托时可改
- 规则：`.cursor/rules/design-doc-governance.mdc`

---

## 6) Bug 流程

1. 复制 `bug-record.template.md`，分配 `BUG-*`
2. 修复后：Root cause、Regression、Status Fixed/Verified

---

## 7) Slice 完成定义（DoD）

### 7.1 文档

| 动作 | 位置 |
|------|------|
| 进展 | `PROGRESS_LOG.md` |
| Design/Plan 勾选 | 对应 `*_DESIGN.md` |
| Registry | `FEATURE_REGISTRY.md` |
| 架构取舍 | ADR |
| 设计文档被改 | Progress 注明路径与摘要（须用户曾明确委托） |

### 7.2 工程

| 检查 | 要求 |
|------|------|
| 验证 | `npm run verify` 或记录的 test/手动步骤 |
| API | 破坏性变更须 Design/ADR |

### 7.3 工作边界

Slice/Feature 完成后 → **提议准备 commit**，再开下一 Feature（用户可说「先不提交」跳过）。

---

## 8) Handoff（§9.1 摘要）

触发：handoff / 交接 / 换会话

1. `sessions/` 笔记
2. `PROGRESS_LOG` 条目
3. 未完成 slice → Blocked + Status note
4. 回复：3–5 行摘要 + 下一会话首句

---

## 9) Agent 协作

- 新工程 Feature：先 Registry → 用户确认 scope → Design ≥ Planned → 代码
- **Draft 设计不得大规模改代码**
- 玩法变更：用户改 `docs/design/systems/*.md`；Agent 实现须等用户点名任务
- Partner + Pre-flight：见 `cardgame-prototype-mentor` skill

---

## 10) 模板

见同目录 `*.template.md` 与 [README](./README.md)。
