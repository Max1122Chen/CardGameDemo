import type { CliOptions } from './cli.js';
import { createInitialAppState, routeInput } from './input/input-router.js';
import { parseKeypress } from './input/key-events.js';
import { paintInitialFrame } from './render/ansi.js';
import { renderFrame } from './render/frame-renderer.js';
import {
  applyUiActions,
  createSessionController,
  type SessionController,
} from './session/session-controller.js';
import type { TerminalIO } from './terminal/terminal-io.js';
import type { AppState } from './types.js';
import type { ParsedKey } from './input/key-events.js';

export function handleKeypress(
  state: AppState,
  controller: SessionController,
  key: ParsedKey,
): AppState {
  const actions = routeInput(state, key);
  const nextState = applyUiActions(state, controller, actions);
  return controller.syncViewState(nextState);
}

export function createBootstrappedShell(options: Pick<CliOptions, 'mode' | 'seed' | 'scenarioId'>): {
  state: AppState;
  controller: SessionController;
} {
  const controller = createSessionController({
    seed: options.seed,
    scenarioId: options.scenarioId,
    traceToBuffer: options.mode === 'debug' || options.mode === 'battle',
  });
  const initial = createInitialAppState({
    runtimeMode: options.mode === 'debug' ? 'debug' : 'battle',
    seed: options.seed,
    scenarioId: options.scenarioId,
  });
  return {
    controller,
    state: (() => {
      const synced = controller.syncViewState(initial);
      return applyUiActions(synced, controller, [{ type: 'select_hand', index: synced.selectedHandIndex }]);
    })(),
  };
}

export async function runAppShell(options: CliOptions, io: TerminalIO): Promise<number> {
  if (!io.isInteractive) {
    throw new Error('Battle/debug mode requires an interactive terminal (TTY).');
  }

  const { controller, state: bootState } = createBootstrappedShell(options);
  let state = bootState;

  const redraw = (initial = false) => {
    io.paint(renderFrame(state, controller), initial);
  };

  io.enterRawMode();
  redraw(true);

  return new Promise<number>((resolve) => {
    const cleanup = io.onData((chunk) => {
      const key = parseKeypress(chunk);
      state = handleKeypress(state, controller, key);
      if (state.shouldQuit) {
        cleanup();
        io.exitRawMode();
        io.write('\n');
        resolve(0);
        return;
      }
      redraw();
    });
  });
}

export function renderBootFrame(options: Pick<CliOptions, 'mode' | 'seed' | 'scenarioId'>): string {
  const { controller, state } = createBootstrappedShell(options);
  return paintInitialFrame(renderFrame(state, controller));
}
