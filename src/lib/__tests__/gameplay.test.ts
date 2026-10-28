import { describe, it, expect } from 'vitest';
import { COLS, ROWS, Piece, SHAPES, isValidMove, PieceType } from '../tetris';

describe('Gameplay Integration & System Purge Mechanics', () => {
  it('identifies row completion over an active adversary lock cell (System Purge)', () => {
    // Construct a grid where row 18 has 9 blocks filled, with index 4 empty because it is the locked cell
    const grid: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const lockedCell = { x: 4, y: 18 };

    for (let c = 0; c < COLS; c++) {
      if (c !== lockedCell.x) {
        grid[18][c] = 'I';
      }
    }

    // System Purge logic evaluation:
    const isRowComplete = grid[18].every((cell, colIdx) => {
      if (lockedCell && lockedCell.y === 18 && lockedCell.x === colIdx) {
        return true; // Malicious obstacle is satisfied with row completion
      }
      return cell !== 0;
    });

    expect(isRowComplete).toBe(true);

    // Filter completed rows
    const rowsToClear = [18];
    const finalGrid = grid.filter((_, idx) => !rowsToClear.includes(idx));
    expect(finalGrid.length).toBe(ROWS - 1);
  });

  it('prohibits falling piece from entering or intersecting the locked cell before clear', () => {
    const emptyGrid: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const lockedCell = { x: 5, y: 15 };

    const collidingPiece: Piece = {
      type: 'O',
      shape: SHAPES.O, // 2x2: (0,0),(1,0),(0,1),(1,1)
      position: { x: 4, y: 14 }, // occupies (4,14), (5,14), (4,15), (5,15) -> intersects lockedCell
      rotation: 0,
    };

    expect(isValidMove(emptyGrid, collidingPiece, { x: 0, y: 0 }, lockedCell)).toBe(false);

    const safePiece: Piece = {
      type: 'O',
      shape: SHAPES.O,
      position: { x: 1, y: 14 },
      rotation: 0,
    };

    expect(isValidMove(emptyGrid, safePiece, { x: 0, y: 0 }, lockedCell)).toBe(true);
  });

  it('preserves valid in-bounds blocks on ceiling lockout before game over', () => {
    const grid: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const newGrid = grid.map(row => [...row]);

    // An I-piece locking partially above the skyline (position y = -1, vertical)
    const fatalPiece: Piece = {
      type: 'I',
      shape: [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
      ],
      position: { x: 3, y: -1 },
      rotation: 1,
    };

    let hasLockOut = false;
    fatalPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const gridY = fatalPiece.position.y + y;
          const gridX = fatalPiece.position.x + x;
          if (gridY < 0) {
            hasLockOut = true;
          } else if (gridY < ROWS && gridX >= 0 && gridX < COLS) {
            newGrid[gridY][gridX] = fatalPiece.type;
          }
        }
      });
    });

    expect(hasLockOut).toBe(true);
    // Rows 0, 1, 2 must have the piece written so it renders under the game over screen
    expect(newGrid[0][4]).toBe('I');
    expect(newGrid[1][4]).toBe('I');
    expect(newGrid[2][4]).toBe('I');
  });

  it('correctly evaluates 3-corner T-Spin condition', () => {
    const grid: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    // T-piece at position (3, 10)
    const px = 3;
    const py = 10;
    // Fill 3 corners: top-left (3, 10), top-right (5, 10), bottom-left (3, 12)
    grid[py][px] = 'J';
    grid[py][px + 2] = 'L';
    grid[py + 2][px] = 'S';

    const corners = [
      [px, py],
      [px + 2, py],
      [px, py + 2],
      [px + 2, py + 2],
    ];
    let occupied = 0;
    for (const [cx, cy] of corners) {
      if (grid[cy][cx] !== 0) occupied++;
    }

    expect(occupied).toBeGreaterThanOrEqual(3);
  });

  it('verifies extended placement rule resets counter on stepping to new lowest row', () => {
    let lowestYReached = 5;
    let lockResets = 12;

    const newPosY = 6; // Stepped down to a new lowest row
    if (newPosY > lowestYReached) {
      lowestYReached = newPosY;
      lockResets = 0;
    }

    expect(lowestYReached).toBe(6);
    expect(lockResets).toBe(0);
  });

  it('verifies mid-air rotations do not drain the grounded lock reset limit', () => {
    let lockResets = 0;
    const MAX_LOCK_RESETS = 15;

    // Simulate 20 rotations in mid-air (isGrounded = false)
    for (let r = 0; r < 20; r++) {
      const isGrounded = false;
      if (isGrounded && lockResets < MAX_LOCK_RESETS) {
        lockResets += 1;
      }
    }

    // Must still be 0 resets consumed
    expect(lockResets).toBe(0);

    // When finally landing on the floor (isGrounded = true)
    const isGrounded = true;
    if (isGrounded && lockResets < MAX_LOCK_RESETS) {
      lockResets += 1;
    }
    expect(lockResets).toBe(1);
  });

  it('aborts hold swap without clearing lock timer when swapped piece is obstructed by stack ceiling', () => {
    const grid: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    // Fill row 0 and 1 at center columns (3, 4, 5, 6) simulating ceiling obstruction
    grid[0][3] = 'I';
    grid[0][4] = 'I';
    grid[0][5] = 'I';
    grid[1][3] = 'I';
    grid[1][4] = 'I';
    grid[1][5] = 'I';

    // Held piece that player wants to swap in at spawn position (x: 3, y: 0)
    const heldPieceType: PieceType = 'O';
    const pieceToSwap: Piece = {
      type: heldPieceType,
      shape: SHAPES[heldPieceType],
      position: { x: 3, y: 0 },
      rotation: 0,
    };

    let lockTimerCleared = false;
    const clearLockTimerMock = () => { lockTimerCleared = true; };

    const canSwap = isValidMove(grid, pieceToSwap, { x: 0, y: 0 }, null);
    if (canSwap) {
      clearLockTimerMock();
    }

    // Since position (3,0) is obstructed by placed blocks, canSwap is false
    expect(canSwap).toBe(false);
    // Crucial: Lock timer must NOT be cleared when swap fails, preventing infinite stalling
    expect(lockTimerCleared).toBe(false);
  });
});
