export class GameplayTagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameplayTagError';
  }
}
