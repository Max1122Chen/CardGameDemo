export class GameplayNotImplementedError extends Error {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`);
    this.name = 'GameplayNotImplementedError';
  }
}
