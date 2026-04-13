import { prepareWithSegments, measureLineStats } from '@chenglou/pretext';

export const FONT_FAMILY = "'VT323', monospace";
const LINE_HEIGHT_MULT = 1.1;
const REF_SIZE = 100;

let _charWidthRatio: number | null = null;
let _fontLoadScheduled = false;

function scheduleFontLoadInvalidation() {
  if (_fontLoadScheduled || typeof document === 'undefined') return;
  _fontLoadScheduled = true;
  document.fonts.ready.then(() => {
    _charWidthRatio = null;
  });
}

/**
 * Measures the actual character-width-to-font-size ratio using pretext.
 * For monospace fonts like VT323 this ratio is constant across sizes.
 * The result is cached and auto-invalidated when web fonts finish loading.
 */
export function measureCharWidthRatio(): number {
  scheduleFontLoadInvalidation();
  if (_charWidthRatio !== null) return _charWidthRatio;

  const font = `${REF_SIZE}px ${FONT_FAMILY}`;
  const sample = 'WWWWWWWWWW';
  const prepared = prepareWithSegments(sample, font);
  const { maxLineWidth } = measureLineStats(prepared, 1e5);
  _charWidthRatio = maxLineWidth / (sample.length * REF_SIZE);

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
