'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTetris, AudioEventType } from '../hooks/useTetris';
import { COLS, ROWS, COLORS, SHAPES, PieceType } from '../lib/tetris';

const BLOCK_SIZE = 30;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

// Procedural Web Audio Synthesizer
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(event: AudioEventType) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    switch (event) {
      case 'move': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }
      case 'rotate': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'softdrop': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.02);
        break;
      }
      case 'harddrop': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'lock': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }
      case 'clear': {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);
          gain.gain.setValueAtTime(0.08, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + idx * 0.04 + 0.12);
        });
        break;
      }
      case 'tetris': {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.12, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.25);
        });
        break;
      }
      case 'purge': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case 'gameover': {
        [400, 350, 300, 220].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.1, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.18);
        });
        break;
      }
    }
  }
}

const synth = new SoundSynthesizer();

export const TetrisBoard: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highScore, setHighScore] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shakeIntensityRef = useRef<number>(0);
  const rainMatrixRef = useRef<{ x: number; y: number; char: string; speed: number }[]>([]);

  // Sound event handler
  const handleAudioEvent = useCallback((event: AudioEventType) => {
    synth.play(event);
  }, []);

  const { 
    grid, activePiece, ghostPosition, nextPieceType, holdPiece,
    movePiece, rotatePiece, hardDrop, holdPieceAction, togglePause,
    score, lines, gameOver, isPaused, chaos, thoughts, lockedCell, comboMessage, wsConnected
  } = useTetris({ onAudioEvent: handleAudioEvent });

  // Load / Update High Score
  useEffect(() => {
    try {
      const saved = localStorage.getItem('entropic_tetris_highscore');
      if (saved) {
        const val = parseInt(saved, 10) || 0;
        requestAnimationFrame(() => setHighScore(val));
      }
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  useEffect(() => {
    if (score > 0) {
      try {
        const saved = parseInt(localStorage.getItem('entropic_tetris_highscore') || '0', 10);
        if (score > saved) {
          localStorage.setItem('entropic_tetris_highscore', score.toString());
          requestAnimationFrame(() => setHighScore(score));
        }
      } catch {
        // Safe fallback
      }
    }
  }, [score]);

  // Sync sound mute state
  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    synth.enabled = nextState;
  };

  // Pre-seed background cyber substrate rain
  useEffect(() => {
    const rain = [];
    for (let i = 0; i < 30; i++) {
      rain.push({
        x: Math.random() * (COLS * BLOCK_SIZE),
        y: Math.random() * (ROWS * BLOCK_SIZE),
        char: String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)),
        speed: 0.5 + Math.random() * 1.5,
      });
    }
    rainMatrixRef.current = rain;
  }, []);

  // Color Theme calculations based on chaos meter
  const getThemeColor = useCallback((opacity = 1) => {
    if (chaos < 40) return `rgba(6, 182, 212, ${opacity})`; // Cyan
    if (chaos < 75) return `rgba(234, 179, 8, ${opacity})`; // Yellow
    return `rgba(239, 68, 68, ${opacity})`; // Red
  }, [chaos]);

  const themeColor = getThemeColor(1);
  const themeColorMuted = getThemeColor(0.5);

  // Trigger shake and particles on combo / purge
  useEffect(() => {
    if (comboMessage?.type === 'purge' && lockedCell) {
      shakeIntensityRef.current = 18;
      const lx = lockedCell.x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const ly = lockedCell.y * BLOCK_SIZE + BLOCK_SIZE / 2;
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
    } else if (comboMessage?.type === 'tetris') {
      shakeIntensityRef.current = 14;
      for (let i = 0; i < 40; i++) {
        particlesRef.current.push({
          x: Math.random() * (COLS * BLOCK_SIZE),
          y: (ROWS - 4) * BLOCK_SIZE + Math.random() * (4 * BLOCK_SIZE),
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 6 - 2,
          life: 1.0,
          size: Math.random() * 4 + 2,
          color: '#06b6d4',
        });
      }
    }
  }, [comboMessage, lockedCell]);

  // Keep state refs for smooth 60fps canvas render loop
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

  // Synchronize state ref after render for the continuous animation loop
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
  });

  // Dedicated Continuous Canvas Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const state = stateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Decay shake
      if (shakeIntensityRef.current > 0) {
        shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - 0.5);
      }
      const shakeOffset = shakeIntensityRef.current > 0
        ? (Math.sin(Date.now() / 20) * shakeIntensityRef.current)
        : 0;

      ctx.clearRect(0, 0, width, height);

      // 1. Dark Background Substrate
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, width, height);

      // 2. Continuous Cyber Rain Substrate
      ctx.font = '10px monospace';
      ctx.fillStyle = state.chaos > 70 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(6, 182, 212, 0.08)';
      rainMatrixRef.current.forEach(item => {
        ctx.fillText(item.char, item.x, item.y);
        item.y += item.speed;
        if (item.y > height) {
          item.y = -10;
          item.x = Math.random() * width;
        }
      });

      // 3. Shake & Translation Layer
      ctx.save();
      ctx.translate(shakeOffset, 0);

      // Grid Cells & Placed Blocks
      state.grid.forEach((row, y) => {
        row.forEach((value, x) => {
          const px = x * BLOCK_SIZE;
          const py = y * BLOCK_SIZE;

          if (value !== 0) {
            const pieceColor = COLORS[value as unknown as PieceType] || '#4b5563';
            ctx.fillStyle = pieceColor;
            ctx.shadowBlur = 6;
            ctx.shadowColor = pieceColor;
            ctx.fillRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

            // Block inner bevel highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
            ctx.shadowBlur = 0;
          } else {
            // Subtle grid guides
            ctx.strokeStyle = 'rgba(31, 41, 55, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
          }
        });
      });

      // Ghost Piece (Dashed outline)
      if (state.activePiece && state.ghostPosition && !state.isPaused && !state.gameOver) {
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

      // Active Falling Piece
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

      // 4. Smooth Particle Physics Update & Render
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(p.x, p.y, p.size, p.size);
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
      });
      ctx.globalAlpha = 1.0;

      ctx.restore();

      // Combo Text Overlay with Dynamic Pulsing
      if (state.comboMessage) {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        const scale = 1 + Math.sin(Date.now() / 70) * 0.08;
        ctx.scale(scale, scale);
        ctx.font = 'bold 26px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = state.comboMessage.type === 'tetris' ? '#06b6d4' : '#ef4444';
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(state.comboMessage.text, 0, 0);
        ctx.restore();
      }

      // Game Over Overlay
      if (state.gameOver) {
        ctx.fillStyle = 'rgba(15, 0, 0, 0.9)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ef4444';
        ctx.fillText('CRITICAL_FAILURE', width / 2, height / 2 - 24);

        ctx.shadowBlur = 0;
        ctx.font = '12px Orbitron, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('SYSTEM OVERRUN BY ENTROPY', width / 2, height / 2 + 8);
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('PRESS [ENTER] TO REBOOT', width / 2, height / 2 + 36);
      } else if (state.isPaused) {
        // Paused Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = state.themeColor;
        ctx.font = 'bold 26px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STANDBY', width / 2, height / 2 - 16);

        ctx.font = '12px Orbitron, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('PRESS [ENTER] TO ENGAGE', width / 2, height / 2 + 24);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const renderMiniPiece = (type: PieceType | null) => {
    if (!type) return <div className="w-16 h-16 bg-gray-950/60 rounded border border-gray-800/60" />;
    const shape = SHAPES[type];
    return (
      <div className="grid grid-cols-4 gap-1 p-2 bg-black/70 border border-gray-800 rounded shadow-inner">
        {shape.flat().map((val, i) => (
          <div
            key={i}
            className={`w-3 h-3 ${val ? '' : 'opacity-0'}`}
            style={{ backgroundColor: COLORS[type] }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 p-4 sm:p-8 bg-black text-white font-share-tech min-h-screen selection:bg-cyan-500/30 relative overflow-hidden">
      {/* Background Neural Circuit Lines */}
      <svg className="absolute inset-0 pointer-events-none z-0 opacity-20 w-full h-full">
        <line x1="15%" y1="10%" x2="45%" y2="50%" stroke={themeColor} strokeWidth="0.5" />
        <line x1="85%" y1="15%" x2="60%" y2="45%" stroke={themeColor} strokeWidth="0.5" />
        <line x1="10%" y1="85%" x2="35%" y2="60%" stroke={themeColor} strokeWidth="0.5" />
      </svg>

      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] opacity-25" />

      {/* LEFT PANEL */}
      <div className="flex flex-col gap-4 w-full sm:w-64 lg:w-48 shrink-0 relative z-10">
        {/* Hold Matrix */}
        <div className="p-4 border-2 bg-black/85 backdrop-blur-xl relative overflow-hidden transition-colors duration-700" style={{ borderColor: themeColorMuted }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 flex justify-between items-center font-orbitron" style={{ color: themeColor }}>
            <span>Hold Matrix</span>
            <span className="text-[9px] text-gray-500">[C]</span>
          </div>
          <div className="flex justify-center h-20 items-center bg-black/50 rounded border border-gray-900 shadow-inner">
            {renderMiniPiece(holdPiece)}
          </div>
        </div>

        {/* Entropy Pulse Bar */}
        <div className="p-4 border border-red-950/40 bg-black/85 backdrop-blur-xl relative overflow-hidden">
          <div className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] mb-3 font-orbitron flex justify-between items-center">
            <span>Entropy Pulse</span>
            <span className="text-[9px] tabular-nums">{chaos}%</span>
          </div>
          <div className="h-44 w-full bg-black border border-red-900/30 relative overflow-hidden flex flex-col-reverse rounded">
            <div 
              className="w-full bg-gradient-to-t from-red-950 via-red-600 to-red-400 transition-all duration-500"
              style={{ height: `${chaos}%`, boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}
            />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.5)_2px,rgba(0,0,0,0.5)_4px)] pointer-events-none" />
          </div>
        </div>

        {/* System Stats Card */}
        <div className="p-3 border border-gray-900 bg-gray-950/80 rounded flex flex-col gap-2 text-[10px] font-orbitron">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">HI-SCORE</span>
            <span className="text-white font-bold tabular-nums">{highScore.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">LINES</span>
            <span className="text-cyan-400 font-bold tabular-nums">{lines}</span>
          </div>
          <div className="flex justify-between items-center border-t border-gray-900 pt-1.5">
            <span className="text-gray-500">LINK</span>
            <span className={`flex items-center gap-1.5 ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {wsConnected ? 'NEURAL_WS' : 'LOCAL_FALLBACK'}
            </span>
          </div>
        </div>
      </div>

      {/* CENTER PANEL (GAME CANVAS) */}
      <div className="flex flex-col items-center gap-3 relative z-10">
        {/* Header HUD */}
        <div className="flex justify-between items-end w-full px-2 border-b border-gray-800 pb-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight italic leading-none font-orbitron bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              ENTROPIC
            </h1>
            <div className="text-[9px] text-cyan-400/80 mt-1 font-orbitron tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
              SYSTEM_PROTOCOL // AGGRESSIVE_ADVERSARY
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowManual(true)}
                className="text-[9px] font-orbitron px-2 py-0.5 border border-cyan-800/80 rounded hover:border-cyan-400 bg-cyan-950/40 text-cyan-300 transition-colors cursor-pointer"
              >
                [?] MANUAL / README
              </button>
              <button
                onClick={toggleSound}
                className="text-[9px] font-orbitron px-2 py-0.5 border border-gray-800 rounded hover:border-cyan-500/50 transition-colors text-gray-400 hover:text-white cursor-pointer"
              >
                AUDIO: {soundEnabled ? 'ON' : 'MUTED'}
              </button>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-orbitron text-white tabular-nums drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
              {score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Canvas Board Shell */}
        <div className="relative p-1 bg-gray-950 border-2 border-gray-800 rounded-xl shadow-2xl overflow-hidden">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
            className="rounded-lg max-w-full block"
          />
        </div>

        {/* Mobile / Touch On-Screen Controls */}
        <div className="flex flex-wrap justify-center gap-2 mt-2 w-full max-w-[320px] lg:hidden">
          <button onClick={() => movePiece(-1, 0)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs active:bg-cyan-950 font-orbitron">LEFT</button>
          <button onClick={() => rotatePiece('cw')} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs active:bg-cyan-950 font-orbitron">ROT</button>
          <button onClick={() => movePiece(1, 0)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs active:bg-cyan-950 font-orbitron">RIGHT</button>
          <button onClick={() => movePiece(0, 1)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs active:bg-cyan-950 font-orbitron">DOWN</button>
          <button onClick={hardDrop} className="px-3 py-2 bg-cyan-950/80 border border-cyan-800 rounded text-xs active:bg-cyan-800 font-orbitron text-cyan-200">DROP</button>
          <button onClick={holdPieceAction} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs active:bg-cyan-950 font-orbitron">HOLD</button>
          <button onClick={togglePause} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded text-xs active:bg-cyan-950 font-orbitron">{isPaused ? 'RESUME' : 'PAUSE'}</button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col gap-4 w-full sm:w-64 lg:w-72 relative z-10">
        {/* Next Adversarial Piece */}
        <div className="p-4 border-2 bg-black/85 backdrop-blur-xl relative overflow-hidden transition-colors duration-700" style={{ borderColor: themeColorMuted }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 flex justify-between items-center font-orbitron" style={{ color: themeColor }}>
            <span>Adversary Next</span>
            <span className="text-[8px] px-1.5 py-0.5 bg-black/40 border border-gray-800 rounded text-cyan-400">
              PREDICTIVE
            </span>
          </div>
          <div className="flex justify-center items-center h-20 bg-black/50 border border-gray-900 rounded shadow-inner">
            {renderMiniPiece(nextPieceType)}
          </div>
        </div>

        {/* Agent Intel Terminal */}
        <div className="h-56 p-4 border-2 bg-black/85 backdrop-blur-xl flex flex-col relative overflow-hidden transition-colors duration-700" style={{ borderColor: themeColorMuted }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-orbitron" style={{ color: themeColor }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
            Agent Intel Log
          </div>
          <div className="flex-1 font-mono text-[9px] text-gray-400 space-y-2 overflow-y-auto scrollbar-none pr-1">
            {thoughts.map((thought, i) => (
              <div key={i} className={`flex gap-2 leading-relaxed ${i === 0 ? 'text-cyan-200 font-bold' : 'opacity-40'}`}>
                <span className="text-cyan-700 shrink-0">[{thought.time}]</span>
                <p>{thought.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Kernel Controls Reference */}
        <div className="p-3 bg-gray-950/80 border border-gray-800 rounded shadow-lg text-[9px] font-mono">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-orbitron">Controls</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-400">
            <div className="flex justify-between"><span>MOVE</span><span className="text-cyan-400 font-bold">[←/→]</span></div>
            <div className="flex justify-between"><span>ROT CW</span><span className="text-cyan-400 font-bold">[↑]</span></div>
            <div className="flex justify-between"><span>ROT CCW</span><span className="text-cyan-400 font-bold">[Z/CTRL]</span></div>
            <div className="flex justify-between"><span>SOFT</span><span className="text-cyan-400 font-bold">[↓]</span></div>
            <div className="flex justify-between"><span>HARD</span><span className="text-cyan-400 font-bold">[SPACE]</span></div>
            <div className="flex justify-between"><span>HOLD</span><span className="text-cyan-400 font-bold">[C]</span></div>
            <div className="flex justify-between"><span>START/PAUSE</span><span className="text-cyan-400 font-bold">[ENTER]</span></div>
          </div>
        </div>
      </div>

      {/* SYSTEM MANUAL / README MODAL OVERLAY */}
      {showManual && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-black/95 border-2 border-cyan-500/60 rounded-xl max-w-2xl w-full p-6 text-white font-share-tech shadow-[0_0_50px_rgba(6,182,212,0.3)] relative max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
              <div>
                <h2 className="text-xl font-black font-orbitron text-cyan-300 tracking-wider">
                  SYSTEM PROTOCOL // OPERATIONAL MANUAL (README)
                </h2>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                  ENTROPIC_TETRIS // ARCHITECTURE_SPECIFICATION
                </p>
              </div>
              <button
                onClick={() => setShowManual(false)}
                className="text-gray-400 hover:text-white px-2.5 py-1 text-sm border border-gray-800 rounded hover:border-cyan-500 transition-colors cursor-pointer font-orbitron"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-xs text-gray-300 leading-relaxed font-mono">
              <section className="bg-gray-950/60 p-3.5 rounded border border-gray-900">
                <h3 className="text-sm font-bold font-orbitron text-cyan-400 mb-1.5 uppercase">
                  1. Threat Overview: The Adversarial Engine
                </h3>
                <p>
                  Entropic Tetris replaces traditional 7-bag randomizers with a predictive, adversarial AI running on a Python FastAPI backend. For every move, the adversary executes a 1-ply minimax simulation across all 7 tetrominoes, projecting wall-kicks, placements, and line clears. It selects the piece that leaves the player with maximum entropy (highest aggregate height, holes, and surface bumpiness).
                </p>
              </section>

              <section className="bg-gray-950/60 p-3.5 rounded border border-gray-900">
                <h3 className="text-sm font-bold font-orbitron text-red-400 mb-1.5 uppercase">
                  2. Shadow Sabotage & System Purge Protocol
                </h3>
                <p className="mb-2">
                  Periodically, the AI triggers a <span className="text-red-400 font-bold">CELL LOCK</span> (highlighted by a pulsing red crosshair) directly underneath your falling piece to disrupt placement vectors.
                </p>
                <div className="p-2 bg-red-950/30 border border-red-900/50 rounded text-red-200">
                  <span className="font-bold text-white">COUNTERMEASURE:</span> Completing the row containing the locked cell initiates a <span className="text-cyan-300 font-bold">SYSTEM_PURGE</span>. This destroys the lock, zeroes the Chaos Meter, and awards a <span className="text-amber-300 font-bold">+1,000 pt</span> bonus.
                </div>
              </section>

              <section className="bg-gray-950/60 p-3.5 rounded border border-gray-900">
                <h3 className="text-sm font-bold font-orbitron text-amber-400 mb-1.5 uppercase">
                  3. Chaos Pulse & Visual Instability
                </h3>
                <p>
                  The left panel monitors your board entropy in real-time:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-gray-400">
                  <li><span className="text-cyan-400 font-bold">0% – 39%:</span> Stable Matrix (Cyan illumination)</li>
                  <li><span className="text-amber-400 font-bold">40% – 74%:</span> Warning State (Amber alerts, accelerated drops)</li>
                  <li><span className="text-red-500 font-bold">75% – 100%:</span> Critical Threshold (Red alert, chromatic jitter, hazard noise)</li>
                </ul>
              </section>

              <section className="bg-gray-950/60 p-3.5 rounded border border-gray-900">
                <h3 className="text-sm font-bold font-orbitron text-cyan-400 mb-1.5 uppercase">
                  4. Tactical Controls Reference
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div><span className="text-cyan-400 font-bold">[←] / [→]</span> : Lateral shift (DAS/ARR enabled)</div>
                  <div><span className="text-cyan-400 font-bold">[↑]</span> : Rotate Clockwise</div>
                  <div><span className="text-cyan-400 font-bold">[Z] / [CTRL]</span> : Rotate Counter-Clockwise</div>
                  <div><span className="text-cyan-400 font-bold">[↓]</span> : Soft Drop (tactical positioning)</div>
                  <div><span className="text-cyan-400 font-bold">[SPACE]</span> : Hard Drop (instant lock)</div>
                  <div><span className="text-cyan-400 font-bold">[C]</span> : Hold Matrix swap</div>
                  <div><span className="text-cyan-400 font-bold">[ENTER]</span> : Engage / Pause / Reboot</div>
                  <div><span className="text-cyan-400 font-bold">[P] / [ESC]</span> : Pause toggle</div>
                </div>
              </section>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-800 pt-3 mt-4 flex justify-between items-center">
              <span className="text-[10px] text-gray-500 font-mono">
                PRESS ESC OR DISMISS TO RESUME
              </span>
              <button
                onClick={() => setShowManual(false)}
                className="px-4 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-cyan-200 font-orbitron text-xs rounded transition-colors cursor-pointer"
              >
                DISMISS / ENGAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
