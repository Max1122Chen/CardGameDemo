export type AdventureLifecycleEventType =
  | 'EnterDungeon'
  | 'LeaveDungeon'
  | 'EnterLevel'
  | 'LeaveLevel'
  | 'RoundStart'
  | 'RoundEnd'
  | 'EnterCombat'
  | 'EndCombat';

export type AdventureLifecycleEvent = {
  type: AdventureLifecycleEventType;
  payload?: Record<string, unknown>;
  at: number;
};

export type AdventureLifecycleListener = (event: AdventureLifecycleEvent) => void;

/**
 * Lightweight adventure lifecycle bus (F02 stubs).
 * Not narrative "game events" — timing hooks for refresh / hosts / future F03–F05.
 */
export class AdventureLifecycleBus {
  private readonly listeners = new Set<AdventureLifecycleListener>();
  private seq = 0;

  subscribe(listener: AdventureLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(type: AdventureLifecycleEventType, payload?: Record<string, unknown>): void {
    const event: AdventureLifecycleEvent = {
      type,
      payload,
      at: this.seq++,
    };
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}
