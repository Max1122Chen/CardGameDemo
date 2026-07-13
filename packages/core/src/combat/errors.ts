export class CombatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CombatError';
  }
}
