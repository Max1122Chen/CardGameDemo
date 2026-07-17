export class LevelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelParseError';
  }
}

export class AdventureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdventureError';
  }
}
