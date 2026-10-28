import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Piece, PieceType, Point, SHAPES, COLS, ROWS, 
  isValidMove, rotate, getWallKicks,
  INITIAL_DROP_INTERVAL, MIN_DROP_INTERVAL, SPEED_INCREMENT,
  LOCK_DELAY_MS, MAX_LOCK_RESETS
} from '../lib/tetris';
import { AdversarialAgent, ShadowSaboteur } from '../lib/adversary';

const INITIAL_GRID: (PieceType | number)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export type AudioEventType = 'move' | 'rotate' | 'softdrop' | 'harddrop' | 'lock' | 'clear' | 'tetris' | 'purge' | 'gameover';

export interface UseTetrisOptions {
  onAudioEvent?: (type: AudioEventType) => void;
}

export const useTetris = (options?: UseTetrisOptions) => {
  // Native Client-Side Adversarial Engine
  const localAgentRef = useRef<AdversarialAgent>(new AdversarialAgent());
  const shadowSaboteurRef = useRef<ShadowSaboteur | null>(null);

  const [grid, setGrid] = useState<(PieceType | number)[][]>(INITIAL_GRID);
  const [activePiece, setActivePiece] = useState<Piece | null>(null);
  const [nextPieceType, setNextPieceType] = useState<PieceType>(() => {
    return new AdversarialAgent().decideNextPiece(INITIAL_GRID).piece;
  });
  const [holdPiece, setHoldPiece] = useState<PieceType | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [chaos, setChaos] = useState(0);
  const [thoughts, setThoughts] = useState<{ text: string; time: string }[]>(() => [
    { text: "NATIVE_ADVERSARY_ACTIVE // ENTROPIC_ONLINE", time: "--:--:--" }
  ]);
  const [lockedCell, setLockedCell] = useState<Point | null>(null);
  const [comboMessage, setComboMessage] = useState<{ text: string; type: 'tetris' | 'purge' } | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Initialize Shadow Saboteur
  useEffect(() => {
    shadowSaboteurRef.current = new ShadowSaboteur((cell) => {
      setLockedCell(cell);
    });
  }, []);

  // Audio callback ref
  const onAudioRef = useRef(options?.onAudioEvent);
  useEffect(() => {
    onAudioRef.current = options?.onAudioEvent;
  }, [options?.onAudioEvent]);

  // References for game loop and piece management
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const [dropInterval, setDropInterval] = useState(INITIAL_DROP_INTERVAL);
  
  // Lock delay management
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lockResetsRef = useRef<number>(0);

  // Refs for current mutable state
  const activePieceRef = useRef<Piece | null>(null);
  const gridRef = useRef<(PieceType | number)[][]>(grid);
  const lockedCellRef = useRef<Point | null>(null);
  const isPausedRef = useRef(isPaused);
  const gameOverRef = useRef(gameOver);
  const wsRef = useRef<WebSocket | null>(null);

  // Synchronize refs after render in compliance with React 19 rules
  useEffect(() => {
    activePieceRef.current = activePiece;
    gridRef.current = grid;
    lockedCellRef.current = lockedCell;
    isPausedRef.current = isPaused;
    gameOverRef.current = gameOver;
  });

  // Helper to trigger audio safely
  const triggerAudio = (event: AudioEventType) => {
    if (onAudioRef.current) {
      onAudioRef.current(event);
    }
  };

  // Helper to create a piece
  const createPiece = (type: PieceType): Piece => {
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
  };

  // Optional Remote WebSocket Connection (Connects if server is running, falls back gracefully to Native Engine)
  useEffect(() => {
    // Only attempt remote WS if explicitly configured or running on standard local dev
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//localhost:8000/ws`
        : null
    );

    if (!wsUrl) {
      // Running standalone / Vercel deployment: Native client-side engine is active
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (!isMounted) return;
          setWsConnected(true);
          setThoughts(prev => [
            { text: "REMOTE_NEURAL_LINK_ESTABLISHED // WS_ONLINE", time: new Date().toLocaleTimeString() },
            ...prev
          ].slice(0, 15));
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ADVERSARIAL_UPDATE') {
              const { piece, chaos: newChaos, thought } = data.payload;
              if (piece) {
                setNextPieceType(piece as PieceType);
              }
              if (typeof newChaos === 'number') {
                setChaos(newChaos);
              }
              if (thought) {
                setThoughts(prev => [
                  { text: thought, time: new Date().toLocaleTimeString() },
                  ...prev
                ].slice(0, 15));
              }
            } else if (data.type === 'CELL_LOCK') {
              setLockedCell(data.payload);
            } else if (data.type === 'CLEAR_LOCK') {
              setLockedCell(null);
            }
          } catch (err) {
            console.error("Failed to parse websocket message", err);
          }
        };

        socket.onclose = () => {
          if (!isMounted) return;
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 4000);
        };

        socket.onerror = () => {
          socket?.close();
        };

        wsRef.current = socket;
      } catch {
        // Quiet fallback to native engine
        reconnectTimeout = setTimeout(connect, 4000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, []);

  // Periodic Native Shadow Saboteur (runs when WebSocket is offline)
  useEffect(() => {
    if (wsConnected) return;

    const shadowInterval = setInterval(() => {
      if (!isPausedRef.current && !gameOverRef.current) {
        const piece = activePieceRef.current;
        const currentGrid = gridRef.current;
        const pos = piece ? piece.position : { x: 4, y: 0 };
        shadowSaboteurRef.current?.triggerPeriodicSabotage(currentGrid, pos);
      }
    }, 8000);

    return () => clearInterval(shadowInterval);
  }, [wsConnected]);

  // Clear lock delay timer
  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  // Lock Piece Definition
  const lockPiece = useCallback((pieceToLock: Piece) => {
    clearLockTimer();
    lockResetsRef.current = 0;

    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;
    const newGrid = currentGrid.map(row => [...row]);

    // Place piece blocks on board
    pieceToLock.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const gridY = pieceToLock.position.y + y;
          const gridX = pieceToLock.position.x + x;
          if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
            newGrid[gridY][gridX] = pieceToLock.type;
          }
        }
      });
    });

    // Check completed rows
    const rowsToClear: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (newGrid[r].every(cell => cell !== 0)) {
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
      updatedLockedCell = null;
      setChaos(0);
      triggerAudio('purge');
      setComboMessage({ text: 'SYSTEM_PURGE', type: 'purge' });
      setTimeout(() => setComboMessage(null), 1200);

      setThoughts(prev => [
        { text: "PURGE_PROTOCOL_SUCCESS // Malice neutralized", time: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 15));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PURGE_EVENT' }));
      } else {
        shadowSaboteurRef.current?.clearLock();
      }
    } else if (currentLocked && cleared > 0) {
      // Shift locked cell down for rows cleared above it
      const rowsAbove = rowsToClear.filter(y => y < currentLocked.y).length;
      updatedLockedCell = { ...currentLocked, y: currentLocked.y + rowsAbove };
    }

    // Process cleared rows
    if (cleared > 0) {
      finalGrid = newGrid.filter(row => !row.every(cell => cell !== 0));
      while (finalGrid.length < ROWS) {
        finalGrid.unshift(Array(COLS).fill(0));
      }

      // 15% entropy hazard injection on non-purge clears
      if (!purgeTriggered && Math.random() < 0.15) {
        const randomRow = Math.floor(Math.random() * (ROWS - 6)) + 6;
        const randomCol = Math.floor(Math.random() * COLS);
        if (finalGrid[randomRow][randomCol] === 0) {
          finalGrid[randomRow][randomCol] = 'entropy';
        }
      }

      // Audio & Combo Banner
      if (cleared === 4) {
        triggerAudio('tetris');
        setComboMessage({ text: 'TETRIS', type: 'tetris' });
        setTimeout(() => setComboMessage(null), 1200);
      } else if (!purgeTriggered) {
        triggerAudio('clear');
      }

      // Score calculation (Standard guideline scaling)
      const pointsTable = [0, 100, 300, 500, 800];
      const basePoints = pointsTable[Math.min(cleared, 4)] || cleared * 200;
      const purgeBonus = purgeTriggered ? 1000 : 0;
      setScore(prev => prev + basePoints + purgeBonus);
      setLines(prev => prev + cleared);

      // Accelerate drop speed
      setDropInterval(prev => Math.max(MIN_DROP_INTERVAL, prev * SPEED_INCREMENT));
    } else {
      triggerAudio('lock');
    }

    setGrid(finalGrid);
    setLockedCell(updatedLockedCell);
    setCanHold(true);

    // Compute next adversarial move
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'BOARD_STATE', payload: finalGrid }));
    } else {
      // Run Native Client-Side Minimax Heuristic Engine
      const decision = localAgentRef.current.decideNextPiece(finalGrid);
      setChaos(decision.chaos);
      setThoughts(prev => [
        { text: decision.thought, time: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 15));
      setNextPieceType(decision.piece);
    }

    // Spawn next piece immediately
    setNextPieceType(currentNext => {
      const pieceToSpawn = createPiece(currentNext);
      
      // Check top-out / game-over
      if (!isValidMove(finalGrid, pieceToSpawn, { x: 0, y: 0 }, updatedLockedCell)) {
        setGameOver(true);
        setIsPaused(true);
        setActivePiece(null);
        triggerAudio('gameover');
        return currentNext;
      }

      setActivePiece(pieceToSpawn);

      // Pre-calculate next native adversarial piece if not connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return localAgentRef.current.decideNextPiece(finalGrid).piece;
      }

      return currentNext;
    });
  }, [clearLockTimer]);

  // Move Piece
  const movePiece = useCallback((dx: number, dy: number): boolean => {
    const piece = activePieceRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return false;

    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;

    if (isValidMove(currentGrid, piece, { x: dx, y: dy }, currentLocked)) {
      const newPos = { x: piece.position.x + dx, y: piece.position.y + dy };
      setActivePiece(prev => prev ? {
        ...prev,
        position: newPos
      } : null);

      if (dx !== 0) triggerAudio('move');
      if (dy > 0) triggerAudio('softdrop');

      // Native predictive sabotage trigger when piece is deep
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        shadowSaboteurRef.current?.triggerPredictiveSabotage(currentGrid, newPos);
      }

      // If moving while grounded, reset lock delay (up to MAX_LOCK_RESETS)
      const isNowGrounded = !isValidMove(currentGrid, piece, { x: dx, y: dy + 1 }, currentLocked);
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
  }, [clearLockTimer, lockPiece]);

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
        setActivePiece(rotatedPiece);
        triggerAudio('rotate');

        // Reset lock delay on successful rotation
        if (lockResetsRef.current < MAX_LOCK_RESETS) {
          lockResetsRef.current += 1;
          clearLockTimer();
          const isGrounded = !isValidMove(currentGrid, rotatedPiece, { x: 0, y: 1 }, currentLocked);
          if (isGrounded) {
            lockTimerRef.current = setTimeout(() => {
              if (activePieceRef.current) {
                lockPiece(activePieceRef.current);
              }
            }, LOCK_DELAY_MS);
          }
        }
        return;
      }
    }
  }, [clearLockTimer, lockPiece]);

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

    triggerAudio('harddrop');
    setScore(prev => prev + dropY * 2);
    lockPiece(droppedPiece);
  }, [lockPiece]);

  // Hold Action
  const holdPieceAction = useCallback(() => {
    const piece = activePieceRef.current;
    if (!piece || !canHold || isPausedRef.current || gameOverRef.current) return;

    clearLockTimer();
    const currentType = piece.type;
    const currentGrid = gridRef.current;
    const currentLocked = lockedCellRef.current;

    if (holdPiece) {
      const pieceToSwap = createPiece(holdPiece);
      if (isValidMove(currentGrid, pieceToSwap, { x: 0, y: 0 }, currentLocked)) {
        setActivePiece(pieceToSwap);
        setHoldPiece(currentType);
        setCanHold(false);
      }
    } else {
      setHoldPiece(currentType);
      setCanHold(false);

      // Advance piece from next queue
      setNextPieceType(currentNext => {
        const pieceToSpawn = createPiece(currentNext);
        if (isValidMove(currentGrid, pieceToSpawn, { x: 0, y: 0 }, currentLocked)) {
          setActivePiece(pieceToSpawn);
        } else {
          setGameOver(true);
          setIsPaused(true);
          setActivePiece(null);
        }
        
        // Native adversarial piece generation
        return localAgentRef.current.decideNextPiece(currentGrid).piece;
      });
    }
  }, [canHold, holdPiece, clearLockTimer]);

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

      localAgentRef.current.reset();
      shadowSaboteurRef.current?.clearLock();

      const initialDecision = localAgentRef.current.decideNextPiece(INITIAL_GRID);
      const firstPiece = createPiece(initialDecision.piece);
      setActivePiece(firstPiece);

      const secondDecision = localAgentRef.current.decideNextPiece(INITIAL_GRID);
      setNextPieceType(secondDecision.piece);
      setIsPaused(false);
      lastTimeRef.current = performance.now();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'RESET_GAME' }));
      }
      return;
    }

    setIsPaused(prev => {
      const nextState = !prev;
      if (!nextState) {
        lastTimeRef.current = performance.now();
        if (!activePieceRef.current) {
          const piece = createPiece(nextPieceType);
          setActivePiece(piece);
          setNextPieceType(localAgentRef.current.decideNextPiece(gridRef.current).piece);
        }
      } else {
        clearLockTimer();
      }
      return nextState;
    });
  }, [clearLockTimer, nextPieceType]);

  // Continuous rAF Game Tick Loop
  const loopRef = useRef<(time: number) => void>(() => {});

  useEffect(() => {
    loopRef.current = (time: number) => {
      if (!isPausedRef.current && !gameOverRef.current) {
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        dropCounterRef.current += deltaTime;
        if (dropCounterRef.current > dropInterval) {
          movePiece(0, 1);
          dropCounterRef.current = 0;
        }
      }
      requestRef.current = requestAnimationFrame((t) => loopRef.current(t));
    };
  }, [dropInterval, movePiece]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame((t) => loopRef.current(t));
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // Live Position Pulse to Backend (when connected)
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      const piece = activePieceRef.current;
      const ws = wsRef.current;
      if (piece && !isPausedRef.current && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'LIVE_UPDATE',
          payload: { x: piece.position.x, y: piece.position.y }
        }));
      }
    }, 500);

    return () => clearInterval(pulseInterval);
  }, []);

  // Keyboard controls with DAS/ARR and preventDefault
  useEffect(() => {
    const DAS = 160;
    const ARR = 30;
    let moveInterval: NodeJS.Timeout | null = null;
    let dasTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Pause / Reboot
      if (e.key === 'Enter') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (gameOverRef.current || isPausedRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (e.repeat) return;
          movePiece(-1, 0);
          dasTimeout = setTimeout(() => {
            moveInterval = setInterval(() => movePiece(-1, 0), ARR);
          }, DAS);
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.repeat) return;
          movePiece(1, 0);
          dasTimeout = setTimeout(() => {
            moveInterval = setInterval(() => movePiece(1, 0), ARR);
          }, DAS);
          break;

        case 'ArrowDown':
          e.preventDefault();
          movePiece(0, 1);
          break;

        case 'ArrowUp':
          e.preventDefault();
          rotatePiece('cw');
          break;

        case 'z':
        case 'Z':
        case 'Control':
          e.preventDefault();
          rotatePiece('ccw');
          break;

        case ' ':
          e.preventDefault();
          hardDrop();
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          holdPieceAction();
          break;

        case 'p':
        case 'P':
        case 'Escape':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (dasTimeout) clearTimeout(dasTimeout);
        if (moveInterval) clearInterval(moveInterval);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (dasTimeout) clearTimeout(dasTimeout);
      if (moveInterval) clearInterval(moveInterval);
    };
  }, [movePiece, rotatePiece, hardDrop, holdPieceAction, togglePause]);

  return {
    grid,
    activePiece,
    nextPieceType,
    holdPiece,
    score,
    lines,
    gameOver,
    isPaused,
    chaos,
    thoughts,
    lockedCell,
    comboMessage,
    wsConnected,
    ghostPosition: getGhostPosition(),
    togglePause,
    rotatePiece,
    movePiece,
    hardDrop,
    holdPieceAction,
  };
};
