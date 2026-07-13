import type { CardActionId, CardInstance, DeckState } from './types.js';

export function createEmptyDeckState(): DeckState {
  return {
    drawPile: [],
    hand: [],
    discardPile: [],
  };
}

export function buildDeckInstances(
  actionIds: readonly CardActionId[],
): { deck: DeckState; instances: Map<string, CardInstance> } {
  const deck = createEmptyDeckState();
  const instances = new Map<string, CardInstance>();

  actionIds.forEach((actionId, index) => {
    const instanceId = `card-${index + 1}`;
    instances.set(instanceId, { instanceId, actionId });
    deck.drawPile.push(instanceId);
  });

  return { deck, instances };
}

export function shuffleDiscardIntoDraw(deck: DeckState): void {
  if (deck.discardPile.length === 0) {
    return;
  }

  const shuffled = [...deck.discardPile].sort();
  deck.drawPile.push(...shuffled);
  deck.discardPile.length = 0;
}

export function drawCards(deck: DeckState, count: number): string[] {
  const drawn: string[] = [];

  for (let i = 0; i < count; i += 1) {
    if (deck.drawPile.length === 0) {
      shuffleDiscardIntoDraw(deck);
    }
    if (deck.drawPile.length === 0) {
      break;
    }
    const instanceId = deck.drawPile.shift();
    if (!instanceId) {
      break;
    }
    deck.hand.push(instanceId);
    drawn.push(instanceId);
  }

  return drawn;
}

export function discardHand(deck: DeckState): void {
  deck.discardPile.push(...deck.hand);
  deck.hand.length = 0;
}

export function discardFromHand(deck: DeckState, handIndex: number): string | undefined {
  const [instanceId] = deck.hand.splice(handIndex, 1);
  if (!instanceId) {
    return undefined;
  }
  deck.discardPile.push(instanceId);
  return instanceId;
}
