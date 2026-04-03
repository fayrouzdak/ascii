import type { AsciiCell, GridConfig } from './types';

// Full block unicode at the bright end gives the look from the screenshots (solid white squares)
const FULL_RAMP = ' .,:;i1tfLCG08@█';

export function buildRamp(density: number): string {
  const count = Math.max(3, Math.min(density, FULL_RAMP.length));
  if (count === FULL_RAMP.length) return FULL_RAMP;
  // Evenly sample from the ramp so sparse densities still span dark-to-bright
  const step = (FULL_RAMP.length - 1) / (count - 1);
  let ramp = '';
  for (let i = 0; i < count; i++) {
    ramp += FULL_RAMP[Math.round(i * step)];
  }
  return ramp;
}

export function convertImageToAscii(
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  density: number,
): { cells: AsciiCell[]; grid: GridConfig } {
  const fontSize = 11;
  // Monospace characters are roughly 0.6× as wide as they are tall
  const cellWidth = fontSize * 0.6;
  const cellHeight = fontSize * 1.1;

  const cols = Math.floor(canvasWidth / cellWidth);
  const rows = Math.floor(canvasHeight / cellHeight);

  const grid: GridConfig = { cols, rows, cellWidth, cellHeight, fontSize };

  // Draw image onto an offscreen canvas to read pixel data
  const offscreen = document.createElement('canvas');
  offscreen.width = cols;
  offscreen.height = rows;
  const ctx = offscreen.getContext('2d')!;

  // Fit image inside the grid preserving aspect ratio
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const gridAspect = (cols * cellWidth) / (rows * cellHeight);
  let drawCols = cols;
  let drawRows = rows;
  let offsetCol = 0;
  let offsetRow = 0;

  if (imgAspect > gridAspect) {
    drawRows = Math.floor(cols / imgAspect * (cellWidth / cellHeight));
    offsetRow = Math.floor((rows - drawRows) / 2);
  } else {
    drawCols = Math.floor(rows * imgAspect * (cellHeight / cellWidth));
    offsetCol = Math.floor((cols - drawCols) / 2);
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cols, rows);
  ctx.drawImage(img, offsetCol, offsetRow, drawCols, drawRows);

  const imageData = ctx.getImageData(0, 0, cols, rows);
  const ramp = buildRamp(density);
  const cells: AsciiCell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      const r = imageData.data[idx]!;
      const g = imageData.data[idx + 1]!;
      const b = imageData.data[idx + 2]!;
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      const charIdx = Math.floor(brightness * (ramp.length - 1));
      const char = ramp[charIdx]!;

      const targetX = col * cellWidth;
      const targetY = row * cellHeight + cellHeight;

      cells.push({
        char,
        displayChar: char,
        col,
        row,
        targetX,
        targetY,
        currentX: targetX,
        currentY: targetY,
        brightness,
        opacity: 1,
        vx: 0,
        vy: 0,
      });
    }
  }

  return { cells, grid };
}
