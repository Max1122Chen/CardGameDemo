# CardGameDemo

Roguelike card game **rules machine** MVP (TypeScript, console/agent-first).

## Status

**Framework foundation** — `packages/core` + `packages/cli` scaffold landed (CORE-F01). Gameplay design: [docs/design/Overview.md](docs/design/Overview.md) + [systems/](docs/design/systems/). Engineering: [docs/ai/](docs/ai/).

## Quick start

Requires **Node ≥ 20** (see `.nvmrc`).

```bash
npm install
npm run verify
npm run start -w @cardgame/cli -- --trace ndjson --seed 42 --scenario probe
```

Dev (rebuild + tsx):

```bash
npm run dev -w @cardgame/cli -- --trace ndjson
```

## Links

- [Design Overview](docs/design/Overview.md)
- [CORE-F01 spec](docs/ai/Core/CORE-F01-monorepo-tooling-logging.md)
- [Design edit rules](docs/design/DESIGN_DOC_GOVERNANCE.md)
- [Working with AI](docs/ai/WORKING_WITH_AI.md)
- [Remote](https://github.com/Max1122Chen/CardGameDemo)
