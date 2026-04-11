/** Export ASCII as PNG (CodePen-style) or plain text (ascii.eu). */

import { getPageBackgroundColor } from './page-background';

export function downloadAsciiText(text: string, filename = 'ascii-art.txt'): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadAsciiPng(
  text: string,
  opts: {
    pictureForeground: string;
    /** Transparent PNG margin; omitted or 0 uses page background behind text */
    transparentFrame?: number;
    scale?: number;
  },
): void {
  const trimmed = text.trimEnd();
  if (!trimmed) return;

  const frame = opts.transparentFrame ?? 0;
  const lines = trimmed.split('\n');
  const scaleFactor = opts.scale ?? 2;
  const borderMargin = 20 * scaleFactor + Math.max(0, frame) * scaleFactor;
  const baseFontSize = 7 * scaleFactor;
  const fontSize = baseFontSize;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.font = `${fontSize}px Consolas, Monaco, "Liberation Mono", monospace`;

  let maxLineWidth = 0;
  for (let i = 0; i < lines.length; i++) {
    const w = tempCtx.measureText(lines[i]!).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const lineHeight = fontSize;
  const textWidth = Math.ceil(maxLineWidth);
  const textHeight = Math.ceil(lines.length * lineHeight);

  const canvasWidth = textWidth + 2 * borderMargin;
  const canvasHeight = textHeight + 2 * borderMargin;
  const off = document.createElement('canvas');
  off.width = canvasWidth;
  off.height = canvasHeight;
  const ctx = off.getContext('2d')!;

  if (frame > 0) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.fillStyle = getPageBackgroundColor();
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.font = `${fontSize}px Consolas, Monaco, "Liberation Mono", monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = opts.pictureForeground;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, borderMargin, borderMargin + i * lineHeight);
  }

  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ascii-art.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
