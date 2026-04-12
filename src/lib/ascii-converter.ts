import type { AsciiCell, GridConfig } from './types';
import type { ConversionOptions } from './conversion-options';
import { contrastFactorFromCentered, adjustPixel, luminance, clamp, sharpenLuminance } from './pixel-pipeline';
import { applyDither } from './pixel-pipeline';
import { buildLevelsFromGradient, getGradientString, DEFAULT_QUANTIZE_PALETTE } from './gradients';

const FONT_ASPECT = 0.55;
const GRADIENT_LEVELS = 16;

const RANDOM_CHARS = '!@#$%&*+=?abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Stable glyph per cell so animated sources (e.g. GIF) do not flicker on each resample. */
function stableRandomChar(col: number, row: number): string {
  const h = (Math.imul(col, 73856093) ^ Math.imul(row, 19349663) ^ Math.imul(col * row, 83492791)) >>> 0;
  return RANDOM_CHARS[h % RANDOM_CHARS.length]!;
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

export function convertImageToAscii(
  src: ImageSource,
  canvasWidth: number,
  canvasHeight: number,
  options: ConversionOptions,
): { cells: AsciiCell[]; grid: GridConfig } {
  const paletteForRamp =
    options.charMode === 'shaded' ? options.tonePalette : DEFAULT_QUANTIZE_PALETTE;
  const gradientRaw = getGradientString(paletteForRamp);
  const ramp = buildLevelsFromGradient(gradientRaw, GRADIENT_LEVELS);
  const nLevels = ramp.length;

  const cols = Math.max(1, Math.min(100, options.outputCols));
  const rows = Math.max(8, Math.round((src.height / src.width) * cols * FONT_ASPECT));

  const gap = 0;
  const totalGapW = gap * Math.max(0, cols - 1);
  let cellWidth = (canvasWidth - totalGapW) / cols;
  let fontSize = cellWidth / 0.6;
  let cellHeight = fontSize * 1.1;

  if (rows * cellHeight > canvasHeight) {
    const s = canvasHeight / (rows * cellHeight);
    fontSize *= s;
    cellHeight *= s;
    cellWidth = fontSize * 0.6;
  }

  const gridWidth = cols * cellWidth + totalGapW;
  const gridHeight = rows * cellHeight;
  const offsetX = (canvasWidth - gridWidth) / 2;
  const offsetY = (canvasHeight - gridHeight) / 2;
  const anchorX = offsetX + gridWidth / 2;
  const anchorY = offsetY + gridHeight / 2;

  const grid: GridConfig = { cols, rows, cellWidth, cellHeight, fontSize, anchorX, anchorY };

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
  const charMode = options.charMode;

  const cells: AsciiCell[] = [];
  for (let row = 0; row < rows; row++) {
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
      } else {
        ch = stableRandomChar(col, row);
      }

      const targetX = offsetX + col * (cellWidth + gap);
      const targetY = offsetY + row * cellHeight + cellHeight;
      const cellIsVisible = charMode === 'dots' ? isVisibleDots : isVisible;
      let color = options.pictureForeground;
      if (charMode !== 'shaded' && cellIsVisible) {
        color = foregroundAtBrightness(options.pictureForeground, brightness);
      }

      cells.push({
        char: ch,
        col,
        row,
        targetX,
        targetY,
        brightness,
        opacity: 1,
        color,
      });
    }
  }

  return { cells, grid };
}

/** @deprecated use buildLevelsFromGradient via options */
export function buildRamp(density: number): string {
  return buildLevelsFromGradient(` .,:;i1tfLCG08@█`, density);
}
