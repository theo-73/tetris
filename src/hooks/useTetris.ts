import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Piece, PieceType, Point, SHAPES, COLS, ROWS, 
  isValidMove, rotate, getWallKicks,
  INITIAL_DROP_INTERVAL, MIN_DROP_INTERVAL, SPEED_INCREMENT,
  LOCK_DELAY_MS, MAX_LOCK_RESETS
} from '../lib/tetris';
import { AdversarialAgent, ShadowSaboteur } from '../lib/adversary';

const INITIAL_GRID: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export type AudioEventType = 'move' | 'rotate' | 'softdrop' | 'harddrop' | 'lock' | 'clear' | 'tetris' | 'purge' | 'gameover' | 'hazard' | 'hold';

export interface GameTelemetry {
  piecesPlaced: number;
  dropCount: number;
  combos: number;
  purgesTriggered: number;
  gameDurationMs: number;
}

export interface ComboMessagePayload {
  text: string;
  type: 'tetris' | 'purge' | 'combo' | 'tspin';
  cell?: Point | null;
}

export interface UseTetrisOptions {
  onAudioEvent?: (type: AudioEventType) => void;
  isModalOpen?: boolean;
}

export const useTetris = (options?: UseTetrisOptions) => {
  // Pure Native Client-Side Adversarial Engine
  const localAgentRef = useRef<AdversarialAgent>(new AdversarialAgent());
  const shadowSaboteurRef = useRef<ShadowSaboteur | null>(null);

  // Issue 1 Fix: Modal isolation ref prevents background inputs
  const isModalOpenRef = useRef<boolean>(options?.isModalOpen ?? false);
  useEffect(() => {
    isModalOpenRef.current = options?.isModalOpen ?? false;
  }, [options?.isModalOpen]);

  // Issue 3 Fix: Telemetry tracking refs for score anti-cheat verification
  const piecesPlacedRef = useRef<number>(0);
  const dropCountRef = useRef<number>(0);
  const combosCountRef = useRef<number>(0);
  const purgesCountRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const activePlayDurationMsRef = useRef<number>(0);

  useEffect(() => {
    if (gameStartTimeRef.current === 0) {
      gameStartTimeRef.current = Date.now();
    }
  }, []);

  const [grid, setGrid] = useState<(PieceType | number)[][]>(INITIAL_GRID);
  const [activePiece, setActivePiece] = useState<Piece | null>(null);
  
  // Deterministic initial state to prevent SSR hydration mismatch
  const [nextPieceType, setNextPieceType] = useState<PieceType>('T');
  const [holdPiece, setHoldPiece] = useState<PieceType | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [chaos, setChaos] = useState(0);
  const [thoughts, setThoughts] = useState<{ text: string; time: string }[]>(() => [
    { text: "NATIVE_ADVERSARY_ACTIVE // ENTROPIC_ONLINE", time: "--:--:--" }
  ]);
  const [lockedCell, setLockedCell] = useState<Point | null>(null);
  const [comboMessage, setComboMessage] = useState<ComboMessagePayload | null>(null);

  // Issue 12 & 13: Guideline tracking refs for Extended Placement, T-spins, Combos, and Back-to-Back
  const lowestYReachedRef = useRef<number>(-1);
  const lastActionWasRotateRef = useRef<boolean>(false);
  const comboCountRef = useRef<number>(-1);
  const backToBackRef = useRef<boolean>(false);

  // Initialize Shadow Saboteur
  useEffect(() => {
    shadowSaboteurRef.current = new ShadowSaboteur((cell) => {
      setLockedCell(cell);
    });
    return () => {
      shadowSaboteurRef.current?.clearLock();
    };
  }, []);

  // Audio callback ref
  const onAudioRef = useRef(options?.onAudioEvent);
  useEffect(() => {
    onAudioRef.current = options?.onAudioEvent;
  }, [options?.onAudioEvent]);

  // References for game loop and piece management
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const [dropInterval, setDropInterval] = useState(INITIAL_DROP_INTERVAL);
  
  // Lock delay management
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lockResetsRef = useRef<number>(0);

  // Refs for current mutable state
  const activePieceRef = useRef<Piece | null>(null);
  const nextPieceTypeRef = useRef<PieceType>('T');
  const gridRef = useRef<(PieceType | number)[][]>(grid);
  const lockedCellRef = useRef<Point | null>(null);
  const isPausedRef = useRef(isPaused);
  const gameOverRef = useRef(gameOver);
  const linesRef = useRef<number>(lines);

  // Synchronize refs after render in compliance with React 19 rules
  useEffect(() => {
    activePieceRef.current = activePiece;
    nextPieceTypeRef.current = nextPieceType;
    gridRef.current = grid;
    lockedCellRef.current = lockedCell;
    isPausedRef.current = isPaused;
    gameOverRef.current = gameOver;
    linesRef.current = lines;
  });

  // Clear lock delay timer
  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  // Issue 2.3 Fix: Lock delay timer cleanup on unmount
  useEffect(() => {
    return () => {
      clearLockTimer();
    };
  }, [clearLockTimer]);

  // Helper to trigger audio safely
  const triggerAudio = useCallback((event: AudioEventType) => {
    if (onAudioRef.current) {
      onAudioRef.current(event);
    }
  }, []);

  // Helper to create a piece
  const createPiece = useCallback((type: PieceType): Piece => {
    const shape = SHAPES[type];
    return {
      type,
      position: { 
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), 
        y: -1 
      },
      rotation: 0,
      shape: shape.map(row => [...row]),
    };
  }, []);

  // Periodic Native Shadow Saboteur (active during gameplay, Issue 1.3 Fix: visibilityState guard)
  useEffect(() => {
    const shadowInterval = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        !isPausedRef.current && 
        !gameOverRef.current
      ) {
        const piece = activePieceRef.current;
        const currentGrid = gridRef.current;
        const pos = piece ? piece.position : { x: 4, y: 0 };
        shadowSaboteurRef.current?.triggerPeriodicSabotage(currentGrid, pos, piece);
      }
    }, 8000);

    return () => clearInterval(shadowInterval);
  }, []);

  // Lock Piece Definition
  const lockPiece = useCallback((pieceToLock: Piece) => {
    clearLockTimer();
    piecesPlacedRef.current += 1;
    lockResetsRef.current = 0;
    lowestYReachedRef.current = -1;

    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;
    const newGrid = currentGrid.map(row => [...row]);

    // Detect Ceiling Lock Out immediately
    let hasLockOut = false;
    pieceToLock.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const gridY = pieceToLock.position.y + y;
          const gridX = pieceToLock.position.x + x;
          if (gridY < 0) {
            hasLockOut = true;
          } else if (gridY < ROWS && gridX >= 0 && gridX < COLS) {
            newGrid[gridY][gridX] = pieceToLock.type;
          }
        }
      });
    });

    if (hasLockOut) {
      // Issue 2.2 Fix: Write remaining valid cells into grid so fatal piece renders on game over
      setGrid(newGrid);
      setGameOver(true);
      setIsPaused(true);
      setActivePiece(null);
      triggerAudio('gameover');
      return;
    }

    // Issue 13: 3-Corner T-Spin Detection
    let isTSpin = false;
    if (pieceToLock.type === 'T' && lastActionWasRotateRef.current) {
      const px = pieceToLock.position.x;
      const py = pieceToLock.position.y;
      const corners = [
        [px, py],
        [px + 2, py],
        [px, py + 2],
        [px + 2, py + 2],
      ];
      let occupiedCorners = 0;
      for (const [cx, cy] of corners) {
        if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS || currentGrid[cy][cx] !== 0) {
          occupiedCorners++;
        }
      }
      if (occupiedCorners >= 3) {
        isTSpin = true;
      }
    }

    // Check completed rows
    // Issue 1.1 Fix: A row containing the active adversary lock completes when the other 9 cells are filled
    const rowsToClear: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const isRowComplete = newGrid[r].every((cell, colIdx) => {
        if (currentLocked && currentLocked.y === r && currentLocked.x === colIdx) {
          return true; // The locked cell obstacle is cleared along with the completed row
        }
        return cell !== 0;
      });
      if (isRowComplete) {
        rowsToClear.push(r);
      }
    }

    const cleared = rowsToClear.length;
    let finalGrid = [...newGrid];
    let purgeTriggered = false;
    let updatedLockedCell = currentLocked;

    // Purge detection: Player cleared the row containing the adversary lock
    if (currentLocked && rowsToClear.includes(currentLocked.y)) {
      purgeTriggered = true;
      purgesCountRef.current += 1;
      updatedLockedCell = null;
      setChaos(0);
      triggerAudio('purge');
      setComboMessage({ text: 'SYSTEM_PURGE', type: 'purge', cell: currentLocked });
      setTimeout(() => setComboMessage(null), 1200);

      setThoughts(prev => [
        { text: "PURGE_PROTOCOL_SUCCESS // Malice neutralized", time: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 15));

      shadowSaboteurRef.current?.clearLock();
    } else if (currentLocked && cleared > 0) {
      // Locked cell only shifts down for rows cleared BELOW it
      const rowsBelow = rowsToClear.filter(y => y > currentLocked.y).length;
      updatedLockedCell = {
        ...currentLocked,
        y: Math.min(ROWS - 1, currentLocked.y + rowsBelow)
      };
      // Issue 2 Fix: Notify ShadowSaboteur instance of shifted position
      shadowSaboteurRef.current?.updateLockPosition(updatedLockedCell);
    }

    // Process cleared rows & Issue 12 Guideline Scoring (using linesRef to avoid rerender invalidation)
    const currentLevel = Math.floor(linesRef.current / 10) + 1;

    if (cleared > 0) {
      finalGrid = newGrid.filter((_, idx) => !rowsToClear.includes(idx));
      while (finalGrid.length < ROWS) {
        finalGrid.unshift(Array(COLS).fill(0));
      }

      // Issue 11 Fix: Entropy hazard injection safely targets the surface of an existing column stack
      if (!purgeTriggered && Math.random() < 0.15) {
        // Collect candidate columns that have placed blocks and an empty cell directly above their surface
        const candidateSlots: { col: number; row: number }[] = [];
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r < ROWS; r++) {
            if (finalGrid[r][c] !== 0) {
              if (r > 0 && finalGrid[r - 1][c] === 0) {
                // Ensure target row won't automatically complete a 10-block row
                const rowOccupied = finalGrid[r - 1].filter(v => v !== 0).length;
                if (rowOccupied < COLS - 1) {
                  candidateSlots.push({ col: c, row: r - 1 });
                }
              }
              break;
            }
          }
        }
        if (candidateSlots.length > 0) {
          const chosenSlot = candidateSlots[Math.floor(Math.random() * candidateSlots.length)];
          finalGrid[chosenSlot.row][chosenSlot.col] = 'entropy';
          triggerAudio('hazard');
          setComboMessage({ text: 'ENTROPY HAZARD DETECTED', type: 'combo' });
          setTimeout(() => setComboMessage(null), 1200);
          setThoughts(prev => [
            { text: "INJECTING_ENTROPY_VECTOR // Target stack destabilized", time: new Date().toLocaleTimeString() },
            ...prev
          ].slice(0, 15));
        }
      }

      // Combo Tracking
      comboCountRef.current += 1;
      if (comboCountRef.current > 0) {
        combosCountRef.current += 1;
      }
      setCombo(Math.max(0, comboCountRef.current));
      const comboBonus = comboCountRef.current > 0 ? 50 * comboCountRef.current * currentLevel : 0;

      // Base guideline line score
      let awardedPoints = 0;
      if (isTSpin) {
        const tSpinTable = [400, 800, 1200, 1600];
        awardedPoints = (tSpinTable[Math.min(cleared, 3)] || 1200) * currentLevel;
        triggerAudio('tetris');
        setComboMessage({ text: backToBackRef.current ? 'B2B T-SPIN' : 'T-SPIN', type: 'tetris' });
        setTimeout(() => setComboMessage(null), 1200);
        if (backToBackRef.current) awardedPoints = Math.floor(awardedPoints * 1.5);
        backToBackRef.current = true;
      } else if (cleared === 4) {
        awardedPoints = 800 * currentLevel;
        if (backToBackRef.current) awardedPoints = Math.floor(awardedPoints * 1.5);
        backToBackRef.current = true;
        triggerAudio('tetris');
        setComboMessage({ text: backToBackRef.current ? 'B2B TETRIS' : 'TETRIS', type: 'tetris' });
        setTimeout(() => setComboMessage(null), 1200);
      } else {
        const baseTable = [0, 100, 300, 500];
        awardedPoints = (baseTable[cleared] || 100) * currentLevel;
        backToBackRef.current = false;
        if (!purgeTriggered) triggerAudio('clear');
      }

      const purgeBonus = purgeTriggered ? 1000 * currentLevel : 0;
      setScore(prev => prev + awardedPoints + comboBonus + purgeBonus);
      setLines(prev => prev + cleared);

      // Accelerate drop speed
      setDropInterval(prev => Math.max(MIN_DROP_INTERVAL, prev * SPEED_INCREMENT));
    } else {
      comboCountRef.current = -1;
      setCombo(0);
      triggerAudio('lock');
    }

    setGrid(finalGrid);
    setLockedCell(updatedLockedCell);
    setCanHold(true);
    lastActionWasRotateRef.current = false;

    // Spawn next piece from preview
    const nextType = nextPieceTypeRef.current;
    const pieceToSpawn = createPiece(nextType);
    lowestYReachedRef.current = pieceToSpawn.position.y;

    if (!isValidMove(finalGrid, pieceToSpawn, { x: 0, y: 0 }, updatedLockedCell)) {
      setGameOver(true);
      setIsPaused(true);
      setActivePiece(null);
      triggerAudio('gameover');
    } else {
      // Issue 3: Update ref synchronously
      activePieceRef.current = pieceToSpawn;
      setActivePiece(pieceToSpawn);

      const decision = localAgentRef.current.decideNextPiece(finalGrid);
      setChaos(decision.chaos);
      setThoughts(prev => [
        { text: decision.thought, time: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 15));
      setNextPieceType(decision.piece);
    }
  }, [clearLockTimer, createPiece, triggerAudio]);

  // Move Piece
  const movePiece = useCallback((dx: number, dy: number): boolean => {
    const piece = activePieceRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return false;

    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;

    if (isValidMove(currentGrid, piece, { x: dx, y: dy }, currentLocked)) {
      const newPos = { x: piece.position.x + dx, y: piece.position.y + dy };
      const updatedPiece: Piece = {
        ...piece,
        position: newPos
      };

      // Issue 3 Fix: Update activePieceRef synchronously before state dispatch
      activePieceRef.current = updatedPiece;
      setActivePiece(updatedPiece);
      lastActionWasRotateRef.current = false;

      if (dx !== 0) triggerAudio('move');
      if (dy > 0) {
        dropCountRef.current += 1;
        triggerAudio('softdrop');
        setScore(prev => prev + 1); // Issue 2.5 Fix: Guideline +1 pt soft drop score
      }

      // Issue 1 Fix: Pass updatedPiece to saboteur so lock never spawns inside piece
      shadowSaboteurRef.current?.triggerPredictiveSabotage(currentGrid, newPos, updatedPiece);

      // Issue 8 Fix: Extended Placement Rule - step down to new lowest row resets lock counter
      if (newPos.y > lowestYReachedRef.current) {
        lowestYReachedRef.current = newPos.y;
        lockResetsRef.current = 0;
      }

      // If moving while grounded, reset lock delay (up to MAX_LOCK_RESETS)
      const isNowGrounded = !isValidMove(currentGrid, updatedPiece, { x: 0, y: 1 }, currentLocked);
      if (isNowGrounded && lockResetsRef.current < MAX_LOCK_RESETS) {
        lockResetsRef.current += 1;
        clearLockTimer();
        lockTimerRef.current = setTimeout(() => {
          if (activePieceRef.current) {
            lockPiece(activePieceRef.current);
          }
        }, LOCK_DELAY_MS);
      } else if (!isNowGrounded) {
        clearLockTimer();
      }

      return true;
    }

    // Downward collision triggers lock delay
    if (dy > 0) {
      if (!lockTimerRef.current) {
        lockTimerRef.current = setTimeout(() => {
          if (activePieceRef.current) {
            lockPiece(activePieceRef.current);
          }
        }, LOCK_DELAY_MS);
      }
    }

    return false;
  }, [clearLockTimer, lockPiece, triggerAudio]);

  // Rotate Piece
  const rotatePiece = useCallback((dir: 'cw' | 'ccw' = 'cw') => {
    const piece = activePieceRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;

    const nextRotation = dir === 'cw' 
      ? (piece.rotation + 1) % 4 
      : (piece.rotation + 3) % 4;
    
    const nextShape = rotate(piece.shape, dir);
    const kicks = getWallKicks(piece.type, piece.rotation, nextRotation);

    for (const [kx, ky] of kicks) {
      const rotatedPiece: Piece = {
        ...piece,
        rotation: nextRotation,
        shape: nextShape,
        position: { x: piece.position.x + kx, y: piece.position.y - ky }
      };

      if (isValidMove(currentGrid, rotatedPiece, { x: 0, y: 0 }, currentLocked)) {
        // Issue 3 Fix: Update activePieceRef synchronously
        activePieceRef.current = rotatedPiece;
        setActivePiece(rotatedPiece);
        lastActionWasRotateRef.current = true;
        triggerAudio('rotate');

        // Issue 1.1 Fix: Extended Placement Mode - only grounded rotations consume lock resets
        const isGrounded = !isValidMove(currentGrid, rotatedPiece, { x: 0, y: 1 }, currentLocked);
        if (isGrounded) {
          if (lockResetsRef.current < MAX_LOCK_RESETS) {
            lockResetsRef.current += 1;
            clearLockTimer();
            lockTimerRef.current = setTimeout(() => {
              if (activePieceRef.current) {
                lockPiece(activePieceRef.current);
              }
            }, LOCK_DELAY_MS);
          }
        } else {
          // In mid-air, clear any stale lock timer without draining the 15-reset budget
          clearLockTimer();
        }
        return;
      }
    }
  }, [clearLockTimer, lockPiece, triggerAudio]);

  // Hard Drop
  const hardDrop = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;

    let dropY = 0;
    while (isValidMove(currentGrid, piece, { x: 0, y: dropY + 1 }, currentLocked)) {
      dropY++;
    }

    const droppedPiece: Piece = {
      ...piece,
      position: { ...piece.position, y: piece.position.y + dropY }
    };

    dropCountRef.current += 1;
    triggerAudio('harddrop');
    setScore(prev => prev + dropY * 2);
    lockPiece(droppedPiece);
  }, [lockPiece, triggerAudio]);

  // Hold Action
  const holdPieceAction = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || !canHold || isPausedRef.current || gameOverRef.current) return;

    const currentType = piece.type;
    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;

    if (holdPiece) {
      // Swapping pieces does NOT burn the next piece queue
      const pieceToSwap = createPiece(holdPiece);
      if (isValidMove(currentGrid, pieceToSwap, { x: 0, y: 0 }, currentLocked)) {
        clearLockTimer();
        activePieceRef.current = pieceToSwap;
        setActivePiece(pieceToSwap);
        setHoldPiece(currentType);
        setCanHold(false);
        lowestYReachedRef.current = pieceToSwap.position.y;
        lockResetsRef.current = 0;
        triggerAudio('hold');
      }
    } else {
      // First hold draws next piece and advances queue
      clearLockTimer();
      setHoldPiece(currentType);
      setCanHold(false);

      const nextType = nextPieceTypeRef.current;
      const pieceToSpawn = createPiece(nextType);
      lowestYReachedRef.current = pieceToSpawn.position.y;
      lockResetsRef.current = 0;

      if (isValidMove(currentGrid, pieceToSpawn, { x: 0, y: 0 }, currentLocked)) {
        activePieceRef.current = pieceToSpawn;
        setActivePiece(pieceToSpawn);
        triggerAudio('hold');
      } else {
        setGameOver(true);
        setIsPaused(true);
        setActivePiece(null);
        triggerAudio('gameover');
      }

      const decision = localAgentRef.current.decideNextPiece(currentGrid);
      setChaos(decision.chaos);
      setThoughts(prev => [
        { text: decision.thought, time: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 15));
      setNextPieceType(decision.piece);
    }
  }, [canHold, holdPiece, clearLockTimer, createPiece, triggerAudio]);

  // Ghost Position
  const getGhostPosition = useCallback((): Point | null => {
    const piece = activePiece;
    if (!piece) return null;

    let dropY = 0;
    while (isValidMove(grid, piece, { x: 0, y: dropY + 1 }, lockedCell)) {
      dropY++;
    }
    return { x: piece.position.x, y: piece.position.y + dropY };
  }, [activePiece, grid, lockedCell]);

  // Toggle Pause / Reboot
  const togglePause = useCallback(() => {
    if (gameOverRef.current) {
      clearLockTimer();
      setGrid(INITIAL_GRID);
      setScore(0);
      setLines(0);
      setGameOver(false);
      setChaos(0);
      setDropInterval(INITIAL_DROP_INTERVAL);
      setHoldPiece(null);
      setCanHold(true);
      comboCountRef.current = -1;
      setCombo(0);
      backToBackRef.current = false;
      lowestYReachedRef.current = -1;
      lastActionWasRotateRef.current = false;
      lockResetsRef.current = 0;
      setComboMessage(null);

      piecesPlacedRef.current = 0;
      dropCountRef.current = 0;
      combosCountRef.current = 0;
      purgesCountRef.current = 0;
      gameStartTimeRef.current = Date.now();
      activePlayDurationMsRef.current = 0;

      localAgentRef.current.reset();
      shadowSaboteurRef.current?.clearLock();

      const initialDecision = localAgentRef.current.decideNextPiece(INITIAL_GRID);
      const firstPiece = createPiece(initialDecision.piece);
      activePieceRef.current = firstPiece;
      setActivePiece(firstPiece);

      const secondDecision = localAgentRef.current.decideNextPiece(INITIAL_GRID);
      setNextPieceType(secondDecision.piece);
      setChaos(secondDecision.chaos);
      setThoughts([
        { text: secondDecision.thought, time: new Date().toLocaleTimeString() }
      ]);
      setIsPaused(false);
      dropCounterRef.current = 0;
      lastTimeRef.current = performance.now();
      return;
    }

    const nextPaused = !isPausedRef.current;
    isPausedRef.current = nextPaused;

    if (!nextPaused) {
      // Issue 15 Fix: Reset drop counter on unpause to give player full reaction interval
      dropCounterRef.current = 0;
      lastTimeRef.current = performance.now();
      // Issue 1.2 Fix: Resume saboteur lock countdown on unpause
      shadowSaboteurRef.current?.resume();

      if (!activePieceRef.current) {
        // Issue 3.3 Fix: Decide opening piece dynamically via heuristic engine
        const firstDecision = localAgentRef.current.decideNextPiece(gridRef.current);
        const piece = createPiece(firstDecision.piece);
        activePieceRef.current = piece;
        setActivePiece(piece);
        lowestYReachedRef.current = piece.position.y;
        
        // Issue 4 Fix: Capture chaos and thought on initial unpause
        const nextDecision = localAgentRef.current.decideNextPiece(gridRef.current);
        setNextPieceType(nextDecision.piece);
        setChaos(nextDecision.chaos);
        setThoughts(p => [
          { text: nextDecision.thought, time: new Date().toLocaleTimeString() },
          ...p
        ].slice(0, 15));
      }
    } else {
      clearLockTimer();
      // Issue 1.2 Fix: Pause saboteur lock countdown on game pause
      shadowSaboteurRef.current?.pause();
    }

    // Pure React 19 state update with zero side-effects inside setter
    setIsPaused(nextPaused);
  }, [clearLockTimer, createPiece]);

  // Active rAF Game Tick Loop (Runs strictly when unpaused and actively playing)
  useEffect(() => {
    if (isPaused || gameOver) return;

    let animId: number;
    let lastTime = performance.now();

    const tick = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      activePlayDurationMsRef.current += deltaTime;

      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > dropInterval) {
        movePiece(0, 1);
        dropCounterRef.current = 0;
      }
      animId = requestAnimationFrame(tick);
    };

    dropCounterRef.current = 0;
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, gameOver, dropInterval, movePiece]);

  // Action callback refs to ensure keyboard listeners are completely stable (Issue 1.4 Fix)
  const movePieceRef = useRef(movePiece);
  const rotatePieceRef = useRef(rotatePiece);
  const hardDropRef = useRef(hardDrop);
  const holdPieceActionRef = useRef(holdPieceAction);
  const togglePauseRef = useRef(togglePause);

  useEffect(() => {
    movePieceRef.current = movePiece;
    rotatePieceRef.current = rotatePiece;
    hardDropRef.current = hardDrop;
    holdPieceActionRef.current = holdPieceAction;
    togglePauseRef.current = togglePause;
  });

  // Leak-free DAS/ARR keyboard controls with distinct directional ownership
  useEffect(() => {
    const DAS = 160;
    const ARR = 30;
    let activeDir: 'left' | 'right' | null = null;
    let moveInterval: NodeJS.Timeout | null = null;
    let dasTimeout: NodeJS.Timeout | null = null;

    const clearMovementTimers = () => {
      if (dasTimeout) {
        clearTimeout(dasTimeout);
        dasTimeout = null;
      }
      if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
      }
      activeDir = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Issue 1 Fix: Do not process hotkeys when any modal is open
      if (isModalOpenRef.current) {
        return;
      }

      // Issue 14 Fix: Do not hijack inputs if user is typing into an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Global Pause / Reboot
      if (e.key === 'Enter') {
        e.preventDefault();
        togglePauseRef.current();
        return;
      }

      if (gameOverRef.current || isPausedRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (activeDir === 'left') return;
          clearMovementTimers();
          activeDir = 'left';
          movePieceRef.current(-1, 0);
          dasTimeout = setTimeout(() => {
            moveInterval = setInterval(() => {
              if (activeDir === 'left') {
                movePieceRef.current(-1, 0);
              }
            }, ARR);
          }, DAS);
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (activeDir === 'right') return;
          clearMovementTimers();
          activeDir = 'right';
          movePieceRef.current(1, 0);
          dasTimeout = setTimeout(() => {
            moveInterval = setInterval(() => {
              if (activeDir === 'right') {
                movePieceRef.current(1, 0);
              }
            }, ARR);
          }, DAS);
          break;

        case 'ArrowDown':
          e.preventDefault();
          movePieceRef.current(0, 1);
          break;

        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          rotatePieceRef.current('cw');
          break;

        case 'z':
        case 'Z':
        case 'Control':
          e.preventDefault();
          rotatePieceRef.current('ccw');
          break;

        case ' ':
          e.preventDefault();
          hardDropRef.current();
          break;

        case 'c':
        case 'C':
        case 'Shift':
          e.preventDefault();
          holdPieceActionRef.current();
          break;

        case 'p':
        case 'P':
        case 'Escape':
          e.preventDefault();
          togglePauseRef.current();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && activeDir === 'left') {
        clearMovementTimers();
      } else if (e.key === 'ArrowRight' && activeDir === 'right') {
        clearMovementTimers();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearMovementTimers();
    };
  }, []);

  // Issue 5 Fix: Visibilitychange and window blur auto-pause
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !isPausedRef.current && !gameOverRef.current) {
        togglePauseRef.current();
      }
    };
    const handleBlur = () => {
      if (!isPausedRef.current && !gameOverRef.current) {
        togglePauseRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Issue 3 & Issue 9 Fix: Telemetry extraction for anti-cheat validation with active duration
  const getGameTelemetry = useCallback((): GameTelemetry => {
    return {
      piecesPlaced: piecesPlacedRef.current,
      dropCount: dropCountRef.current,
      combos: combosCountRef.current,
      purgesTriggered: purgesCountRef.current,
      gameDurationMs: Math.max(1, Math.round(activePlayDurationMsRef.current)),
    };
  }, []);

  return {
    grid,
    activePiece,
    nextPieceType,
    holdPiece,
    canHold,
    score,
    lines,
    level: Math.floor(lines / 10) + 1,
    combo,
    gameOver,
    isPaused,
    chaos,
    thoughts,
    lockedCell,
    comboMessage,
    ghostPosition: getGhostPosition(),
    togglePause,
    rotatePiece,
    movePiece,
    hardDrop,
    holdPieceAction,
    getGameTelemetry,
  };
};
