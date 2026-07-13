# CORE-F01 — Monorepo, tooling, and logging

## Meta

- **ID:** CORE-F01
- **Status:** Done
- **Owner:** 麦克斯大大
- **Last updated:** 2026-07-11
- **Related:** [ACTIVE_WORK.md](../ACTIVE_WORK.md), [gameplay-framework.md](../../design/systems/gameplay-framework.md), [demo-minimal-feature-set.md](../../design/systems/demo-minimal-feature-set.md)

> **Agent:** Implementation design only. Gameplay rules → `docs/design/systems/` (user-owned).

## TL;DR

npm workspaces monorepo with `@cardgame/core` (pure logic) and `@cardgame/cli` (host). TypeScript strict + ESLint + Prettier + Vitest. **Trace model lives in core** (zero log-library deps); **ndjson output lives in cli**. Process errors use `console.error` until CLI grows. Node ≥ 20 LTS.

---

## Scope

### In

- Repository layout and package boundaries for Phase 0 foundation
- Toolchain: TypeScript project references, verify script, lint/format/test
- Logging architecture: trace types, collector, host sink
- Recorded decisions (this doc) for later review

### Out (later features)

- GameplayTag / Event / GFC implementation → CORE-F02–F05
- Battle loop → COMBAT-F01
- `packages/data`, `editor`, `ui`
- Trace embedded in serializable `GameState` snapshot → CORE-F05 probe or COMBAT-F01
- pino / file transports / log rotation
- CI workflow files (optional follow-up)

---

## Context

CardGameDemo is a **rules machine** MVP: console- and agent-first, seeded replay, structured observability. Hard constraint: **`packages/core` must not depend on DOM, React, or Node I/O**.

Infrastructure work is sequenced before full gameplay (see [ACTIVE_WORK.md](../ACTIVE_WORK.md)):

```text
CORE-F01 (this) → F02 Tag → F03 Event → F04 GFC → F05 Pipeline probe → CLI-F01 → COMBAT-F01
```

Each layer must ship with a **thin probe test** before the next layer starts.

---

## Decision log

Decisions below were agreed **2026-07-11** (user: “都按你推荐的来吧”).

| # | Topic | Decision | Rationale |
|---|--------|----------|-----------|
| D1 | Package manager | **npm workspaces** | Zero extra tooling; sufficient for 2–3 packages at MVP |
| D2 | Node version | **≥ 20 LTS** | ESM, modern `engines`; record in root `package.json` + `.nvmrc` |
| D3 | Module system | **ESM only** (`"type": "module"`) | Aligns with Node 20+ and future bundlers |
| D4 | Initial packages | **`@cardgame/core`**, **`@cardgame/cli`** only | Avoid empty `data`/`editor`/`ui` shells |
| D5 | Core build | **`tsc --build`** (project references) | Clear type boundaries; IDE-friendly |
| D6 | CLI dev run | **`tsx`** for local execution | Fast iteration; not used in core |
| D7 | Test runner | **Vitest** | ESM-native, fast, good TS integration |
| D8 | Lint / format | **ESLint 9 flat config** + **Prettier** | Industry default; separate concerns |
| D9 | TS strictness | **`strict: true`**, **`noUncheckedIndexedAccess: true`** | Safer array/map access in card game logic |
| D10 | Core purity | No `console`, no `fs`, no `process` in core | Host adapters only; enforceable via eslint import rules later |
| D11 | Trace storage (phase 1) | **In-memory `TraceBuffer` + CLI ndjson stdout** | Deterministic tests; replay via seed + actions, not log parsing |
| D12 | Trace in GameState | **Deferred** until CORE-F05 or COMBAT-F01 | Avoid premature snapshot schema |
| D13 | Trace clock | **Logical tick / sequence `t`**, not `Date.now()` | Reproducible traces across runs |
| D14 | Host process errors | **`console.error`** initially | Minimal; revisit **pino** when debug REPL grows (CLI-F01+) |
| D15 | Game trace vs process log | **Separate channels** | Trace = domain events; stderr = load/argv failures |
| D16 | Third-party logger in core | **None** | Trace is typed domain data, not log lines |
| D17 | Verify gate | Root **`npm run verify`** = typecheck + test + lint | Single local DoD before commit |
| D18 | Fixtures location | **`packages/core/src/__fixtures__/`** or colocated `*.test.ts` | No separate package until shared across hosts |
| D19 | Public API | Explicit **`src/index.ts`** exports per package | Hide internals; no deep imports from hosts |
| D20 | Implementation pace | **Document first (this file), then scaffold** | User requested decision record before 开工 |

---

## Repository layout

```text
CardGameDemo/
├── package.json                 # workspaces, verify scripts, engines
├── tsconfig.base.json           # shared compiler options
├── tsconfig.json                # solution-style references
├── eslint.config.js
├── .prettierrc
├── .nvmrc                       # 20
├── packages/
│   ├── core/
│   │   ├── package.json         # name: @cardgame/core
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── trace/           # F01: types + TraceBuffer + NoopSink
│   └── cli/
│       ├── package.json         # name: @cardgame/cli, depends on core
│       ├── tsconfig.json
│       └── src/
│           └── main.ts          # argv stub, ndjson trace writer
├── docs/
└── .cursor/
```

**Dependency rule:** `cli → core`. Nothing depends on `cli`. Core has **zero** runtime dependencies (devDeps only: vitest, typescript).

---

## Package responsibilities

| Package | Role | Allowed I/O |
|---------|------|-------------|
| `@cardgame/core` | Tags, events, GFC, combat rules (later) | Pure computation; `TraceSink.emit` callback only |
| `@cardgame/cli` | Process entry, argv, stdout ndjson, future debug REPL | Node stdin/stdout/stderr, filesystem (later) |

Future hosts (`editor`, `ui`) follow the same pattern: depend on `core`, implement their own sinks.

---

## Toolchain

### TypeScript

- Shared `tsconfig.base.json`: `module`/`moduleResolution` for Node16/NodeNext ESM, `declaration: true`, `composite: true` for references.
- Per-package `tsconfig.json` extends base; `outDir: dist`.

### Scripts (root)

```json
{
  "scripts": {
    "typecheck": "tsc -b",
    "test": "vitest run",
    "lint": "eslint .",
    "verify": "npm run typecheck && npm run test && npm run lint"
  }
}
```

### ESLint (initial rules intent)

- `@typescript-eslint` recommended-type-checked
- No `any` in `packages/core/**` (warn → error once scaffold exists)
- Optional later: `import-x/no-restricted-paths` — core cannot import cli

### Prettier

- Default options; format `*.{ts,tsx,json,md}` via script or editor integration

---

## Logging and trace architecture

Three layers — **do not collapse into one npm logger**.

```text
┌─────────────────────────────────────────────────────────┐
│  @cardgame/core                                         │
│  GameTraceEntry (discriminated union)                   │
│  TraceSink interface ← TraceBuffer | NoopTraceSink      │
│  Rules code calls sink.emit(entry) — no console         │
└───────────────────────────┬─────────────────────────────┘
                            │ entries[]
┌───────────────────────────▼─────────────────────────────┐
│  @cardgame/cli                                          │
│  --trace ndjson  → one JSON object per line on stdout   │
│  --trace off     → NoopTraceSink                        │
│  --trace pretty  → (later) human formatter on stderr    │
│  Process errors  → console.error                        │
└─────────────────────────────────────────────────────────┘
```

### Layer 1 — `GameTraceEntry` (core)

Discriminated union by `kind`. Initial kinds for F01 scaffold (extensible):

| `kind` | Purpose |
|--------|---------|
| `trace.start` | Run/session metadata (seed, scenario id) |
| `trace.end` | Normal completion |
| `debug.note` | Placeholder for future debug commands |

CORE-F02+ will add e.g. `tag.add`, `tag.remove`, `event.dispatch`, `attr.change`, `ge.apply`.

Fields common pattern:

- `t: number` — monotonic logical tick assigned by collector
- Entity refs as `string` ids until entity type exists

### Layer 2 — `TraceSink` / `TraceBuffer` (core)

```typescript
interface TraceSink {
  emit(entry: Omit<GameTraceEntry, 't'> & { t?: number }): void;
}

class TraceBuffer implements TraceSink {
  readonly entries: GameTraceEntry[] = [];
  emit(entry): void { /* assign t, push */ }
}

class NoopTraceSink implements TraceSink {
  emit(): void { /* no-op */ }
}
```

Tests default to `NoopTraceSink` or inspect `TraceBuffer.entries`.

### Layer 3 — Host output (cli)

| Flag | Behavior |
|------|----------|
| `--trace ndjson` | After run, write each entry as one JSON line to **stdout** |
| `--trace off` | No stdout trace (default for empty stub) |

**Stdout vs stderr:** trace ndjson on **stdout** so agents can pipe cleanly; errors on **stderr**.

### Deferred (explicit)

| Item | Target feature | Notes |
|------|----------------|-------|
| Trace in `GameState` JSON | CORE-F05 / COMBAT-F01 | Enables save/replay bundle |
| `--trace pretty` | CLI-F01 | Human-readable battle log |
| pino for CLI | CLI-F01+ | When command surface grows |
| Log level / rotation | Post-MVP | Not needed for rules machine MVP |
| File sink | Post-MVP | `--trace file:path` optional later |

---

## Naming conventions (code)

Align with [gameplay-framework.md](../../design/systems/gameplay-framework.md) and [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md):

| Area | Convention |
|------|------------|
| Framework modules | `*Manager` (registry/lifecycle) or `*System` (dispatch/process) — see conventions doc |
| Types / classes | `GameplayTag`, `GameplayTagManager`, `GameplayTagContainer`, `TraceBuffer` — PascalCase |
| Tag string literals | Dot hierarchy: `Character.Enemy.Orc` |
| Files | kebab-case dirs ok; primary types match doc names |
| Tests | `*.test.ts` adjacent or under `__tests__/` |
| Package scope | `@cardgame/*` |

---

## Alternatives considered

| Alternative | Why not (for now) |
|-------------|-------------------|
| **pnpm workspaces** | Faster/stricter, but adds install policy; npm sufficient at 2 packages |
| **Single package repo** | Would blur core purity and host I/O boundaries early |
| **pino inside core** | Violates purity; couples rules to Node logging |
| **Only console.log for everything** | Not machine-parseable; breaks agent/replay goals |
| **Trace only via test assertions, no model** | Same duplication when CLI and tests both need observability |
| **CJS + ESM dual publish** | Unnecessary complexity for greenfield Node 20 |
| **Jest** | Vitest lighter for ESM monorepos |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Trace schema churn | Version field on `trace.start`; additive `kind` values only |
| Core accidentally imports Node | ESLint restricted imports in F01-S02 |
| ndjson stdout mixed with other prints | CLI: only trace on stdout; banners on stderr |
| Over-building F01 before Tag work | F01 Done = verify green + empty trace round-trip test |

---

## Acceptance (CORE-F01)

- [x] Root npm workspace with `@cardgame/core` and `@cardgame/cli`
- [x] `npm run verify` passes (typecheck + vitest + eslint)
- [x] `TraceBuffer` + `NoopTraceSink` + minimal `GameTraceEntry` kinds in core
- [x] CLI stub runs and can emit ndjson trace lines with `--trace ndjson`
- [x] Node `engines` and `.nvmrc` set to ≥ 20
- [x] No runtime dependencies in `@cardgame/core`
- [x] This doc linked from FEATURE_REGISTRY and ACTIVE_WORK

---

## Slices (implementation order)

| Slice | Deliverable |
|-------|-------------|
| **CORE-F01-S01** | Root workspace, tsconfig base, empty packages, verify scripts |
| **CORE-F01-S02** | ESLint + Prettier + Vitest wired |
| **CORE-F01-S03** | Trace types + buffer + unit test |
| **CORE-F01-S04** | CLI main + ndjson flag + smoke test |

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-11 | Implemented S01–S04; verify green; CLI ndjson smoke test passed |
| 2026-07-11 | Initial accepted spec; decisions D1–D20 recorded per user approval |
