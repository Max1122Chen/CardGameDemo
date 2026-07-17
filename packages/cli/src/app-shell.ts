import type { CliOptions } from './cli.js';
import { createInitialAppState, routeInput } from './input/input-router.js';
import { parseKeypress } from './input/key-events.js';
import { paintBufferedFrame, resolveTerminalSize } from './render/frame-buffer.js';
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

function resolveSessionBoot(options: Pick<CliOptions, 'mode' | 'seed' | 'scenarioId' | 'enemyId'>) {
  if (options.mode === 'dungeon') {
    return {
      sessionKind: 'adventure' as const,
      adventureKind: 'dungeon' as const,
      sessionPhase: 'adventure_explore' as const,
      runtimeMode: 'dungeon' as const,
    };
  }
  // battle + debug: BattleOnly virtual level with ConfirmCombat beat
  return {
    sessionKind: 'adventure' as const,
    adventureKind: 'battle_only' as const,
    sessionPhase: 'adventure_explore' as const,
    runtimeMode: options.mode === 'debug' ? ('debug' as const) : ('battle' as const),
  };
}

export function createBootstrappedShell(
  options: Pick<CliOptions, 'mode' | 'seed' | 'scenarioId'> & { enemyId?: string },
): {
  state: AppState;
  controller: SessionController;
} {
  const boot = resolveSessionBoot(options);
  const controller = createSessionController({
    seed: options.seed,
    scenarioId: options.scenarioId,
    traceToBuffer: options.mode === 'debug' || options.mode === 'battle' || options.mode === 'dungeon',
    sessionKind: boot.sessionKind,
    adventureKind: boot.adventureKind,
    enemyCharacterId: options.enemyId,
  });
  const initial = createInitialAppState({
    runtimeMode: boot.runtimeMode,
    seed: options.seed,
    scenarioId: options.scenarioId,
    sessionPhase: boot.sessionPhase,
  });
  return {
    controller,
    state: controller.syncViewState(initial),
  };
}

export async function runAppShell(options: CliOptions, io: TerminalIO): Promise<number> {
  if (!io.isInteractive) {
    throw new Error('Battle/debug/dungeon mode requires an interactive terminal (TTY).');
  }

  const { controller, state: bootState } = createBootstrappedShell(options);
  let state = bootState;

  const redraw = () => {
    io.paint(renderFrame(state, controller));
  };

  io.enterRawMode();
  redraw();

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

export function renderBootFrame(
  options: Pick<CliOptions, 'mode' | 'seed' | 'scenarioId'> & { enemyId?: string },
): string {
  const { controller, state } = createBootstrappedShell(options);
  return paintBufferedFrame(renderFrame(state, controller), resolveTerminalSize());
}
