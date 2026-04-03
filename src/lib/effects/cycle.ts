import type { AsciiCell, Effect, EffectUpdateState, GridConfig } from '../types';
import { buildRamp } from '../ascii-converter';

// Each cell cycles through the ramp chars, with a diagonal wave delay
// before settling on the correct char.

interface CycleState {
  rampIndex: number;
  progress: number;
  delay: number;
  settled: boolean;
}

const stateMap = new WeakMap<AsciiCell, CycleState>();

export const cycleEffect: Effect = {
  name: 'cycle',
  label: 'Cycle',

  init(cells: AsciiCell[], grid: GridConfig) {
    const ramp = buildRamp(16);

    for (const cell of cells) {
      cell.currentX = cell.targetX;
      cell.currentY = cell.targetY;
      cell.vx = 0;
      cell.vy = 0;
      cell.opacity = 1;

      // Diagonal wave delay
      const delay = (cell.col + cell.row) * 8;

      stateMap.set(cell, {
        rampIndex: 0,
        progress: 0,
        delay,
        settled: false,
      });

      cell.displayChar = ramp[0]!;
    }
  },

  update(cells: AsciiCell[], _grid: GridConfig, state: EffectUpdateState) {
    const ramp = buildRamp(16);
    const cycleSpeed = 0.05 + state.speed * 0.15;

    for (const cell of cells) {
      const cs = stateMap.get(cell);
      if (!cs) continue;

      if (cs.settled) {
        cell.displayChar = cell.char;
        cell.opacity = 1;
        continue;
      }

      cs.delay -= state.deltaTime * (0.3 + state.speed * 0.5);
      if (cs.delay > 0) {
        cell.opacity = 0.2;
        continue;
      }

      cs.progress += cycleSpeed * state.deltaTime * 0.05;

      const targetIdx = Math.floor(cell.brightness * (ramp.length - 1));
      const currentDisplayIdx = Math.floor(cs.progress) % ramp.length;

      if (cs.progress >= targetIdx + ramp.length) {
        cs.settled = true;
        cell.displayChar = cell.char;
        cell.opacity = 1;
      } else {
        cell.displayChar = ramp[currentDisplayIdx]!;
        cell.opacity = 0.5 + 0.5 * (cs.progress / (targetIdx + ramp.length));
      }
    }
  },
};
