# CardGameDemo AI 文档索引

本目录供 AI 与开发者共享**工程上下文、实现设计、进度记录**。

**玩法设计真源**（独立于本目录）：[`../design/卡牌游戏.md`](../design/卡牌游戏.md)

## Agent：读哪些文档（必读）

**排期与「还有什么没做」** — 只认：

1. [ACTIVE_WORK.md](./ACTIVE_WORK.md)
2. [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) — 仅 **In Progress** / **Planned**
3. [TECH_DEBT.md](./TECH_DEBT.md) — 仅 **Open**
4. [PROGRESS_LOG.md](./PROGRESS_LOG.md)
5. **代码与测试** — `npm run verify`（就绪后）

规则：`.cursor/rules/docs-trust-tiers.mdc`  
玩法设计：`.cursor/rules/design-doc-governance.mdc`（**默认只读**）

### Planning sources

| 文件 | 用途 |
|------|------|
| [ACTIVE_WORK.md](./ACTIVE_WORK.md) | 短 backlog |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 架构快照 |
| [BOOTSTRAP_DIGEST.md](./BOOTSTRAP_DIGEST.md) | 命令、DoD |
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature ID |
| [../design/卡牌游戏.md](../design/卡牌游戏.md) | 玩法真源（只读） |
| [../design/DESIGN_DOC_GOVERNANCE.md](../design/DESIGN_DOC_GOVERNANCE.md) | 设计文档编辑规则 |

## 布局

| 路径 | 用途 |
|------|------|
| `docs/design/` | 玩法设计（见上） |
| `docs/ai/` 根 | 上下文、进度 |
| `docs/ai/Core/` 等 | 实现向设计 |
| `templates/` | 模板 + [DOC_GOVERNANCE](./templates/DOC_GOVERNANCE.md) |
