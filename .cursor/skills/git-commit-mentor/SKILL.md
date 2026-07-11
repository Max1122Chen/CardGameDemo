---
name: git-commit-mentor
description: "Prepare high-quality commit messages for CardGameDemo. Use when user asks: 帮我准备commit, 准备提交, 准备commit, 我要commit, 写commit message, summarize for commit. Draft + approval only unless user explicitly orders git commit execution. Doc DoD gate before draft. Never commit without explicit post-draft approval."
---

# Git Commit Mentor

## Purpose

Prepare accurate, reviewable commit messages matching Conventional Commits.

**Proactive offer:** After a finished slice/batch, offer 准备 commit — see `cardgame-prototype-mentor` § Work boundary.

## Intent recognition (mandatory)

**Prepare ≠ execute.** Default for 准备 / 我要 commit = draft only.

Run `git commit` only after user clearly approves draft and asks to execute (e.g. 用这个提交、执行 commit).

## Doc DoD gate (before draft)

| Check | Question |
|-------|----------|
| Registry | `FEATURE_REGISTRY.md` row fits (or N/A chore)? |
| Feature/Slice | Maps to `<DOMAIN>-Fnn` / `-Snn` (traceability only)? |
| Design / Plan | In-repo impl doc updated if applicable? |
| Progress | `PROGRESS_LOG.md` entry? |
| Engineering | Build/test/verify recorded? |
| Design docs | If `docs/design/systems/*.md` touched with user permission — noted in Progress? |

Output: **DoD: pass** or **DoD: gaps —** list.

## Required workflow

1. Doc DoD gate
2. Inspect diffs; draft from actual changes
3. 1–2 subject options + full body
4. **Wait for approval**
5. Execute only if explicitly approved

## Commit message format

```text
<type>(<scope>): <short summary>
- <change 1>
- <change 2>
```

Types: feat | fix | refactor | docs | chore

- Subject/body = **plain language**, not Feature IDs as primary label
- Optional footnote: `Refs: WF-F01-S01`

## Approval prompt

「这是 commit message 草稿 + Doc DoD 检查结果。请确认；**只有你明确说可以提交后**，我才会运行 `git commit`。」

## Common pitfalls

- Treating 准备 commit as execute permission
- Using slice IDs without explaining what changed
- Committing edits to gameplay design docs without user having explicitly requested them
