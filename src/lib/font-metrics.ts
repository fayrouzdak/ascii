export const FONT_FAMILY = "'VT323', monospace";
const LINE_HEIGHT_MULT = 1.1;
const REF_SIZE = 100;
const SAMPLE = 'WWWWWWWWWW';

let _charWidthRatio: number | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;
let _fontLoadPromise: Promise<void> | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    _measureCtx = document.createElement('canvas').getContext('2d')!;
  }
  return _measureCtx;
}

/**
 * Explicitly triggers VT323 loading and resolves once available.
 * Unlike document.fonts.ready (which resolves immediately when no text
 * uses the font), this actively initiates the download.
 */
export function ensureFontLoaded(): Promise<void> {
  if (_fontLoadPromise) return _fontLoadPromise;
  if (typeof document === 'undefined') return Promise.resolve();
  _fontLoadPromise = document.fonts.load(`${REF_SIZE}px ${FONT_FAMILY}`).then(() => {
    _charWidthRatio = null;
  }).catch(() => {});
  return _fontLoadPromise;
}

/** Kick off font download eagerly at import time. */
if (typeof document !== 'undefined') {
  ensureFontLoaded();
}

/**
 * Measures the actual character-width-to-font-size ratio via canvas.
 * For monospace fonts like VT323 this ratio is constant across sizes.
 * The result is cached and auto-invalidated when the web font finishes loading.
 */
export function measureCharWidthRatio(): number {
  if (_charWidthRatio !== null) return _charWidthRatio;

  const ctx = getMeasureCtx();
  ctx.font = `${REF_SIZE}px ${FONT_FAMILY}`;
  _charWidthRatio = ctx.measureText(SAMPLE).width / (SAMPLE.length * REF_SIZE);

  if (!_charWidthRatio || _charWidthRatio <= 0 || !isFinite(_charWidthRatio)) {
    _charWidthRatio = 0.6;
  }
  return _charWidthRatio;
}

export function getFontAspect(): number {
  return measureCharWidthRatio() / LINE_HEIGHT_MULT;
}

export function getLineHeightMult(): number {
  return LINE_HEIGHT_MULT;
}

export function clearMetricsCache(): void {
  _charWidthRatio = null;
}
