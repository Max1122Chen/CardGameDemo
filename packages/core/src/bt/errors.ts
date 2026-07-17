export class BehaviorTreeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BehaviorTreeParseError';
  }
}
