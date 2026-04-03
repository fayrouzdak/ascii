import type { AsciiCell, Effect, EffectUpdateState, GridConfig } from '../types';

const INFLUENCE_RADIUS = 120;
const PUSH_STRENGTH = 6000;
const SPRING = 0.08;
const DAMPING = 0.78;

export const mouseReactEffect: Effect = {
  name: 'mouse-react',
  label: 'Mouse React',

  init(cells: AsciiCell[], _grid: GridConfig) {
    for (const cell of cells) {
      cell.currentX = cell.targetX;
      cell.currentY = cell.targetY;
      cell.vx = 0;
      cell.vy = 0;
      cell.opacity = 1;
      cell.displayChar = cell.char;
    }
  },

  update(cells: AsciiCell[], _grid: GridConfig, state: EffectUpdateState) {
    const speedFactor = 0.5 + state.speed;

    for (const cell of cells) {
      const dx = cell.currentX - state.mouseX;
      const dy = cell.currentY - state.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < INFLUENCE_RADIUS && dist > 0) {
        const force = (PUSH_STRENGTH * speedFactor) / (dist * dist);
        cell.vx += (dx / dist) * force * state.deltaTime * 0.001;
        cell.vy += (dy / dist) * force * state.deltaTime * 0.001;
      }

      // Spring back to target
      cell.vx += (cell.targetX - cell.currentX) * SPRING;
      cell.vy += (cell.targetY - cell.currentY) * SPRING;

      cell.vx *= DAMPING;
      cell.vy *= DAMPING;

      cell.currentX += cell.vx;
      cell.currentY += cell.vy;

      // Brightness-based opacity -- bright chars more visible
      const distFromTarget = Math.sqrt(
        (cell.currentX - cell.targetX) ** 2 + (cell.currentY - cell.targetY) ** 2,
      );
      cell.opacity = Math.max(0.1, Math.min(1, 0.3 + cell.brightness * 0.7 + distFromTarget * 0.01));
    }
  },
};
