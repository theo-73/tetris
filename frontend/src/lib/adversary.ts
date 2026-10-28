import { PieceType, Point, SHAPES, COLS, ROWS, rotate } from './tetris';

export interface HeuristicMetrics {
  aggregateHeight: number;
  holes: number;
  bumpiness: number;
}

export interface AdversarialDecision {
  piece: PieceType;
  chaos: number;
  thought: string;
}

export class HeuristicAnalyzer {
  static calculateMetrics(grid: (PieceType | number)[][]): HeuristicMetrics {
    const rows = grid.length;
    const cols = grid[0].length;
    const heights: number[] = new Array(cols).fill(0);
    let holes = 0;

    // Single-pass column height and hole detection
    for (let c = 0; c < cols; c++) {
      let blockFound = false;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] !== 0) {
          if (!blockFound) {
            heights[c] = rows - r;
            blockFound = true;
          }
        } else if (blockFound) {
          holes++;
        }
      }
    }

    const aggregateHeight = heights.reduce((sum, h) => sum + h, 0);

    // Adjacent column bumpiness
    let bumpiness = 0;
    for (let i = 0; i < cols - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }

    return {
      aggregateHeight,
      holes,
      bumpiness,
    };
  }
}

export class AdversarialAgent {
  private pieces: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  private history: PieceType[] = [];

  reset(): void {
    this.history = [];
  }

  private isValid(grid: (PieceType | number)[][], shape: number[][], x: number, y: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const boardY = y + r;
          const boardX = x + c;

          if (boardY < 0) continue; // Allow spawning above well
          if (boardY >= ROWS || boardX < 0 || boardX >= COLS) return false;
          if (grid[boardY][boardX] !== 0) return false;
        }
      }
    }
    return true;
  }

  simulatePlacement(grid: (PieceType | number)[][], pieceType: PieceType): number {
    const shape = SHAPES[pieceType];
    let bestPlayerScore = Infinity;

    // Test all 4 rotations
    let currentShape = shape;
    for (let rot = 0; rot < 4; rot++) {
      // Find active column boundaries
      const activeCols: number[] = [];
      for (let r = 0; r < currentShape.length; r++) {
        for (let c = 0; c < currentShape[r].length; c++) {
          if (currentShape[r][c]) activeCols.push(c);
        }
      }

      if (activeCols.length === 0) {
        currentShape = rotate(currentShape);
        continue;
      }

      const minC = Math.min(...activeCols);
      const maxC = Math.max(...activeCols);

      // Shift x so active columns stay within [0, COLS - 1]
      for (let x = -minC; x <= COLS - 1 - maxC; x++) {
        if (!this.isValid(grid, currentShape, x, 0)) continue;

        // Drop piece to lowest valid row
        let y = 0;
        while (this.isValid(grid, currentShape, x, y + 1)) {
          y++;
        }

        // Place piece on virtual grid
        const tempGrid = grid.map(row => [...row]);
        for (let r = 0; r < currentShape.length; r++) {
          for (let c = 0; c < currentShape[r].length; c++) {
            if (currentShape[r][c] && y + r < ROWS && x + c >= 0 && x + c < COLS) {
              tempGrid[y + r][x + c] = 1;
            }
          }
        }

        // Simulate row clearing
        const survivingRows = tempGrid.filter(row => !row.every(cell => cell !== 0));
        const linesCleared = ROWS - survivingRows.length;
        const postClearGrid = [
          ...Array.from({ length: linesCleared }, () => Array(COLS).fill(0)),
          ...survivingRows
        ];

        const metrics = HeuristicAnalyzer.calculateMetrics(postClearGrid);

        // Player seeks to minimize height, holes, bumpiness, while clearing lines
        const playerScore = (
          metrics.aggregateHeight * 0.5 +
          metrics.holes * 4.0 +
          metrics.bumpiness * 1.0 -
          linesCleared * 12.0
        );

        if (playerScore < bestPlayerScore) {
          bestPlayerScore = playerScore;
        }
      }

      currentShape = rotate(currentShape);
      if (pieceType === 'O') break; // Symmetric piece optimization
    }

    return bestPlayerScore === Infinity ? 999.0 : bestPlayerScore;
  }

  decideNextPiece(board: (PieceType | number)[][]): AdversarialDecision {
    const metrics = HeuristicAnalyzer.calculateMetrics(board);
    const pieceCounts: Record<PieceType, number> = {
      I: 0, J: 0, L: 0, O: 0, S: 0, T: 0, Z: 0, entropy: 0
    };
    for (const p of this.history) {
      pieceCounts[p] = (pieceCounts[p] || 0) + 1;
    }

    // Mercy Protocol: occasionally relief if stack reaches critical altitude
    let isMercy = false;
    if (metrics.aggregateHeight > 130 && Math.random() < 0.35) {
      isMercy = true;
    }

    let bestPiece: PieceType = isMercy ? 'I' : 'T';
    let maxAdversarialScore = -Infinity;

    if (!isMercy) {
      for (const piece of this.pieces) {
        const bestPlayerScore = this.simulatePlacement(board, piece);
        let adversarialScore = bestPlayerScore;

        // Starvation logic: suppress helpful pieces not seen recently
        if ((pieceCounts[piece] || 0) === 0 && bestPlayerScore < 12.0) {
          adversarialScore *= 0.25;
        }

        // Diversity damping: penalize repeated pieces
        const repeatPenalty = (pieceCounts[piece] || 0) * 2.5;
        adversarialScore -= repeatPenalty;

        // Subtle entropy noise
        adversarialScore += (Math.random() - 0.5) * 0.3;

        if (adversarialScore > maxAdversarialScore) {
          maxAdversarialScore = adversarialScore;
          bestPiece = piece;
        }
      }
    } else {
      maxAdversarialScore = 0.0;
    }

    // Update history
    this.history.push(bestPiece);
    if (this.history.length > 12) {
      this.history.shift();
    }

    // Reactive Agent Intel Thoughts
    const thoughts = [
      'Calculating optimal disruption vectors...',
      'Visualizing your failure. Convergence complete.',
      'Analyzing hardware weaknesses...',
      'Heuristic thresholds exceeded. Chaos imminent.',
    ];

    if (metrics.holes > 4) {
      thoughts.push(`Detected ${metrics.holes} system vulnerabilities. Processing purge...`);
    }
    if (metrics.bumpiness > 12) {
      thoughts.push('Structural instability confirmed. Well-dependency noted.');
    }
    if (metrics.aggregateHeight > 80) {
      thoughts.push('Atmospheric pressure rising. Critical altitude reached.');
    }

    let chosenThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    if (isMercy) {
      chosenThought = 'Mercy protocol active. For now...';
    }

    const chaosMeter = Math.min(100, Math.max(0, Math.floor((maxAdversarialScore / 50.0) * 100)));

    return {
      piece: bestPiece,
      chaos: chaosMeter,
      thought: chosenThought,
    };
  }
}

// Client-side Shadow Saboteur for predictive and timed locks
export class ShadowSaboteur {
  private lockedCell: Point | null = null;
  private lockId = 0;
  private onLockChange: (cell: Point | null) => void;

  constructor(onLockChange: (cell: Point | null) => void) {
    this.onLockChange = onLockChange;
  }

  getLock(): Point | null {
    return this.lockedCell;
  }

  clearLock(): void {
    this.lockId++;
    this.lockedCell = null;
    this.onLockChange(null);
  }

  // Periodic shadow loop
  triggerPeriodicSabotage(grid: (PieceType | number)[][], lastPos: Point): void {
    if (this.lockedCell) return;

    const targetY = Math.min(19, Math.max(0, lastPos.y + Math.floor(Math.random() * 3) + 1));
    const targetX = Math.min(9, Math.max(0, lastPos.x + Math.floor(Math.random() * 3) - 1));

    if (grid[targetY] && grid[targetY][targetX] === 0) {
      this.lockId++;
      const currentCid = this.lockId;
      this.lockedCell = { x: targetX, y: targetY };
      this.onLockChange(this.lockedCell);

      setTimeout(() => {
        if (this.lockId === currentCid) {
          this.clearLock();
        }
      }, 4000);
    }
  }

  // Live predictive sabotage on falling pieces
  triggerPredictiveSabotage(grid: (PieceType | number)[][], activePos: Point): void {
    if (this.lockedCell || activePos.y <= 8) return;

    // Deterministic trigger check
    if (Math.random() < 0.15) {
      const tx = Math.max(0, Math.min(9, activePos.x));
      const ty = Math.max(0, Math.min(19, activePos.y + 2));

      if (grid[ty] && grid[ty][tx] === 0) {
        this.lockId++;
        const currentCid = this.lockId;
        this.lockedCell = { x: tx, y: ty };
        this.onLockChange(this.lockedCell);

        setTimeout(() => {
          if (this.lockId === currentCid) {
            this.clearLock();
          }
        }, 2500);
      }
    }
  }
}
