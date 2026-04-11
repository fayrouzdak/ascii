/** Conversion options for image → ASCII. */

/** How characters are chosen per cell */
export type CharMode =
  /** Luminance → tone palette (below) */
  | 'shaded'
  /** Random glyph where the image is visible */
  | 'random'
  /** Letter X where visible */
  | 'cross'
  /** Dot dither */
  | 'dots';

/** Character ramp used only when {@link CharMode} is `shaded` */
export type TonePalette =
  | 'fine-detail'
  | 'block-shades'
  | 'binary'
  | 'dos-glyphs'
  | 'math';

export interface ConversionOptions {
  /** Characters wide (grid columns), 1–100 */
  outputCols: number;
  /** Additive brightness after contrast, roughly -127…127 */
  brightness: number;
  /** Centered contrast, roughly -127…127 (CodePen-style) */
  contrast: number;
  /** 0–100 (%), 100 = unchanged */
  saturation: number;
  /** Degrees 0–360 */
  hue: number;
  /** Full color invert */
  invert: boolean;
  blur: number;
  /** 0–20 sharpness (unsharp on luminance) */
  sharpness: number;
  charMode: CharMode;
  /** Used when `charMode === 'shaded'` */
  tonePalette: TonePalette;
  ignoreWhite: boolean;
  /** Display zoom 1–100 (%) */
  zoom: number;
  /** Hex color for ASCII characters (canvas / PNG text; canvas background matches page) */
  pictureForeground: string;
}

export const defaultConversionOptions = (): ConversionOptions => ({
  outputCols: 100,
  brightness: 0,
  contrast: 0,
  saturation: 100,
  hue: 0,
  invert: false,
  blur: 0,
  sharpness: 9,
  charMode: 'shaded',
  tonePalette: 'fine-detail',
  ignoreWhite: false,
  zoom: 100,
  pictureForeground: '#8b91d4',
});
