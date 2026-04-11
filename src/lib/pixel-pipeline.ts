/** Error-diffusion / screen methods for `applyDither` (UI exposes none only). */
export type DitherAlgorithm =
  | 'none'
  | 'floyd'
  | 'jjn'
  | 'stucki'
  | 'atkinson'
  | 'noise'
  | 'ordered';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** CodePen contrast curve: contrast in roughly -127…127 */
export function contrastFactorFromCentered(contrast: number): number {
  const c = clamp(contrast, -127, 127);
  return (259 * (c + 255)) / (255 * (259 - c));
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return [h * 360, s * 100, l * 100];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return [r, g, b];
}

export function adjustPixel(
  r: number,
  g: number,
  b: number,
  opts: {
    invert: boolean;
    hue: number;
    saturation: number;
    grayscale: number;
  },
): [number, number, number] {
  let rr = r;
  let gg = g;
  let bb = b;
  if (opts.invert) {
    rr = 255 - rr;
    gg = 255 - gg;
    bb = 255 - bb;
  }
  if (opts.hue % 360 !== 0 || opts.saturation !== 100) {
    const [h, s, l] = rgbToHsl(rr, gg, bb);
    const nh = (h + opts.hue) % 360;
    const ns = clamp((s * opts.saturation) / 100, 0, 100);
    [rr, gg, bb] = hslToRgb(nh < 0 ? nh + 360 : nh, ns, l);
  }
  const gray = 0.299 * rr + 0.587 * gg + 0.114 * bb;
  const gm = opts.grayscale / 100;
  if (gm > 0) {
    rr = rr * (1 - gm) + gray * gm;
    gg = gg * (1 - gm) + gray * gm;
    bb = bb * (1 - gm) + gray * gm;
  }
  return [rr, gg, bb];
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 3×3 sharpen on luminance grid (amount ~ 0–20, matches “sharpness” sliders) */
export function sharpenLuminance(gray: Float32Array, width: number, height: number, amount: number): void {
  if (amount <= 0) return;
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ];
  const scale = (amount / 20) * 0.35;
  const copy = new Float32Array(gray);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += copy[(y + ky) * width + (x + kx)]! * kernel[ky + 1]![kx + 1]!;
        }
      }
      const idx = y * width + x;
      gray[idx] = clamp(gray[idx]! + (sum - copy[idx]!) * scale, 0, 255);
    }
  }
}

export function applyDither(
  gray: Float32Array,
  width: number,
  height: number,
  algorithm: DitherAlgorithm,
  levels: number,
  ignoreWhite: boolean,
  grayOriginal: Float32Array,
  quantize: (v: number) => string,
): string {
  const nLevels = Math.max(2, levels);
  const g = new Float32Array(gray);

  const shouldSkip = (idx: number) =>
    ignoreWhite && grayOriginal[idx]! >= 254;

  let ascii = '';

  if (algorithm === 'floyd') {
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (shouldSkip(idx)) {
          line += ' ';
          continue;
        }
        let lev = Math.round((g[idx]! / 255) * (nLevels - 1));
        line += quantize(lev);
        const newPx = (lev / (nLevels - 1)) * 255;
        const err = g[idx]! - newPx;
        if (x + 1 < width) g[idx + 1] = clamp(g[idx + 1]! + err * (7 / 16), 0, 255);
        if (x - 1 >= 0 && y + 1 < height) g[idx - 1 + width] = clamp(g[idx - 1 + width]! + err * (3 / 16), 0, 255);
        if (y + 1 < height) g[idx + width] = clamp(g[idx + width]! + err * (5 / 16), 0, 255);
        if (x + 1 < width && y + 1 < height) g[idx + width + 1] = clamp(g[idx + width + 1]! + err * (1 / 16), 0, 255);
      }
      ascii += `${line}\n`;
    }
    return ascii;
  }

  if (algorithm === 'atkinson') {
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (shouldSkip(idx)) {
          line += ' ';
          continue;
        }
        let lev = Math.round((g[idx]! / 255) * (nLevels - 1));
        line += quantize(lev);
        const newPx = (lev / (nLevels - 1)) * 255;
        const err = g[idx]! - newPx;
        const d = err / 8;
        if (x + 1 < width) g[idx + 1] = clamp(g[idx + 1]! + d, 0, 255);
        if (x + 2 < width) g[idx + 2] = clamp(g[idx + 2]! + d, 0, 255);
        if (y + 1 < height) {
          if (x - 1 >= 0) g[idx - 1 + width] = clamp(g[idx - 1 + width]! + d, 0, 255);
          g[idx + width] = clamp(g[idx + width]! + d, 0, 255);
          if (x + 1 < width) g[idx + width + 1] = clamp(g[idx + width + 1]! + d, 0, 255);
        }
        if (y + 2 < height) g[idx + 2 * width] = clamp(g[idx + 2 * width]! + d, 0, 255);
      }
      ascii += `${line}\n`;
    }
    return ascii;
  }

  if (algorithm === 'jjn') {
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (shouldSkip(idx)) {
          line += ' ';
          continue;
        }
        let lev = Math.round((g[idx]! / 255) * (nLevels - 1));
        line += quantize(lev);
        const newPx = (lev / (nLevels - 1)) * 255;
        const err = g[idx]! - newPx;
        const e = err / 48;
        if (x + 1 < width) g[idx + 1] = clamp(g[idx + 1]! + e * 7, 0, 255);
        if (x + 2 < width) g[idx + 2] = clamp(g[idx + 2]! + e * 5, 0, 255);
        if (y + 1 < height) {
          if (x - 2 >= 0) g[idx - 2 + width] = clamp(g[idx - 2 + width]! + e * 3, 0, 255);
          if (x - 1 >= 0) g[idx - 1 + width] = clamp(g[idx - 1 + width]! + e * 5, 0, 255);
          g[idx + width] = clamp(g[idx + width]! + e * 7, 0, 255);
          if (x + 1 < width) g[idx + width + 1] = clamp(g[idx + width + 1]! + e * 5, 0, 255);
          if (x + 2 < width) g[idx + width + 2] = clamp(g[idx + width + 2]! + e * 3, 0, 255);
        }
        if (y + 2 < height) {
          if (x - 2 >= 0) g[idx - 2 + 2 * width] = clamp(g[idx - 2 + 2 * width]! + e * 1, 0, 255);
          if (x - 1 >= 0) g[idx - 1 + 2 * width] = clamp(g[idx - 1 + 2 * width]! + e * 3, 0, 255);
          g[idx + 2 * width] = clamp(g[idx + 2 * width]! + e * 5, 0, 255);
          if (x + 1 < width) g[idx + 2 * width + 1] = clamp(g[idx + 2 * width + 1]! + e * 3, 0, 255);
          if (x + 2 < width) g[idx + 2 * width + 2] = clamp(g[idx + 2 * width + 2]! + e * 1, 0, 255);
        }
      }
      ascii += `${line}\n`;
    }
    return ascii;
  }

  if (algorithm === 'stucki') {
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (shouldSkip(idx)) {
          line += ' ';
          continue;
        }
        let lev = Math.round((g[idx]! / 255) * (nLevels - 1));
        line += quantize(lev);
        const newPx = (lev / (nLevels - 1)) * 255;
        const err = g[idx]! - newPx;
        const e = err / 42;
        if (x + 1 < width) g[idx + 1] = clamp(g[idx + 1]! + e * 8, 0, 255);
        if (x + 2 < width) g[idx + 2] = clamp(g[idx + 2]! + e * 4, 0, 255);
        if (y + 1 < height) {
          if (x - 2 >= 0) g[idx - 2 + width] = clamp(g[idx - 2 + width]! + e * 2, 0, 255);
          if (x - 1 >= 0) g[idx - 1 + width] = clamp(g[idx - 1 + width]! + e * 4, 0, 255);
          g[idx + width] = clamp(g[idx + width]! + e * 8, 0, 255);
          if (x + 1 < width) g[idx + width + 1] = clamp(g[idx + width + 1]! + e * 4, 0, 255);
          if (x + 2 < width) g[idx + width + 2] = clamp(g[idx + width + 2]! + e * 2, 0, 255);
        }
        if (y + 2 < height) {
          if (x - 2 >= 0) g[idx - 2 + 2 * width] = clamp(g[idx - 2 + 2 * width]! + e * 1, 0, 255);
          if (x - 1 >= 0) g[idx - 1 + 2 * width] = clamp(g[idx - 1 + 2 * width]! + e * 2, 0, 255);
          g[idx + 2 * width] = clamp(g[idx + 2 * width]! + e * 4, 0, 255);
          if (x + 1 < width) g[idx + 2 * width + 1] = clamp(g[idx + 2 * width + 1]! + e * 2, 0, 255);
          if (x + 2 < width) g[idx + 2 * width + 2] = clamp(g[idx + 2 * width + 2]! + e * 1, 0, 255);
        }
      }
      ascii += `${line}\n`;
    }
    return ascii;
  }

  if (algorithm === 'noise') {
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (shouldSkip(idx)) {
          line += ' ';
          continue;
        }
        const noise = (Math.random() - 0.5) * (255 / nLevels);
        const noisy = clamp(g[idx]! + noise, 0, 255);
        const lev = Math.round((noisy / 255) * (nLevels - 1));
        line += quantize(lev);
      }
      ascii += `${line}\n`;
    }
    return ascii;
  }

  if (algorithm === 'ordered') {
    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    const ms = 4;
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (shouldSkip(idx)) {
          line += ' ';
          continue;
        }
        const p = g[idx]! / 255;
        const t = (bayer[y % ms]![x % ms]! + 0.5) / (ms * ms);
        let vd = p + t - 0.5;
        vd = clamp(vd, 0, 1);
        let lev = Math.floor(vd * nLevels);
        if (lev >= nLevels) lev = nLevels - 1;
        line += quantize(lev);
      }
      ascii += `${line}\n`;
    }
    return ascii;
  }

  // none
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (shouldSkip(idx)) {
        line += ' ';
        continue;
      }
      const lev = Math.round((g[idx]! / 255) * (nLevels - 1));
      line += quantize(lev);
    }
    ascii += `${line}\n`;
  }
  return ascii;
}
