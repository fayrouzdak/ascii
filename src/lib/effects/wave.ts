import type { AsciiCell, Effect, EffectUpdateState, GridConfig } from '../types';

export const waveEffect: Effect = {
  name: 'wave',
  label: 'Wave',

  init(cells: AsciiCell[], _grid: GridConfig) {
    for (const cell of cells) {
      cell.currentX = cell.targetX;
      cell.currentY = cell.targetY;
      cell.opacity = 1;
      cell.displayChar = cell.char;
      cell.vx = 0;
      cell.vy = 0;
    }
  },

  update(cells: AsciiCell[], grid: GridConfig, state: EffectUpdateState) {
    const t = state.time * 0.001 * (0.5 + state.speed * 1.5);
    const amplitude = grid.cellWidth * 2.5;

    for (const cell of cells) {
      const phase = cell.col * 0.3 + cell.row * 0.2;
      const offsetX = Math.sin(t + phase) * amplitude * cell.brightness;
      const offsetY = Math.cos(t * 0.7 + phase * 0.8) * amplitude * 0.6 * cell.brightness;

      cell.currentX = cell.targetX + offsetX;
      cell.currentY = cell.targetY + offsetY;
      cell.opacity = 0.4 + cell.brightness * 0.6;
    }
  },
};
