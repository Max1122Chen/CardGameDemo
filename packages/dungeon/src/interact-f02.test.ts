import { describe, expect, it } from 'vitest';

import {
  createAbandonedForge,
  createBloodAltar,
  createMemoryInteractionHost,
  createSpikeTrap,
  defaultGeneratedInteractables,
  defaultProbeInteractables,
  formatD20Check,
  rollD20Check,
} from './interaction/index.js';
import { AdventureSession } from './adventure-session.js';
import { normalizeLevelAsset } from './level-geometry.js';

function faceToUnit(face: number): number {
  return (face - 1) / 20;
}

function scriptedRng(faces: number[]): () => number {
  let i = 0;
  return () => {
    const face = faces[Math.min(i, faces.length - 1)]!;
    i += 1;
    return faceToUnit(face);
  };
}

function safeRoomLevel(rooms: string[] = ['start']) {
  const roomDefs: Record<string, { id: string; kind: 'safe'; rect: { x: number; y: number; w: number; h: number } }> =
    {};
  rooms.forEach((id, index) => {
    roomDefs[id] = {
      id,
      kind: 'safe',
      rect: { x: index * 2, y: 0, w: 1, h: 1 },
    };
  });
  return normalizeLevelAsset({
    id: 'level.interact.f02',
    source: 'virtual',
    startRoomId: rooms[0]!,
    startPosition: { x: 0, y: 0 },
    rooms: roomDefs,
    doors: [],
  });
}

describe('INTERACT-F02 d20 + content', () => {
  it('nat 1 always fails and nat 20 always succeeds', () => {
    const fail = rollD20Check({ rng: scriptedRng([1]), dc: 1, modifier: 99 });
    expect(fail.success).toBe(false);
    expect(fail.criticalFailure).toBe(true);

    const win = rollD20Check({ rng: scriptedRng([20]), dc: 99, modifier: -50 });
    expect(win.success).toBe(true);
    expect(win.criticalSuccess).toBe(true);
  });

  it('advantage takes the higher face; disadvantage the lower', () => {
    const adv = rollD20Check({
      rng: scriptedRng([3, 17]),
      dc: 10,
      mode: 'advantage',
    });
    expect(adv.natural).toBe(17);
    expect(adv.success).toBe(true);

    const disadv = rollD20Check({
      rng: scriptedRng([3, 17]),
      dc: 10,
      mode: 'disadvantage',
    });
    expect(disadv.natural).toBe(3);
    expect(disadv.success).toBe(false);
  });

  it('formatD20Check includes outcome text', () => {
    const result = rollD20Check({ rng: scriptedRng([15]), dc: 12, modifier: 2 });
    expect(formatD20Check(result)).toMatch(/success/);
  });

  it('spike trap deals damage on failed dex check', () => {
    const host = createMemoryInteractionHost({
      health: 20,
      maxHealth: 30,
      randoms: [faceToUnit(5)],
      checkModifiers: { dexterity: 0 },
    });
    const trap = createSpikeTrap('t1', { dc: 12, failDamage: 6 });
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: { start: [trap] },
      interactionHost: host,
    });

    session.applyAction({ type: 'BeginInteract', interactableId: 't1' });
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'careful' });
    expect(host.state.health).toBe(14);
    expect(host.state.log.some((line) => /fail|Spikes/i.test(line))).toBe(true);
  });

  it('spike trap can be forced through for fixed damage', () => {
    const host = createMemoryInteractionHost({ health: 20, maxHealth: 30 });
    const trap = createSpikeTrap('t2', { forceDamage: 4 });
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: { start: [trap] },
      interactionHost: host,
    });

    session.applyAction({ type: 'BeginInteract', interactableId: 't2' });
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'force' });
    expect(host.state.health).toBe(16);
  });

  it('blood altar trades HP for gold', () => {
    const host = createMemoryInteractionHost({ health: 20, maxHealth: 30 });
    const altar = createBloodAltar('a1');
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: { start: [altar] },
      interactionHost: host,
    });

    session.applyAction({ type: 'BeginInteract', interactableId: 'a1' });
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'sacrifice' });
    expect(host.state.health).toBe(15);
    expect(host.state.items.gold_coin).toBe(2);
  });

  it('abandoned forge consumes scrap to heal', () => {
    const host = createMemoryInteractionHost({
      health: 10,
      maxHealth: 30,
      items: { scrap_metal: 1 },
    });
    const forge = createAbandonedForge('f1');
    const session = AdventureSession.start(safeRoomLevel(), {
      interactablesByRoom: { start: [forge] },
      interactionHost: host,
    });

    session.applyAction({ type: 'BeginInteract', interactableId: 'f1' });
    session.applyAction({ type: 'ChooseInteractOption', optionId: 'stoke' });
    expect(host.state.health).toBe(15);
    expect(host.state.items.scrap_metal).toBeUndefined();
  });

  it('probe mount places trap/altar/forge on expected rooms', () => {
    const mount = defaultProbeInteractables();
    expect(mount.start?.map((i) => i.kind)).toEqual(['facility', 'npc']);
    expect(mount.hall_a?.[0]?.displayName).toBe('Spike Trap');
    expect(mount.hall_b?.[0]?.displayName).toBe('Blood Altar');
    expect(mount.exit?.[0]?.displayName).toBe('Abandoned Forge');
  });

  it('generated runs mount a start-room fountain', () => {
    const session = AdventureSession.startRun({ runSeed: 7, levelCount: 1 });
    const host = createMemoryInteractionHost({ health: 10, maxHealth: 30 });
    session.setInteractionHost(host);
    const names = session.listRoomInteractables().map((i) => i.displayName);
    expect(names).toContain('Fountain of Life');
    expect(defaultGeneratedInteractables('start').start?.[0]?.kind).toBe('facility');
  });
});
