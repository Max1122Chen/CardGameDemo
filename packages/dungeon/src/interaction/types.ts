/** One option shown in a dialogue frame. */
export type DialogueOption = {
  id: string;
  label: string;
};

/** Prompt + options for the CLI / host to render. */
export type DialogueFrame = {
  prompt: string;
  options: DialogueOption[];
};

export type InteractableKind = 'facility' | 'npc' | 'script';

/**
 * Host-owned player/world side effects. Interactables call this; they do not
 * own GFC/inventory directly.
 */
export type InteractionHost = {
  getHealth(): number;
  getMaxHealth(): number;
  /** Heal up to max; returns actual amount healed. */
  heal(amount: number): number;
  /** Remove up to `quantity` of itemId from inventory; false if not enough. */
  tryTakeItem(itemId: string, quantity: number): boolean;
  /** Whether inventory currently has at least `quantity` of itemId. */
  hasItem(itemId: string, quantity: number): boolean;
  log(message: string): void;
};

/**
 * World object the player can talk to / use. Owns its own rules and state.
 * Shared surface is begin/choose + Dialogue frames only.
 */
export type Interactable = {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly displayName: string;
  canInteract(): boolean;
  begin(host: InteractionHost): DialogueFrame;
  /**
   * Apply a choice. Returns the next frame, or `null` when the session ends.
   */
  choose(optionId: string, host: InteractionHost): DialogueFrame | null;
};

export type RoomInteractableView = {
  id: string;
  kind: InteractableKind;
  displayName: string;
  canInteract: boolean;
};
