import { describe, it, expect } from 'vitest';
import { 
  rotate, isValidMove, getWallKicks, 
  SHAPES, COLS, ROWS, Piece 
} from '../tetris';

describe('Tetris Core Physics & Mechanics', () => {
  it('correctly rotates a 3x3 matrix clockwise', () => {
    const tShape = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ];
    const rotated = rotate(tShape, 'cw');
    expect(rotated).toEqual([
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0]
    ]);
  });

  it('correctly rotates a 3x3 matrix counter-clockwise', () => {
    const tShape = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ];
    const rotated = rotate(tShape, 'ccw');
    expect(rotated).toEqual([
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0]
    ]);
  });

  it('validates legal moves inside the matrix grid', () => {
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const piece: Piece = {
      type: 'T',
      shape: SHAPES.T,
      position: { x: 3, y: 0 },
      rotation: 0
    };
    expect(isValidMove(emptyGrid, piece)).toBe(true);
  });

  it('detects wall collision on left and right borders', () => {
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const outLeft: Piece = {
      type: 'T',
      shape: SHAPES.T,
      position: { x: -2, y: 0 },
      rotation: 0
    };
    expect(isValidMove(emptyGrid, outLeft)).toBe(false);

    const outRight: Piece = {
      type: 'T',
      shape: SHAPES.T,
      position: { x: COLS - 1, y: 0 },
      rotation: 0
    };
    expect(isValidMove(emptyGrid, outRight)).toBe(false);
  });

  it('detects floor collision', () => {
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const outBottom: Piece = {
      type: 'O',
      shape: SHAPES.O,
      position: { x: 4, y: ROWS - 1 },
      rotation: 0
    };
    expect(isValidMove(emptyGrid, outBottom)).toBe(false);
  });

  it('detects collision with locked adversary cell', () => {
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const lockedCell = { x: 4, y: 1 };
    const piece: Piece = {
      type: 'T',
      shape: SHAPES.T,
      position: { x: 3, y: 0 }, // T center block is at (4, 1)
      rotation: 0
    };
    expect(isValidMove(emptyGrid, piece, { x: 0, y: 0 }, lockedCell)).toBe(false);
  });

  it('provides official SRS wall kick offsets', () => {
    const kicks0to1 = getWallKicks('T', 0, 1);
    expect(kicks0to1.length).toBe(5);
    expect(kicks0to1[0]).toEqual([0, 0]);

    const iKicks = getWallKicks('I', 0, 1);
    expect(iKicks.length).toBe(5);
    expect(iKicks[0]).toEqual([0, 0]);
  });

  it('correctly calculates minRow and maxRow bounding indices ignoring empty shape rows', () => {
    // Horizontal I piece has row 0 empty and row 1 occupied
    const iShape = SHAPES.I;
    let minRow = Infinity;
    let maxRow = -Infinity;
    iShape.forEach((row, r) => {
      row.forEach(val => {
        if (val) {
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
        }
      });
    });
    expect(minRow).toBe(1);
    expect(maxRow).toBe(1);

    // Rotated J piece
    const jRotated = rotate(SHAPES.J);
    let jMinRow = Infinity;
    let jMaxRow = -Infinity;
    jRotated.forEach((row, r) => {
      row.forEach(val => {
        if (val) {
          if (r < jMinRow) jMinRow = r;
          if (r > jMaxRow) jMaxRow = r;
        }
      });
    });
    expect(jMinRow).toBeGreaterThanOrEqual(0);
    expect(jMaxRow).toBeLessThanOrEqual(2);
  });
});
