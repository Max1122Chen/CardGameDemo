import { defineComponentType } from '../engine/component-type.js';
import type { GameplayFrameworkComponent } from './gameplay-framework-component.js';

export const GfcComponentType = defineComponentType<GameplayFrameworkComponent>(
  'GameplayFrameworkComponent',
);
