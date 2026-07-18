import { describe, expect, it } from 'vitest';

import {
  createBeggar,
  createLifeFountain,
  createMemoryInteractionHost,
} from './interaction/index.js';
import { AdventureSession } from './adventure-session.js';
import { normalizeLevelAsset } from './level-geometry.js';

function safeRoomLevel() {
  return normalizeLevelAsset({
    id: 'level.interact',
    source: 'virtual',
    startRoomId: 'start',
    startPosition: { x: 0, y: 0 },
    rooms: {
      start: {
        id: 'start',
        kind: 'safe',
        rect: { x: 0, y: 0, w: 1, h: 1 },
      },
    },
    doors: [],
  });
}

describe('INTERACT-F01 dialogue shell', () => {
  it('fountain heals and depletes on the shared shell', () => {
    const host = createMemoryInteractionHost({ health: 10, maxHealth: 30 });
    const fountain = createLifeFountain('f1', { charges: 1, healAmount: 8 });
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: { start: [fountain] },
      interactionHost: host,
    });

    session.applyAction({ type: 'BeginInteract', interactableId: 'f1' });
    expect(session.getSnapshot().activeInteraction?.frame.options.map((o) => o.id)).toContain(
      'drink',
    );
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'drink' });
    expect(host.state.health).toBe(18);
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'drink' });
    expect(host.state.health).toBe(18);
    expect(session.getSnapshot().activeInteraction?.frame.prompt).toMatch(/dry/i);
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'leave' });
    expect(session.isInteractionActive()).toBe(false);
  });

  it('beggar accepts gold and remembers gift via same Begin/Choose API', () => {
    const host = createMemoryInteractionHost({
      health: 20,
      maxHealth: 30,
      items: { gold_coin: 2 },
    });
    const beggar = createBeggar('b1');
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: { start: [beggar] },
      interactionHost: host,
    });

    session.applyAction({ type: 'BeginInteract', interactableId: 'b1' });
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'give' });
    expect(host.state.items.gold_coin).toBe(1);
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'listen' });
    expect(host.state.health).toBe(23);
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'leave' });
    expect(session.isInteractionActive()).toBe(false);

    session.applyAction({ type: 'BeginInteract', interactableId: 'b1' });
    expect(session.getSnapshot().activeInteraction?.frame.options).toEqual([
      { id: 'leave', label: 'Leave' },
    ]);
  });

  it('lists both facility and npc in the same room', () => {
    const host = createMemoryInteractionHost();
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: {
        start: [createLifeFountain('f'), createBeggar('b')],
      },
      interactionHost: host,
    });
    const legal = session.legalActions().filter((a) => a.type === 'BeginInteract');
    expect(legal).toHaveLength(2);
  });
});
