export interface AsciiCell {
  char: string;
  displayChar: string;
  col: number;
  row: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  brightness: number;
  opacity: number;
  vx: number;
  vy: number;
}

export type EffectType = 'none' | 'assembly' | 'wave' | 'mouse-react' | 'cycle';

export interface GridConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
}

export interface EffectUpdateState {
  mouseX: number;
  mouseY: number;
  time: number;
  speed: number;
  deltaTime: number;
}

export interface Effect {
  name: string;
  label: string;
  init(cells: AsciiCell[], grid: GridConfig): void;
  update(cells: AsciiCell[], grid: GridConfig, state: EffectUpdateState): void;
}
