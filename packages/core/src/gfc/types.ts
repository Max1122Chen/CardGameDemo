import type { EntityId } from '../engine/component-type.js';

export type AttributeChangeCallback = (ctx: {
  entityId: EntityId;
  setId: string;
  attrId: string;
  oldValue: number;
  newValue: number;
}) => void;

export type GfcTagSnapshot = {
  name: string;
  count: number;
};

export type GfcSnapshot = {
  entityId: EntityId;
  tags: GfcTagSnapshot[];
};
