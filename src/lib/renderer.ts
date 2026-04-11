import type { AsciiCell, GridConfig } from './types';
import { getPageBackgroundColor } from './page-background';

export class AsciiRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cells: AsciiCell[] = [];
  private grid: GridConfig | null = null;
  sizeDepth = 0;
  displayZoom = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  loadCells(cells: AsciiCell[], grid: GridConfig) {
    this.cells = cells;
    this.grid = grid;
    this.redraw();
  }

  setSizeDepth(depth: number) {
    this.sizeDepth = depth;
    this.redraw();
  }

  setDisplayZoom(zoomPercent: number) {
    this.displayZoom = Math.max(0.01, Math.min(1, zoomPercent / 100));
  }

  getText(): string {
    const { cells, grid } = this;
    if (!grid) return '';
    const lines: string[] = [];
    for (let r = 0; r < grid.rows; r++) {
      let line = '';
      for (let c = 0; c < grid.cols; c++) {
        const cell = cells[r * grid.cols + c];
        line += cell ? cell.char : ' ';
      }
      lines.push(line.trimEnd());
    }
    return lines.join('\n');
  }

  redraw() {
    const { canvas, ctx, cells, grid } = this;
    if (!grid) return;

    ctx.fillStyle = getPageBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textBaseline = 'alphabetic';

    const zx = this.displayZoom;
    const { anchorX, anchorY } = grid;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;

    const baseFontSize = grid.fontSize * zx;
    const baseFont = `${baseFontSize}px 'VT323', monospace`;
    ctx.font = baseFont;
    let lastFontSize = baseFontSize;

    for (const cell of cells) {
      if (cell.char === ' ' || cell.opacity <= 0.01) continue;

      if (this.sizeDepth > 0) {
        const minScale = 1 - this.sizeDepth * 0.72;
        const maxScale = 1 + this.sizeDepth * 0.45;
        const scale = minScale + cell.brightness * (maxScale - minScale);
        const cellFontSize = Math.max(1, baseFontSize * scale);
        if (Math.abs(cellFontSize - lastFontSize) > 0.25) {
          ctx.font = `${cellFontSize.toFixed(1)}px 'VT323', monospace`;
          lastFontSize = cellFontSize;
        }
      } else if (lastFontSize !== baseFontSize) {
        ctx.font = baseFont;
        lastFontSize = baseFontSize;
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, cell.opacity));
      ctx.fillStyle = cell.color;
      const tx = cx + zx * (cell.targetX - anchorX);
      const ty = cy + zx * (cell.targetY - anchorY);
      ctx.fillText(cell.char, tx, ty);
    }

    ctx.globalAlpha = 1;
  }
}
