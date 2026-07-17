import { describe, expect, it } from 'vitest';

import { executeConsoleCommand } from './console-executor.js';
import { createSessionController } from '../session/session-controller.js';

describe('executeConsoleCommand', () => {
  it('shows help commands', () => {
    const controller = createSessionController({ traceToBuffer: true });
    const result = executeConsoleCommand(controller, 'help');
    expect(result.lines.some((line) => line.includes('state'))).toBe(true);
    expect(result.lines.some((line) => line.includes('dungeon'))).toBe(true);
    expect(result.statusMessage).toMatch(/help/i);
  });

  it('prints entity state', () => {
    const controller = createSessionController({ traceToBuffer: true });
    const result = executeConsoleCommand(controller, 'state player');
    expect(result.lines.join('\n')).toContain('player');
    expect(result.lines.join('\n')).toContain('Health');
  });

  it('updates attribute through attr command', () => {
    const controller = createSessionController({ traceToBuffer: true });
    executeConsoleCommand(controller, 'attr player Health 99');
    const health = controller.engine.getGfc('player')?.getAttribute('Health')?.baseValue;
    expect(health).toBe(99);
  });

  it('battle command starts BattleOnly explore with confirm pending', () => {
    const controller = createSessionController({ traceToBuffer: true });
    const result = executeConsoleCommand(controller, 'battle orc_brute');
    expect(result.statusMessage).toMatch(/confirm/i);
    expect(controller.sessionKind).toBe('adventure');
    expect(controller.adventure).not.toBeNull();
    expect(controller.adventure?.isPendingCombat()).toBe(true);
    expect(controller.combatSession).toBeNull();
    expect(controller.enemyCharacterId).toBe('orc_brute');
  });

  it('dungeon command loads probe level explore', () => {
    const controller = createSessionController({ traceToBuffer: true });
    const result = executeConsoleCommand(controller, 'dungeon');
    expect(result.statusMessage).toMatch(/Dungeon/i);
    expect(controller.adventure?.getCurrentRoomId()).toBe('start');
  });
});
