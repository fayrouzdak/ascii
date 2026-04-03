import type { AsciiCell, Effect, EffectUpdateState, GridConfig } from '../types';

// Cells scatter to random positions on init, then spring back to their targets.
// After the first assembly, re-triggering init causes a new scatter.

export const assemblyEffect: Effect = {
  name: 'assembly',
  label: 'Assembly',

  init(cells: AsciiCell[], grid: GridConfig) {
    const w = grid.cols * grid.cellWidth;
    const h = grid.rows * grid.cellHeight;
    for (const cell of cells) {
      cell.currentX = (Math.random() - 0.5) * w * 2 + w / 2;
      cell.currentY = (Math.random() - 0.5) * h * 2 + h / 2;
      cell.vx = 0;
      cell.vy = 0;
      cell.opacity = 0;
      cell.displayChar = cell.char;
    }
  },

  update(cells: AsciiCell[], _grid: GridConfig, state: EffectUpdateState) {
    const spring = 0.06 + state.speed * 0.12;
    const damping = 0.82;

    for (const cell of cells) {
      const dx = cell.targetX - cell.currentX;
      const dy = cell.targetY - cell.currentY;

      cell.vx = (cell.vx + dx * spring) * damping;
      cell.vy = (cell.vy + dy * spring) * damping;

      cell.currentX += cell.vx;
      cell.currentY += cell.vy;

      const dist = Math.sqrt(dx * dx + dy * dy);
      cell.opacity = Math.min(1, cell.opacity + state.deltaTime * 0.003);

      // Snap when close enough
      if (dist < 0.5 && Math.abs(cell.vx) < 0.1 && Math.abs(cell.vy) < 0.1) {
        cell.currentX = cell.targetX;
        cell.currentY = cell.targetY;
        cell.vx = 0;
        cell.vy = 0;
        cell.opacity = 1;
      }
    }
  },
};
