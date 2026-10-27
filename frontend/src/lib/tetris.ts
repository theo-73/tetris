export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z' | 'entropy';

export interface Point {
  x: number;
  y: number;
}

export interface Piece {
  type: PieceType;
  position: Point;
  rotation: number; // 0, 1, 2, 3
  shape: number[][];
}

export const COLS = 10;
export const ROWS = 20;
export const INITIAL_DROP_INTERVAL = 1000;
export const MIN_DROP_INTERVAL = 100;
export const SPEED_INCREMENT = 0.95;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;

export const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  entropy: [[1]],
};

export const COLORS: Record<PieceType | 'empty' | 'ghost', string> = {
  I: '#06b6d4', // Cyan
  J: '#3b82f6', // Blue
  L: '#f97316', // Orange
  O: '#eab308', // Yellow
  S: '#22c55e', // Green
  T: '#a855f7', // Purple
  Z: '#ef4444', // Red
  empty: '#111827',
  ghost: 'rgba(255, 255, 255, 0.25)',
  entropy: '#6b7280',
};

// Standard SRS Wall Kick Data
const WALL_KICKS_NORMAL = {
  '0-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1-0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1-2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3-2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3-0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const WALL_KICKS_I = {
  '0-1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1-0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1-2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2-1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2-3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3-2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3-0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0-3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export function rotate(matrix: number[][], dir: 'cw' | 'ccw' = 'cw'): number[][] {
  const n = matrix.length;
  const res = matrix.map((row) => [...row]);
  
  if (dir === 'cw') {
    for (let i = 0; i < n / 2; i++) {
      for (let j = i; j < n - i - 1; j++) {
        const temp = res[i][j];
        res[i][j] = res[n - 1 - j][i];
        res[n - 1 - j][i] = res[n - 1 - i][n - 1 - j];
        res[n - 1 - i][n - 1 - j] = res[j][n - 1 - i];
        res[j][n - 1 - i] = temp;
      }
    }
  } else {
    for (let i = 0; i < n / 2; i++) {
      for (let j = i; j < n - i - 1; j++) {
        const temp = res[i][j];
        res[i][j] = res[j][n - 1 - i];
        res[j][n - 1 - i] = res[n - 1 - i][n - 1 - j];
        res[n - 1 - i][n - 1 - j] = res[n - 1 - j][i];
        res[n - 1 - j][i] = temp;
      }
    }
  }
  return res;
}

export function isValidMove(
  grid: (PieceType | number)[][],
  piece: Piece,
  offset: Point = { x: 0, y: 0 },
  lockedCell: Point | null = null
): boolean {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = piece.position.x + x + offset.x;
        const newY = piece.position.y + y + offset.y;
        
        // Horizontal boundaries
        if (newX < 0 || newX >= COLS) return false;
        
        // Floor boundary
        if (newY >= ROWS) return false;
        
        // Collision with locked adversary cell
        if (lockedCell && newX === lockedCell.x && newY === lockedCell.y) return false;
        
        // Collision with placed blocks (only when inside the grid)
        if (newY >= 0 && grid[newY][newX] !== 0) return false;
      }
    }
  }
  return true;
}

export function getWallKicks(type: PieceType, fromRot: number, toRot: number): number[][] {
  const key = `${fromRot}-${toRot}` as keyof typeof WALL_KICKS_NORMAL;
  if (type === 'I') return WALL_KICKS_I[key] || [[0, 0]];
  if (type === 'O') return [[0, 0]];
  return WALL_KICKS_NORMAL[key] || [[0, 0]];
}

// 7-Bag Randomizer utility for offline / fallback mode
export class SevenBag {
  private bag: PieceType[] = [];

  next(): PieceType {
    if (this.bag.length === 0) {
      const standard: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
      for (let i = standard.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [standard[i], standard[j]] = [standard[j], standard[i]];
      }
      this.bag = standard;
    }
    return this.bag.pop()!;
  }
}
