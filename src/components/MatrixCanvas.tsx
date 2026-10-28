'use client';
import React, { useEffect, useRef, useCallback } from 'react';
import { COLS, ROWS, COLORS, PieceType, Piece, Point } from '../lib/tetris';

export const BLOCK_SIZE = 30;
export const LOGICAL_WIDTH = COLS * BLOCK_SIZE;
export const LOGICAL_HEIGHT = ROWS * BLOCK_SIZE;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface MatrixCanvasProps {
  grid: (PieceType | number)[][];
  activePiece: Piece | null;
  ghostPosition: Point | null;
  gameOver: boolean;
  isPaused: boolean;
  chaos: number;
  lockedCell: Point | null;
  comboMessage: { text: string; type: 'combo' | 'tetris' | 'purge' | 'tspin'; cell?: Point | null } | null;
  themeColor: string;
  level: number;
  lines: number;
  score: number;
  combo: number;
  onCanvasClick?: () => void;
  // Issue 7 Fix: Canvas touch gesture callbacks for mobile swipe gameplay
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRotate?: () => void;
  onSoftDrop?: () => void;
  onHardDrop?: () => void;
  onHold?: () => void;
  onUserGesture?: () => void;
}

export const MatrixCanvas: React.FC<MatrixCanvasProps> = ({
  grid,
  activePiece,
  ghostPosition,
  gameOver,
  isPaused,
  chaos,
  lockedCell,
  comboMessage,
  themeColor,
  level,
  lines,
  score,
  combo,
  onCanvasClick,
  onMoveLeft,
  onMoveRight,
  onRotate,
  onSoftDrop,
  onHardDrop,
  onHold,
  onUserGesture,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shakeIntensityRef = useRef<number>(0);
  const rainMatrixRef = useRef<{ x: number; y: number; char: string; speed: number }[]>([]);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  
  // Issue 1.4 Fix: Pre-resolve computed font outside the 60 FPS animation loop
  const fontRef = useRef('Orbitron, sans-serif');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const family = getComputedStyle(document.documentElement).getPropertyValue('--font-orbitron');
      if (family && family.trim().length > 0) {
        fontRef.current = family.trim();
      }
    }
  }, []);

  // Pre-seed background cyber substrate rain
  useEffect(() => {
    const rain = [];
    for (let i = 0; i < 30; i++) {
      rain.push({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        char: String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)),
        speed: 0.5 + Math.random() * 1.5,
      });
    }
    rainMatrixRef.current = rain;
  }, []);

  const isLoopRunningRef = useRef(false);
  const animationIdRef = useRef<number | null>(null);
  const renderRef = useRef<() => void>(() => {});

  const wakeLoop = useCallback(() => {
    if (!isLoopRunningRef.current) {
      isLoopRunningRef.current = true;
      animationIdRef.current = requestAnimationFrame(renderRef.current);
    }
  }, []);

  // Trigger screen shake and particles on combo / purge / tetris
  useEffect(() => {
    const targetCell = comboMessage?.cell || lockedCell;
    if (comboMessage?.type === 'purge' && targetCell) {
      shakeIntensityRef.current = 18;
      const lx = targetCell.x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const ly = targetCell.y * BLOCK_SIZE + BLOCK_SIZE / 2;
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8;
        particlesRef.current.push({
          x: lx,
          y: ly,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.2,
          size: Math.random() * 5 + 2,
          color: '#ef4444',
        });
      }
    } else if (comboMessage?.type === 'tetris' || comboMessage?.type === 'tspin') {
      shakeIntensityRef.current = 14;
      for (let i = 0; i < 40; i++) {
        particlesRef.current.push({
          x: Math.random() * LOGICAL_WIDTH,
          y: (ROWS - 4) * BLOCK_SIZE + Math.random() * (4 * BLOCK_SIZE),
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 6 - 2,
          life: 1.0,
          size: Math.random() * 4 + 2,
          color: comboMessage.type === 'tspin' ? '#a855f7' : '#06b6d4',
        });
      }
    }
    wakeLoop();
  }, [comboMessage, lockedCell, wakeLoop]);

  // Keep state refs synchronized for smooth 60fps canvas render loop
  const stateRef = useRef({
    grid,
    activePiece,
    ghostPosition,
    gameOver,
    isPaused,
    chaos,
    lockedCell,
    comboMessage,
    themeColor,
  });

  useEffect(() => {
    stateRef.current = {
      grid,
      activePiece,
      ghostPosition,
      gameOver,
      isPaused,
      chaos,
      lockedCell,
      comboMessage,
      themeColor,
    };
    wakeLoop();
  }, [grid, activePiece, ghostPosition, gameOver, isPaused, chaos, lockedCell, comboMessage, themeColor, wakeLoop]);

  // Dedicated HiDPI / Retina Canvas Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      
      // Ensure canvas backing buffer matches physical pixels
      if (canvas.width !== LOGICAL_WIDTH * dpr || canvas.height !== LOGICAL_HEIGHT * dpr) {
        canvas.width = LOGICAL_WIDTH * dpr;
        canvas.height = LOGICAL_HEIGHT * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const state = stateRef.current;

      // Issue 4 Fix: Vestibular safety - bypass screen shake on prefers-reduced-motion
      const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        shakeIntensityRef.current = 0;
      } else if (shakeIntensityRef.current > 0) {
        shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - 0.5);
      }
      const shakeOffset = (!prefersReducedMotion && shakeIntensityRef.current > 0)
        ? (Math.sin(Date.now() / 20) * shakeIntensityRef.current)
        : 0;

      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // 1. Dark Background Substrate
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Issue 27 Fix: Background cyber rain only moves when game is active
      ctx.font = '10px monospace';
      ctx.fillStyle = state.chaos > 70 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(6, 182, 212, 0.08)';
      rainMatrixRef.current.forEach(item => {
        ctx.fillText(item.char, item.x, item.y);
        if (!state.isPaused && !state.gameOver) {
          item.y += item.speed;
          if (item.y > LOGICAL_HEIGHT) {
            item.y = -10;
            item.x = Math.random() * LOGICAL_WIDTH;
          }
        }
      });

      // 3. Shake & Translation Layer
      ctx.save();
      ctx.translate(shakeOffset, 0);

      // Issue 29 Fix: Render placed blocks with crisp bevels without repetitive per-block shadowBlur
      state.grid.forEach((row, y) => {
        row.forEach((value, x) => {
          const px = x * BLOCK_SIZE;
          const py = y * BLOCK_SIZE;

          if (value !== 0) {
            const pieceColor = COLORS[value as unknown as PieceType] || '#4b5563';
            ctx.fillStyle = pieceColor;
            ctx.fillRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

            // Block inner bevel highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
          } else {
            // Subtle grid guides
            ctx.strokeStyle = 'rgba(31, 41, 55, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
          }
        });
      });

      // Issue 30 & Issue 4 Fix: Ghost Piece + Drop Trajectory Projection Beams (exact bounding minRow/maxRow)
      if (state.activePiece && state.ghostPosition && !state.isPaused && !state.gameOver) {
        // Compute active piece bounding columns and occupied row bounds
        let minCol = Infinity;
        let maxCol = -Infinity;
        let minRow = Infinity;
        let maxRow = -Infinity;
        state.activePiece.shape.forEach((row, r) => {
          row.forEach((val, c) => {
            if (val) {
              const col = state.activePiece!.position.x + c;
              if (col < minCol) minCol = col;
              if (col > maxCol) maxCol = col;
              if (r < minRow) minRow = r;
              if (r > maxRow) maxRow = r;
            }
          });
        });

        if (minCol !== Infinity && maxCol !== -Infinity && minRow !== Infinity && maxRow !== -Infinity) {
          const leftX = minCol * BLOCK_SIZE;
          const rightX = (maxCol + 1) * BLOCK_SIZE;
          const startY = Math.max(0, (state.activePiece.position.y + maxRow + 1) * BLOCK_SIZE);
          const endY = (state.ghostPosition.y + minRow) * BLOCK_SIZE;

          if (endY > startY) {
            ctx.save();
            ctx.strokeStyle = state.themeColor;
            ctx.globalAlpha = 0.15;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(leftX, startY);
            ctx.lineTo(leftX, endY);
            ctx.moveTo(rightX, startY);
            ctx.lineTo(rightX, endY);
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.strokeStyle = state.themeColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        state.activePiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value) {
              const gx = (state.ghostPosition!.x + x) * BLOCK_SIZE;
              const gy = (state.ghostPosition!.y + y) * BLOCK_SIZE;
              if (gy >= 0) {
                ctx.strokeRect(gx + 2, gy + 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
              }
            }
          });
        });
        ctx.setLineDash([]);
      }

      // Active Falling Piece (with glowing bloom)
      if (state.activePiece && !state.isPaused && !state.gameOver) {
        const pieceColor = COLORS[state.activePiece.type];
        ctx.fillStyle = pieceColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = pieceColor;

        state.activePiece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value) {
              const px = (state.activePiece!.position.x + x) * BLOCK_SIZE;
              const py = (state.activePiece!.position.y + y) * BLOCK_SIZE;
              if (py >= 0) {
                ctx.fillRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 3, BLOCK_SIZE - 3);
              }
            }
          });
        });
        ctx.shadowBlur = 0;
      }

      // Adversary Locked Cell (Pulsing Target Lock)
      if (state.lockedCell && !state.isPaused && !state.gameOver) {
        const lx = state.lockedCell.x * BLOCK_SIZE;
        const ly = state.lockedCell.y * BLOCK_SIZE;
        const pulse = 0.4 + Math.sin(Date.now() / 150) * 0.35;

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ef4444';
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.fillRect(lx, ly, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx + 6, ly + 6);
        ctx.lineTo(lx + BLOCK_SIZE - 7, ly + BLOCK_SIZE - 7);
        ctx.moveTo(lx + BLOCK_SIZE - 7, ly + 6);
        ctx.lineTo(lx + 6, ly + BLOCK_SIZE - 7);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 4. Smooth Particle Physics Update & Render (Zero-allocation in-place update)
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(p.x, p.y, p.size, p.size);
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;

        if (p.life <= 0) {
          particles[i] = particles[particles.length - 1];
          particles.pop();
        }
      }
      ctx.globalAlpha = 1.0;

      ctx.restore();

      // Issue 1.4: Use cached font family without per-frame getComputedStyle layout thrashing
      const orbitronFamily = fontRef.current;

      // Combo Text Overlay with Dynamic Pulsing
      if (state.comboMessage) {
        ctx.save();
        ctx.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
        const scale = 1 + Math.sin(Date.now() / 70) * 0.08;
        ctx.scale(scale, scale);
        ctx.font = `bold 26px ${orbitronFamily}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = state.comboMessage.type === 'tetris' 
          ? '#06b6d4' 
          : state.comboMessage.type === 'tspin' 
          ? '#c084fc' 
          : '#ef4444';
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(state.comboMessage.text, 0, 0);
        ctx.restore();
      }

      // Game Over Overlay
      if (state.gameOver) {
        ctx.fillStyle = 'rgba(15, 0, 0, 0.9)';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        ctx.fillStyle = '#ef4444';
        ctx.font = `bold 24px ${orbitronFamily}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ef4444';
        ctx.fillText('CRITICAL_FAILURE', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 24);

        ctx.shadowBlur = 0;
        ctx.font = `11px ${orbitronFamily}, sans-serif`;
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('SYSTEM OVERRUN BY ENTROPY', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 8);
        ctx.fillStyle = '#22d3ee';
        // Issue 3.2 Fix: Responsive Call-to-Action for touch and desktop
        ctx.fillText('TAP MATRIX OR PRESS [ENTER]', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 36);
      } else if (state.isPaused) {
        // Paused Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        ctx.fillStyle = state.themeColor;
        ctx.font = `bold 26px ${orbitronFamily}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('STANDBY', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 16);

        ctx.font = `11px ${orbitronFamily}, sans-serif`;
        ctx.fillStyle = '#9ca3af';
        // Issue 3.2 Fix: Responsive Call-to-Action for touch and desktop
        ctx.fillText('TAP MATRIX OR PRESS [ENTER]', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 24);
      }

      // Issue 14 Fix: Suspend RAF loop completely when paused/gameOver and idle (0% CPU/battery drain)
      if ((state.isPaused || state.gameOver) && particlesRef.current.length === 0 && shakeIntensityRef.current === 0) {
        isLoopRunningRef.current = false;
        animationIdRef.current = null;
        return;
      }

      animationIdRef.current = requestAnimationFrame(render);
    };

    renderRef.current = render;
    isLoopRunningRef.current = true;
    animationIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      isLoopRunningRef.current = false;
    };
  }, []);

  // Issue 7 Fix: Touch swipe gesture handlers for intuitive mobile gameplay
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    onUserGesture?.();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    } else if (e.touches.length === 2) {
      e.preventDefault();
      onHold?.();
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 15 && absY < 15 && dt < 280) {
      if (stateRef.current.isPaused || stateRef.current.gameOver) {
        onCanvasClick?.();
      } else {
        onRotate?.();
      }
      return;
    }

    if (stateRef.current.isPaused || stateRef.current.gameOver) return;

    if (absX > absY && absX > 25) {
      if (dx > 0) onMoveRight?.();
      else onMoveLeft?.();
    } else if (absY > absX && absY > 30) {
      if (dy > 0) {
        if (dt < 220 && absY > 50) onHardDrop?.();
        else onSoftDrop?.();
      } else {
        onHold?.();
      }
    }
  };

  return (
    <>
      {/* Issue 18 Fix: Visually hidden structured DOM table for screen readers */}
      <div className="sr-only">
        <h2>Entropic Matrix Board Information</h2>
        <p>Level: {level}, Lines Cleared: {lines}, Score: {score}, Combo: {combo}</p>
        <table aria-label="Tetris Matrix Column Profile">
          <thead><tr><th>Col</th><th>Height</th></tr></thead>
          <tbody>
            {Array.from({ length: COLS }, (_, colIdx) => {
              let colHeight = 0;
              for (let r = 0; r < ROWS; r++) {
                if (grid[r][colIdx] !== 0) { colHeight = ROWS - r; break; }
              }
              return (
                <tr key={colIdx}>
                  <td>Column {colIdx + 1}</td>
                  <td>{colHeight} blocks</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Issue 5 Fix: Responsive Game Canvas Shell with true 10:20 aspect ratio and no distorting inline styles */}
      <div className="relative p-1 bg-gray-950 border-2 border-gray-800 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          role="application"
          aria-label="Entropic Tetris Matrix Board"
          tabIndex={0}
          onClick={() => {
            onUserGesture?.();
            onCanvasClick?.();
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="rounded-lg block focus:outline-none focus:ring-1 focus:ring-cyan-500/50 h-[46vh] sm:h-[54vh] lg:h-[600px] aspect-[10/20] w-auto max-w-full cursor-pointer touch-none"
        />
      </div>
    </>
  );
};
