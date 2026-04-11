import type { TonePalette } from './conversion-options';

/** Luminance → character ramps (subset: fine detail, blocks, binary, CP437, math). */
export const GRADIENT_BY_PALETTE: Record<TonePalette, string> = {
  'fine-detail':
    `$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\\"'^\`'.`,
  'block-shades': '█▓▒░ ',
  binary: '01',
  'dos-glyphs':
    ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■',
  math: '∫∑∏√∂∞≈≠≤≥±×÷‰∇∆0123456789+-*/^',
};

/** Ramp used to quantize luminance when char mode is not shaded (same as fine-detail). */
export const DEFAULT_QUANTIZE_PALETTE: TonePalette = 'fine-detail';

export function getGradientString(palette: TonePalette): string {
  return GRADIENT_BY_PALETTE[palette];
}

export function buildLevelsFromGradient(gradient: string, levelCount: number): string {
  const g = gradient.length ? gradient : '@ ';
  const count = Math.max(2, Math.min(levelCount, g.length));
  if (count === g.length) return g;
  const step = (g.length - 1) / (count - 1);
  let out = '';
  for (let i = 0; i < count; i++) out += g[Math.round(i * step)]!;
  return out;
}
