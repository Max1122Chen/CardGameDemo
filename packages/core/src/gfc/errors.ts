export class GameplayNotImplementedError extends Error {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`);
    this.name = 'GameplayNotImplementedError';
  }
}

export class GameplayEffectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameplayEffectError';
  }
}
