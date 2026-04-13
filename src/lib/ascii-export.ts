import { GIFEncoder } from 'gifenc';
import { FONT_FAMILY } from './font-metrics';

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAsciiText(text: string, filename = 'ascii-art.txt'): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(URL.createObjectURL(blob), filename);
}

const LINE_HEIGHT_MULT = 1.15;

export type AsciiExportCanvasOpts = {
  pictureForeground: string;
  scale?: number;
};

/** Rasterize ASCII text to a canvas; shared by PNG and animated GIF export. */
export function createAsciiExportCanvas(text: string, opts: AsciiExportCanvasOpts): HTMLCanvasElement | null {
  const trimmed = text.trimEnd();
  if (!trimmed) return null;

  const lines = trimmed.split('\n');
  const scaleFactor = opts.scale ?? 6;
  const fontSize = 7 * scaleFactor;
  const lineHeight = fontSize * LINE_HEIGHT_MULT;
  const font = `${fontSize}px ${FONT_FAMILY}`;

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;
  let maxWidth = 0;
  for (const line of lines) {
    const w = measure.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  }

  const canvasWidth = Math.ceil(maxWidth);
  const canvasHeight = Math.ceil(lines.length * lineHeight);

  const off = document.createElement('canvas');
  off.width = canvasWidth;
  off.height = canvasHeight;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = opts.pictureForeground;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, 0, i * lineHeight);
  }

  return off;
}

export function downloadAsciiPng(text: string, opts: AsciiExportCanvasOpts): void {
  const off = createAsciiExportCanvas(text, opts);
  if (!off) return;

  off.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(URL.createObjectURL(blob), 'ascii-art.png');
  }, 'image/png');
}

export function downloadGifBytes(bytes: Uint8Array, filename = 'ascii-art.gif'): void {
  const blob = new Blob([bytes], { type: 'image/gif' });
  triggerDownload(URL.createObjectURL(blob), filename);
}

function parseHexColor(hex: string): [number, number, number] {
  const n = hex.replace('#', '').trim();
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Encode canvases as an animated GIF with a transparent background.
 * Uses a crisp 2-color palette (foreground + transparent) with alpha
 * thresholding so text edges are sharp rather than blurry.
 */
export function encodeAsciiCanvasesToGif(
  frames: { canvas: HTMLCanvasElement; delayMs: number }[],
  foregroundHex: string,
): Uint8Array {
  if (frames.length === 0) return new Uint8Array();

  const [fr, fg, fb] = parseHexColor(foregroundHex);
  const palette = [[fr, fg, fb], [0, 0, 0]];
  const TRANSPARENT_IDX = 1;
  const ALPHA_THRESHOLD = 80;

  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    const { canvas, delayMs } = frames[i]!;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const { width, height } = canvas;
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const pixelCount = width * height;
    const index = new Uint8Array(pixelCount);

    for (let p = 0; p < pixelCount; p++) {
      index[p] = rgba[p * 4 + 3]! > ALPHA_THRESHOLD ? 0 : TRANSPARENT_IDX;
    }

    gif.writeFrame(index, width, height, {
      palette,
      delay: delayMs,
      repeat: i === 0 ? 0 : undefined,
      transparent: true,
      transparentIndex: TRANSPARENT_IDX,
      dispose: 2,
    });
  }

  gif.finish();
  return gif.bytes();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let _cachedFontBase64: string | null = null;

async function fetchVT323Base64(): Promise<string> {
  if (_cachedFontBase64) return _cachedFontBase64;

  const cssRes = await fetch(
    'https://fonts.googleapis.com/css2?family=VT323&display=swap',
    { headers: { Accept: 'text/css' } },
  );
  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.woff2[^)]*)\)/);
  if (!urlMatch) throw new Error('Could not find VT323 woff2 URL');

  const fontUrl = urlMatch[1]!.replace(/['"]/g, '');
  const fontRes = await fetch(fontUrl);
  const buf = await fontRes.arrayBuffer();

  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  _cachedFontBase64 = btoa(binary);
  return _cachedFontBase64;
}

export async function downloadAsciiSvg(
  text: string,
  opts: {
    pictureForeground: string;
  },
): Promise<void> {
  const trimmed = text.trimEnd();
  if (!trimmed) return;

  const fontBase64 = await fetchVT323Base64();

  const lines = trimmed.split('\n');
  const fontSize = 28;
  const lineHeight = fontSize * LINE_HEIGHT_MULT;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `${fontSize}px ${FONT_FAMILY}`;
  let maxWidth = 0;
  for (const line of lines) {
    const w = measure.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  }

  const svgWidth = Math.ceil(maxWidth);
  const svgHeight = Math.ceil(lines.length * lineHeight);

  const tspans = lines
    .map((line, i) => {
      const y = fontSize + i * lineHeight;
      return `<tspan x="0" y="${y}">${escapeXml(line) || ' '}</tspan>`;
    })
    .join('\n    ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <style>
      @font-face {
        font-family: 'VT323';
        src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
        font-weight: 400;
        font-style: normal;
      }
    </style>
  </defs>
  <text
    font-family="'VT323', monospace"
    font-size="${fontSize}"
    fill="${escapeXml(opts.pictureForeground)}"
    xml:space="preserve"
    style="white-space:pre"
  >
    ${tspans}
  </text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(URL.createObjectURL(blob), 'ascii-art.svg');
}
