import type { GridConfig } from './types';
import type { ConversionOptions } from './conversion-options';
import { contrastFactorFromCentered, adjustPixel, luminance, clamp, sharpenLuminance } from './pixel-pipeline';
import { applyDither } from './pixel-pipeline';
import { buildLevelsFromGradient, getGradientString, DEFAULT_QUANTIZE_PALETTE } from './gradients';
import { measureCharWidthRatio, getLineHeightMult, getFontAspect } from './font-metrics';

const GRADIENT_LEVELS = 16;

const RANDOM_CHARS = '!@#$%&*+=?abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BINARY_CHARS = '01';

/** Stable glyph per cell so animated sources (e.g. GIF) do not flicker on each resample. */
function stableRandomChar(col: number, row: number): string {
  const h = (Math.imul(col, 73856093) ^ Math.imul(row, 19349663) ^ Math.imul(col * row, 83492791)) >>> 0;
  return RANDOM_CHARS[h % RANDOM_CHARS.length]!;
}

function stableBinaryChar(col: number, row: number): string {
  const h = (Math.imul(col, 73856093) ^ Math.imul(row, 19349663) ^ Math.imul(col * row, 83492791)) >>> 0;
  return BINARY_CHARS[h % BINARY_CHARS.length]!;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Groups consecutive same-colored characters into spans for a single grid row. */
function rowToColoredHtml(chars: string[], colors: string[]): string {
  if (chars.length === 0) return '';
  if (chars.length !== colors.length) return escapeHtml(chars.join(''));
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const color = colors[i]!;
    let chunk = '';
    let j = i;
    while (j < chars.length && colors[j] === color) {
      chunk += chars[j]!;
      j++;
    }
    out += `<span style="color:${color}">${escapeHtml(chunk)}</span>`;
    i = j;
  }
  return out;
}

/** Scale hex foreground by brightness for non-shaded char modes */
function foregroundAtBrightness(hex: string, brightness: number): string {
  const n = hex.replace('#', '').trim();
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const f = Math.pow(Math.max(0, Math.min(1, brightness)), 0.7);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

function buildCharGridFromAscii(ascii: string, cols: number, rows: number): string[][] {
  const lines = ascii.trimEnd().split('\n');
  const grid: string[][] = [];
  for (let y = 0; y < rows; y++) {
    const line = lines[y] ?? '';
    const row: string[] = [];
    for (let x = 0; x < cols; x++) {
      row.push(line[x] ?? ' ');
    }
    grid.push(row);
  }
  return grid;
}

export interface ImageSource {
  drawable: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * Cached result of the expensive image-analysis pass.
 * Independent of canvas dimensions — only depends on the source image
 * and processing options (brightness, contrast, palette, etc.).
 */
export interface AsciiAnalysis {
  cols: number;
  rows: number;
  charGrid: string[][];
  gray: Float32Array;
  grayOriginal: Float32Array;
}

/**
 * Expensive pass: sample the image at grid resolution, process pixels,
 * dither, and build the character grid. Result can be reused across
 * viewport resizes because it does not depend on viewport dimensions.
 */
export function analyzeImage(
  src: ImageSource,
  options: ConversionOptions,
): AsciiAnalysis {
  const paletteForRamp =
    options.charMode === 'shaded' ? options.tonePalette : DEFAULT_QUANTIZE_PALETTE;
  const gradientRaw = getGradientString(paletteForRamp);
  const ramp = buildLevelsFromGradient(gradientRaw, GRADIENT_LEVELS);
  const nLevels = ramp.length;

  const fontAspect = getFontAspect();
  const cols = Math.max(1, Math.min(100, options.outputCols));
  const rows = Math.max(8, Math.round((src.height / src.width) * cols * fontAspect));

  const offscreen = document.createElement('canvas');
  offscreen.width = cols;
  offscreen.height = rows;
  const ctx = offscreen.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cols, rows);
  ctx.filter = options.blur > 0 ? `blur(${options.blur}px)` : 'none';
  ctx.drawImage(src.drawable, 0, 0, cols, rows);

  const imageData = ctx.getImageData(0, 0, cols, rows);
  const data = imageData.data;

  const gray = new Float32Array(cols * rows);
  const grayOriginal = new Float32Array(cols * rows);
  const cf = contrastFactorFromCentered(options.contrast);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;
    [r, g, b] = adjustPixel(r, g, b, {
      invert: options.invert,
      hue: options.hue,
      saturation: options.saturation,
      grayscale: 0,
    });
    let L = luminance(r, g, b);
    L = clamp(cf * (L - 128) + 128 + options.brightness, 0, 255);
    grayOriginal[p] = L;
    gray[p] = L;
  }

  sharpenLuminance(gray, cols, rows, options.sharpness);

  const quantize = (lev: number) => ramp[clamp(lev, 0, nLevels - 1)]!;
  const ascii = applyDither(
    new Float32Array(gray),
    cols,
    rows,
    'none',
    nLevels,
    options.ignoreWhite,
    grayOriginal,
    quantize,
  );

  const charGrid = buildCharGridFromAscii(ascii, cols, rows);
  return { cols, rows, charGrid, gray, grayOriginal };
}

/**
 * Cheap pass: fit font size to the view using pretext-measured metrics and
 * build plain text (plus optional per-character color HTML for non-shaded modes).
 */
export function layoutAnalysis(
  analysis: AsciiAnalysis,
  viewWidth: number,
  viewHeight: number,
  options: ConversionOptions,
): {
  lines: string[];
  grid: GridConfig;
  singleTintColor: string;
  htmlLines: string[] | null;
} {
  const { cols, rows, charGrid, gray, grayOriginal } = analysis;
  const charWidthRatio = measureCharWidthRatio();
  const lineHeightMult = getLineHeightMult();

  let cellWidth = viewWidth / cols;
  let fontSize = cellWidth / charWidthRatio;
  let cellHeight = fontSize * lineHeightMult;

  if (rows * cellHeight > viewHeight) {
    const s = viewHeight / (rows * cellHeight);
    fontSize *= s;
  }

  const grid: GridConfig = { cols, rows, fontSize };
  const charMode = options.charMode;
  const perCharTint = charMode !== 'shaded';
  const lines: string[] = [];
  const htmlLines: string[] | null = perCharTint ? [] : null;

  for (let row = 0; row < rows; row++) {
    const rowChars: string[] = [];
    const rowColors: string[] = [];

    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const rawLum = grayOriginal[idx]! / 255;
      let ch = charGrid[row]![col]!;
      const brightness = gray[idx]! / 255;

      const isWhite = options.ignoreWhite && rawLum > 0.95;
      const rampChar = ch;
      const isVisible = !isWhite && rampChar !== ' ';
      const isVisibleDots = !isWhite && brightness > 0.02;

      if (isWhite) {
        ch = ' ';
      } else if (charMode === 'shaded') {
        ch = rampChar;
      } else if (charMode === 'dots') {
        ch = isVisibleDots ? '.' : ' ';
      } else if (!isVisible) {
        ch = ' ';
      } else if (charMode === 'cross') {
        ch = 'x';
      } else if (charMode === 'binary') {
        ch = stableBinaryChar(col, row);
      } else {
        ch = stableRandomChar(col, row);
      }

      const cellIsVisible = charMode === 'dots' ? isVisibleDots : isVisible;
      let color = options.pictureForeground;
      if (charMode !== 'shaded' && cellIsVisible) {
        color = foregroundAtBrightness(options.pictureForeground, brightness);
      }

      rowChars.push(ch);
      if (perCharTint) {
        rowColors.push(color);
      }
    }

    lines.push(rowChars.join('').replace(/\s+$/u, ''));
    if (htmlLines) {
      htmlLines.push(rowToColoredHtml(rowChars, rowColors));
    }
  }

  return {
    lines,
    grid,
    singleTintColor: options.pictureForeground,
    htmlLines,
  };
}

/**
 * Full pipeline (convenience wrapper). For resize-optimized flows, prefer
 * calling {@link analyzeImage} once and {@link layoutAnalysis} on each resize.
 */
export function convertImageToAscii(
  src: ImageSource,
  viewWidth: number,
  viewHeight: number,
  options: ConversionOptions,
) {
  const analysis = analyzeImage(src, options);
  return layoutAnalysis(analysis, viewWidth, viewHeight, options);
}

/** @deprecated use buildLevelsFromGradient via options */
export function buildRamp(density: number): string {
  return buildLevelsFromGradient(` .,:;i1tfLCG08@█`, density);
}
