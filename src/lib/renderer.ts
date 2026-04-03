import type { AsciiCell, Effect, EffectType, GridConfig } from './types';
import { getEffect } from './effects/index';

export class AsciiRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cells: AsciiCell[] = [];
  private grid: GridConfig | null = null;
  private currentEffect: Effect | null = null;
  private effectType: EffectType = 'none';
  private animFrame = 0;
  private lastTime = 0;
  private time = 0;
  private running = false;
  mouseX = 0;
  mouseY = 0;
  speed = 0.5;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  loadCells(cells: AsciiCell[], grid: GridConfig) {
    this.cells = cells;
    this.grid = grid;
    // Re-apply current effect so init runs on the new cells
    if (this.currentEffect) {
      this.currentEffect.init(this.cells, this.grid);
    }
    if (!this.running) this.start();
  }

  setEffect(type: EffectType) {
    this.effectType = type;
    this.currentEffect = getEffect(type);
    if (this.currentEffect && this.grid) {
      this.currentEffect.init(this.cells, this.grid);
    }
  }

  triggerEffect() {
    if (this.currentEffect && this.grid) {
      this.currentEffect.init(this.cells, this.grid);
    }
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.animFrame = requestAnimationFrame((t) => this.draw(t));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animFrame);
  }

  private draw(timestamp: number) {
    if (!this.running) return;

    const deltaTime = Math.min(timestamp - this.lastTime, 50); // cap at 50ms to avoid jumps
    this.lastTime = timestamp;
    this.time += deltaTime;

    const { canvas, ctx, cells, grid } = this;
    if (!grid) {
      this.animFrame = requestAnimationFrame((t) => this.draw(t));
      return;
    }

    // Update effect
    if (this.currentEffect) {
      this.currentEffect.update(cells, grid, {
        mouseX: this.mouseX,
        mouseY: this.mouseY,
        time: this.time,
        speed: this.speed,
        deltaTime,
      });
    }

    // Clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each cell
    ctx.font = `${grid.fontSize}px 'Courier New', Courier, monospace`;
    ctx.textBaseline = 'alphabetic';

    for (const cell of cells) {
      if (cell.displayChar === ' ' || cell.opacity <= 0.01) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, cell.opacity));
      ctx.fillStyle = '#ffffff';
      ctx.fillText(cell.displayChar, cell.currentX, cell.currentY);
    }

    ctx.globalAlpha = 1;
    this.animFrame = requestAnimationFrame((t) => this.draw(t));
  }
}
