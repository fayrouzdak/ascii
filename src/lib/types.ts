export interface AsciiCell {
  char: string;
  col: number;
  row: number;
  targetX: number;
  targetY: number;
  brightness: number;
  opacity: number;
  color: string;
}

export interface GridConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  /** Unzoomed coords: center of the ASCII grid (display zoom pivots around canvas center here). */
  anchorX: number;
  anchorY: number;
}
