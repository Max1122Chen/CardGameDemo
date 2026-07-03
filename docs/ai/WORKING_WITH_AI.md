# Working With AI in CardGameDemo

Last updated: 2026-07-03

## Why this exists

Keep AI-readable context in `docs/ai/`. **Gameplay design** lives separately in [../design/卡牌游戏.md](../design/卡牌游戏.md).

## Minimal workflow

### 1) Before coding

- Agent reads `PROJECT_CONTEXT`, `PROGRESS_LOG`, `ACTIVE_WORK`, `BOOTSTRAP_DIGEST`
- Gameplay rules: [../design/卡牌游戏.md](../design/卡牌游戏.md)

### 2) During work

- Register new Features in `FEATURE_REGISTRY`
- **准备 commit** = draft + your approval
- Agent **does not** edit `docs/design/卡牌游戏.md` unless you explicitly ask

### 3) End of session

- Append `PROGRESS_LOG`; complex tasks → `sessions/`

## Suggested prompts

**Design phase:**

```text
继续 CardGameDemo。读 ACTIVE_WORK 和 docs/design/卡牌游戏.md。
不要写代码，讨论机制/效果系统。
```

**Implementation (when ready):**

```text
ACTIVE_WORK 里 CORE-F01 可以做了。玩法以 docs/design/卡牌游戏.md 为准。
```

See [../design/DESIGN_DOC_GOVERNANCE.md](../design/DESIGN_DOC_GOVERNANCE.md).
