export class GameplayEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameplayEventError';
  }
}
