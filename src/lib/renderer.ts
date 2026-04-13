import type { GridConfig } from './types';
import { FONT_FAMILY, getLineHeightMult } from './font-metrics';

export class AsciiTextRenderer {
  private el: HTMLElement;
  /** Plain grid from the last {@link load}; avoids reading {@link HTMLElement#textContent} after colored HTML, where spacing can differ from the source lines. */
  private plainText = '';
  displayZoom = 1;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  /** @param bias −100 (min zoom) … 0 (100% scale) … +100 (max zoom in) */
  setDisplayZoom(bias: number) {
    const z = Math.max(-100, Math.min(100, bias));
    if (z <= 0) {
      this.displayZoom = 0.01 + ((z + 100) / 100) * 0.99;
    } else {
      this.displayZoom = 1 + (z / 100) * 1;
    }
  }

  load(params: {
    lines: string[];
    grid: GridConfig;
    singleTintColor: string;
    htmlLines: string[] | null;
  }) {
    const { lines, grid, singleTintColor, htmlLines } = params;
    this.plainText = lines.join('\n');
    const fz = grid.fontSize * this.displayZoom;
    const lh = fz * getLineHeightMult();
    this.el.style.fontFamily = FONT_FAMILY;
    this.el.style.fontSize = `${fz}px`;
    this.el.style.lineHeight = `${lh}px`;
    if (htmlLines) {
      this.el.innerHTML = htmlLines.join('\n');
      this.el.style.color = '';
    } else {
      this.el.textContent = lines.join('\n');
      this.el.style.color = singleTintColor;
    }
  }

  clear() {
    this.plainText = '';
    this.el.textContent = '';
    this.el.style.color = '';
    this.el.style.fontSize = '';
    this.el.style.lineHeight = '';
  }

  getText(): string {
    const raw = this.plainText;
    if (!raw) return '';
    return raw
      .split('\n')
      .map((ln) => ln.replace(/\s+$/u, ''))
      .join('\n');
  }
}
