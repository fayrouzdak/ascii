export { assemblyEffect } from './assembly';
export { waveEffect } from './wave';
export { mouseReactEffect } from './mouse-react';
export { cycleEffect } from './cycle';

import type { Effect, EffectType } from '../types';
import { assemblyEffect } from './assembly';
import { waveEffect } from './wave';
import { mouseReactEffect } from './mouse-react';
import { cycleEffect } from './cycle';

const registry: Record<EffectType, Effect | null> = {
  none: null,
  assembly: assemblyEffect,
  wave: waveEffect,
  'mouse-react': mouseReactEffect,
  cycle: cycleEffect,
};

export function getEffect(type: EffectType): Effect | null {
  return registry[type] ?? null;
}

export const EFFECT_LIST: { type: EffectType; label: string }[] = [
  { type: 'none', label: 'None (static)' },
  { type: 'assembly', label: 'Assembly' },
  { type: 'wave', label: 'Wave' },
  { type: 'mouse-react', label: 'Mouse React' },
  { type: 'cycle', label: 'Cycle' },
];
