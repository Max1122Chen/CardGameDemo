import { defineComponentType } from './component-type.js';

export type { ComponentType, EntityId } from './component-type.js';
export { defineComponentType } from './component-type.js';

export type ProbeComponent = {
  value: number;
};

export const ProbeComponentType = defineComponentType<ProbeComponent>('Probe');
