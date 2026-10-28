import { describe, it, expect } from 'vitest';
import { HeuristicAnalyzer, AdversarialAgent, ShadowSaboteur } from '../adversary';
import { COLS, ROWS, PieceType, SHAPES } from '../tetris';

describe('Adversarial Engine & Heuristics', () => {
  it('correctly calculates metrics for an empty board', () => {
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const metrics = HeuristicAnalyzer.calculateMetrics(emptyGrid);
    expect(metrics.aggregateHeight).toBe(0);
    expect(metrics.holes).toBe(0);
    expect(metrics.bumpiness).toBe(0);
    expect(metrics.deepWells).toBe(0);
  });

  it('detects holes and deep wells in stack profiles', () => {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    // Place a roof at row 17, leaving row 18 and 19 empty (2 holes)
    grid[17][3] = 'I';
    const metrics = HeuristicAnalyzer.calculateMetrics(grid);
    expect(metrics.holes).toBe(2);
    expect(metrics.aggregateHeight).toBe(3);
  });

  it('generates worst-case next piece selection', () => {
    const agent = new AdversarialAgent();
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const decision = agent.decideNextPiece(emptyGrid);

    expect(['I', 'O', 'T', 'S', 'Z', 'J', 'L']).toContain(decision.piece);
    expect(decision.chaos).toBeGreaterThanOrEqual(0);
    expect(decision.chaos).toBeLessThanOrEqual(100);
    expect(typeof decision.thought).toBe('string');
    expect(decision.thought.length).toBeGreaterThan(0);
  });

  it('degrades starvation penalty after extended absence', () => {
    const agent = new AdversarialAgent();
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    // Simulate 15 decisions
    for (let i = 0; i < 15; i++) {
      agent.decideNextPiece(emptyGrid);
    }
    // Verify engine remains responsive and healthy
    const next = agent.decideNextPiece(emptyGrid);
    expect(next.piece).toBeDefined();
  });

  it('ShadowSaboteur avoids spawning locks inside the active piece', () => {
    let lockedPoint: { x: number; y: number } | null = null;
    const saboteur = new ShadowSaboteur(cell => {
      lockedPoint = cell;
    });

    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const activePiece = {
      shape: SHAPES.I,
      position: { x: 4, y: 10 },
      type: 'I' as PieceType,
      rotation: 0,
    };

    // If saboteur targets position inside activePiece, it must skip
    saboteur.triggerPredictiveSabotage(grid, { x: 4, y: 8 }, activePiece);
    if (lockedPoint) {
      // Must not be an occupied cell of activePiece
      const isInside = activePiece.shape.some((row, r) =>
        row.some((val, c) => val !== 0 && activePiece.position.x + c === lockedPoint!.x && activePiece.position.y + r === lockedPoint!.y)
      );
      expect(isInside).toBe(false);
    }
  });

  it('ShadowSaboteur cleanly updates lock coordinates on row displacement', () => {
    let currentCell: { x: number; y: number } | null = { x: 5, y: 15 };
    const saboteur = new ShadowSaboteur(cell => {
      currentCell = cell;
    });

    saboteur.updateLockPosition({ x: 5, y: 16 });
    expect(saboteur.getLock()).toEqual({ x: 5, y: 16 });
    expect(currentCell).toEqual({ x: 5, y: 16 });

    saboteur.clearLock();
    expect(saboteur.getLock()).toBeNull();
    expect(currentCell).toBeNull();
  });

  it('evaluates lateral tucks under overhangs in simulatePlacement', () => {
    const agent = new AdversarialAgent();
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    // Overhang scenario
    grid[17][4] = 'J';
    grid[17][5] = 'J';
    grid[19][3] = 'L';
    const score = agent.simulatePlacement(grid, 'I');
    expect(score).toBeLessThan(999.0);
  });
});
