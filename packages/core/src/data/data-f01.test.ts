import { describe, expect, it } from 'vitest';

import { RuleEngine } from '../engine/rule-engine.js';
import { CombatSession } from '../combat/combat-session.js';
import {
  buildCardCatalog,
  buildCombatCardBootstrap,
  parseCardDefinition,
} from './parse-card.js';
import {
  loadCombatBootstrapFromRepo,
  loadCardWiresFromDir,
  loadDeckIds,
  resolveRepoDataRoot,
  combatBootstrapConfig,
} from './combat-bootstrap.test-helper.js';

describe('DATA-F01 card asset pipeline', () => {
  it('loads starter deck from repo JSON', () => {
    const engine = RuleEngine.create();
    const { cardCatalog, deckIds } = loadCombatBootstrapFromRepo(engine.tagManager);

    expect(Object.keys(cardCatalog).sort()).toEqual([
      'bash',
      'defend',
      'flex',
      'strike',
      'wait',
      'weaken',
    ]);
    expect(deckIds).toHaveLength(12);
    expect(cardCatalog.strike.name).toBe('Strike');
    expect(cardCatalog.strike.ability.effectsOnActivate).toHaveLength(2);
  });

  it('parses weaken vulnerable commit effect with duration channels', () => {
    const engine = RuleEngine.create();
    const { cardCatalog } = loadCombatBootstrapFromRepo(engine.tagManager);
    const weaken = cardCatalog.weaken;

    expect(weaken.commitEffects).toHaveLength(1);
    const effect = weaken.commitEffects![0]!.effect;
    expect(effect.id).toBe('ge.status.vulnerable');
    expect(effect.duration.kind).toBe('Duration');
    if (effect.duration.kind === 'Duration') {
      expect(effect.duration.channels).toHaveLength(1);
    }
  });

  it('starter JSON battle matches F03 weaken + strike probe', () => {
    const engine = RuleEngine.create();
    const session = CombatSession.bootstrap(engine, {
      ...combatBootstrapConfig(engine),
      openingHand: ['weaken', 'strike'],
    });

    const weakenIndex = session.getSnapshot().hand.findIndex((c) => c.actionId === 'weaken');
    session.applyAction({ type: 'PlayCard', handIndex: weakenIndex });

    const strikeIndex = session.getSnapshot().hand.findIndex((c) => c.actionId === 'strike');
    session.applyAction({ type: 'PlayCard', handIndex: strikeIndex });

    expect(session.getSnapshot().enemies[0].health).toBe(5);
  });

  it('rejects duplicate card ids in catalog build', () => {
    const engine = RuleEngine.create();
    const [strikeWire] = loadCardWiresFromDir(`${resolveRepoDataRoot()}/cards`).filter(
      (wire) => wire.id === 'strike',
    );
    if (!strikeWire) {
      throw new Error('strike.json missing');
    }

    expect(() =>
      buildCardCatalog(
        [
          { ...strikeWire, name: 'A' },
          { ...strikeWire, name: 'B' },
        ],
        engine.tagManager,
      ),
    ).toThrow(/Duplicate card id/);
  });

  it('deck builder rejects unknown card references', () => {
    const engine = RuleEngine.create();
    const wires = loadCardWiresFromDir(`${resolveRepoDataRoot()}/cards`);

    expect(() =>
      buildCombatCardBootstrap(wires, ['strike', 'missing'], engine.tagManager),
    ).toThrow(/Unknown card id/);
  });

  it('round-trips a minimal wire card through parseCardDefinition', () => {
    const engine = RuleEngine.create();
    const wire = {
      id: 'wait',
      name: 'Wait',
      cost: 1,
      targeting: 'none' as const,
      ability: {
        id: 'ga.card.wait',
        kind: 'active' as const,
        name: 'Wait',
        tags: { abilityTags: ['Card.wait'] },
        chargeCostOnActivate: false,
        endPolicy: 'manual' as const,
        effectsOnActivate: [],
        listenWhileActive: {
          channelTag: 'Combat',
          eventTags: ['GameplayEvent.Combat.TryPlayCard'],
          match: 'any' as const,
        },
      },
    };

    const parsed = parseCardDefinition(wire, engine.tagManager);
    expect(parsed.id).toBe('wait');
    expect(parsed.ability.id).toBe('ga.card.wait');
  });

  it('starter deck file lists twelve card ids', () => {
    const deckIds = loadDeckIds(`${resolveRepoDataRoot()}/decks`);
    expect(deckIds).toHaveLength(12);
    expect(deckIds.filter((id) => id === 'strike')).toHaveLength(4);
  });
});
