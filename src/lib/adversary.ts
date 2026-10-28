import { PieceType, Point, SHAPES, COLS, ROWS, rotate } from './tetris';

export interface HeuristicMetrics {
  aggregateHeight: number;
  holes: number;
  bumpiness: number;
  deepWells: number;
}

export interface AdversarialDecision {
  piece: PieceType;
  chaos: number;
  thought: string;
}

export interface ActivePieceLike {
  shape: number[][];
  position: Point;
  type?: PieceType;
  rotation?: number;
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

    // Issue 25: Surface Cavities & Deep Wells (1-column chasms of depth >= 3)
    let deepWells = 0;
    for (let c = 0; c < cols; c++) {
      const leftH = c > 0 ? heights[c - 1] : rows;
      const rightH = c < cols - 1 ? heights[c + 1] : rows;
      const wellDepth = Math.min(leftH, rightH) - heights[c];
      if (wellDepth >= 3) {
        deepWells += wellDepth;
      }
    }

    return {
      aggregateHeight,
      holes,
      bumpiness,
      deepWells,
    };
  }
}

export class AdversarialAgent {
  private pieces: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  private history: PieceType[] = [];
  private turnsSinceDealt: Record<PieceType, number> = {
    I: 0, J: 0, L: 0, O: 0, S: 0, T: 0, Z: 0, entropy: 0
  };

  // Issue 10 Fix: Pre-allocated scratch grid for zero-allocation in-place placement simulation
  private scratchGrid: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

  reset(): void {
    this.history = [];
    this.pieces.forEach(p => {
      this.turnsSinceDealt[p] = 0;
    });
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

    // Issue 21: Rotational Symmetry Pruning (O: 1 rot; I, S, Z: 2 rots; J, L, T: 4 rots)
    const maxRotations = pieceType === 'O' ? 1 : (pieceType === 'I' || pieceType === 'S' || pieceType === 'Z') ? 2 : 4;

    let currentShape = shape;
    for (let rot = 0; rot < maxRotations; rot++) {
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

      for (let x = -minC; x <= COLS - 1 - maxC; x++) {
        if (!this.isValid(grid, currentShape, x, 0)) continue;

        let y = 0;
        while (this.isValid(grid, currentShape, x, y + 1)) {
          y++;
        }

        // Candidate positions include vertical drop plus 1-step lateral tucks under overhangs
        const candidatePlacements: { x: number; y: number }[] = [{ x, y }];
        if (x > -minC && this.isValid(grid, currentShape, x - 1, y)) {
          candidatePlacements.push({ x: x - 1, y });
        }
        if (x < COLS - 1 - maxC && this.isValid(grid, currentShape, x + 1, y)) {
          candidatePlacements.push({ x: x + 1, y });
        }

        for (const placement of candidatePlacements) {
          const px = placement.x;
          const py = placement.y;

          // Zero-GC in-place copy to pre-allocated scratch grid
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              this.scratchGrid[r][c] = grid[r][c] !== 0 ? 1 : 0;
            }
          }

          // Stamp active piece into scratch grid
          for (let r = 0; r < currentShape.length; r++) {
            for (let c = 0; c < currentShape[r].length; c++) {
              if (currentShape[r][c] && py + r < ROWS && px + c >= 0 && px + c < COLS) {
                this.scratchGrid[py + r][px + c] = 1;
              }
            }
          }

          // In-place zero-allocation row clear collapse
          let writeR = ROWS - 1;
          for (let readR = ROWS - 1; readR >= 0; readR--) {
            let isFull = true;
            for (let c = 0; c < COLS; c++) {
              if (this.scratchGrid[readR][c] === 0) {
                isFull = false;
                break;
              }
            }
            if (!isFull) {
              if (writeR !== readR) {
                for (let c = 0; c < COLS; c++) {
                  this.scratchGrid[writeR][c] = this.scratchGrid[readR][c];
                }
              }
              writeR--;
            }
          }

          const linesCleared = writeR + 1;
          for (let r = writeR; r >= 0; r--) {
            for (let c = 0; c < COLS; c++) {
              this.scratchGrid[r][c] = 0;
            }
          }

          const metrics = HeuristicAnalyzer.calculateMetrics(this.scratchGrid);

          const playerScore = (
            metrics.aggregateHeight * 0.5 +
            metrics.holes * 4.0 +
            metrics.bumpiness * 1.0 +
            metrics.deepWells * 1.5 -
            linesCleared * 12.0
          );

          if (playerScore < bestPlayerScore) {
            bestPlayerScore = playerScore;
          }
        }
      }

      currentShape = rotate(currentShape);
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

    let bestPiece: PieceType = 'T';
    let maxAdversarialScore = -Infinity;

    // Evaluate all pieces to discover genuine adversarial score and target piece
    for (const piece of this.pieces) {
      const bestPlayerScore = this.simulatePlacement(board, piece);
      const count = pieceCounts[piece] || 0;
      
      // Issue 10: Graduated Starvation Relief (decays to 0 after extended absence)
      const turnsAbsent = this.turnsSinceDealt[piece] || 0;
      const reliefFactor = turnsAbsent >= 14 ? 0 : turnsAbsent >= 10 ? 0.3 : 1.0;
      const starvationBonus = (count === 0 && bestPlayerScore < 14.0 ? (12 - count) * 0.35 : 0.0) * reliefFactor;

      const repeatPenalty = count * 3.5;
      const adversarialScore = bestPlayerScore - starvationBonus - repeatPenalty + (Math.random() - 0.5) * 0.2;

      if (adversarialScore > maxAdversarialScore) {
        maxAdversarialScore = adversarialScore;
        bestPiece = piece;
      }
    }

    // Issue 11 Fix: Under Mercy Protocol, grant relief piece without zeroing the chaos meter to prevent HUD flicker
    if (isMercy) {
      bestPiece = 'I';
    }

    // Update history & turns since dealt
    this.history.push(bestPiece);
    if (this.history.length > 12) {
      this.history.shift();
    }

    for (const p of this.pieces) {
      if (p === bestPiece) {
        this.turnsSinceDealt[p] = 0;
      } else {
        this.turnsSinceDealt[p] = (this.turnsSinceDealt[p] || 0) + 1;
      }
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
    if (metrics.deepWells >= 3) {
      thoughts.push('Deep well detected. Suppressing I-piece relief...');
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

    // Issue 26: Calibrated Chaos Meter Normalization (divisor 85.0)
    const chaosMeter = Math.min(100, Math.max(0, Math.floor((maxAdversarialScore / 85.0) * 100)));

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
  private timeoutId: NodeJS.Timeout | null = null;
  private remainingTime = 0;
  private lockStartTime = 0;
  private totalDuration = 0;

  constructor(onLockChange: (cell: Point | null) => void) {
    this.onLockChange = onLockChange;
  }

  getLock(): Point | null {
    return this.lockedCell;
  }

  // Issue 2 Fix: Update internal locked cell position when rows clear below it
  updateLockPosition(cell: Point | null): void {
    this.lockedCell = cell;
    this.onLockChange(cell);
  }

  clearLock(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.lockId++;
    this.lockedCell = null;
    this.remainingTime = 0;
    this.onLockChange(null);
  }

  // Issue 1.2 Fix: Pause sabotage countdown when game is paused or modal is opened
  pause(): void {
    if (this.timeoutId && this.lockedCell) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      const elapsed = Date.now() - this.lockStartTime;
      this.remainingTime = Math.max(0, this.totalDuration - elapsed);
    }
  }

  // Issue 1.2 Fix: Resume remaining sabotage countdown when game resumes
  resume(): void {
    if (this.lockedCell && this.remainingTime > 0 && !this.timeoutId) {
      const currentCid = this.lockId;
      this.lockStartTime = Date.now();
      this.totalDuration = this.remainingTime;
      this.timeoutId = setTimeout(() => {
        if (this.lockId === currentCid) {
          this.clearLock();
        }
      }, this.remainingTime);
    }
  }

  // Periodic shadow loop
  triggerPeriodicSabotage(grid: (PieceType | number)[][], lastPos: Point, activePiece?: ActivePieceLike | null): void {
    if (this.lockedCell) return;

    const targetY = Math.min(19, Math.max(0, lastPos.y + Math.floor(Math.random() * 3) + 1));
    const targetX = Math.min(9, Math.max(0, lastPos.x + Math.floor(Math.random() * 3) - 1));

    // Issue 1 Fix: Ensure lock does not spawn inside the active piece
    if (activePiece) {
      const isInside = activePiece.shape.some((row, r) =>
        row.some((val, c) => val !== 0 && activePiece.position.x + c === targetX && activePiece.position.y + r === targetY)
      );
      if (isInside) return;
    }

    if (grid[targetY] && grid[targetY][targetX] === 0) {
      this.clearLock();
      const currentCid = this.lockId;
      this.lockedCell = { x: targetX, y: targetY };
      this.onLockChange(this.lockedCell);

      this.totalDuration = 4000;
      this.remainingTime = 4000;
      this.lockStartTime = Date.now();

      this.timeoutId = setTimeout(() => {
        if (this.lockId === currentCid) {
          this.clearLock();
        }
      }, 4000);
    }
  }

  // Live predictive sabotage on falling pieces
  triggerPredictiveSabotage(grid: (PieceType | number)[][], activePos: Point, activePiece?: ActivePieceLike | null): void {
    if (this.lockedCell || activePos.y <= 8) return;

    // Deterministic trigger check
    if (Math.random() < 0.15) {
      const tx = Math.max(0, Math.min(9, activePos.x));
      const ty = Math.max(0, Math.min(19, activePos.y + 2));

      // Issue 1 Fix: Ensure cell lock does not spawn inside the active tetromino
      if (activePiece) {
        const isInside = activePiece.shape.some((row, r) =>
          row.some((val, c) => val !== 0 && activePiece.position.x + c === tx && activePiece.position.y + r === ty)
        );
        if (isInside) return;
      }

      if (grid[ty] && grid[ty][tx] === 0) {
        this.clearLock();
        const currentCid = this.lockId;
        this.lockedCell = { x: tx, y: ty };
        this.onLockChange(this.lockedCell);

        this.totalDuration = 2500;
        this.remainingTime = 2500;
        this.lockStartTime = Date.now();

        this.timeoutId = setTimeout(() => {
          if (this.lockId === currentCid) {
            this.clearLock();
          }
        }, 2500);
      }
    }
  }
}
