'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTetris, GameTelemetry } from '../hooks/useTetris';
import { SoundSynthesizer, AudioEventType } from '../lib/sound';
import { MatrixCanvas } from './MatrixCanvas';
import { MobileControls } from './MobileControls';
import { 
  HoldPanel, EntropyPulse, SystemStats, 
  AdversaryNextPanel, AgentIntelTerminal, ControlsReference, MobileStatusBar,
  MobileThoughtTicker
} from './HudPanels';
import { ManualModal } from './ManualModal';
import { LeaderboardModal } from './LeaderboardModal';
import { Volume2, Volume1, VolumeX, HelpCircle, Trophy, Play, Pause } from 'lucide-react';

export const TetrisBoard: React.FC = () => {
  const [volume, setVolume] = useState(1.0);
  const [personalBest, setPersonalBest] = useState(0);
  const [globalRecord, setGlobalRecord] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{ 
    score: number; 
    lines: number; 
    level: number; 
    telemetry?: GameTelemetry 
  } | null>(null);
  const [lastFinishedRun, setLastFinishedRun] = useState<{
    score: number;
    lines: number;
    level: number;
    telemetry: GameTelemetry;
  } | null>(null);
  const [submittedRunId, setSubmittedRunId] = useState<string | null>(null);
  
  const synthRef = useRef<SoundSynthesizer | null>(null);

  // Issue 16 Fix: Clean AudioContext lifecycle hook
  useEffect(() => {
    synthRef.current = new SoundSynthesizer();
    return () => {
      synthRef.current?.teardown();
    };
  }, []);

  // Sound event handler
  const handleAudioEvent = useCallback((event: AudioEventType) => {
    synthRef.current?.play(event);
  }, []);

  // Issue 1 Fix: Pass modal isolation boolean to useTetris
  const isModalOpen = showManual || showLeaderboard;

  const { 
    grid, activePiece, ghostPosition, nextPieceType, holdPiece, canHold,
    movePiece, rotatePiece, hardDrop, holdPieceAction, togglePause,
    score, lines, level, combo, gameOver, isPaused, chaos, thoughts, lockedCell, comboMessage,
    getGameTelemetry
  } = useTetris({ onAudioEvent: handleAudioEvent, isModalOpen });

  // Issue 13 Fix: Drive cyberpunk ambient tension drone scaling with chaos
  useEffect(() => {
    if (!isPaused && !gameOver && volume > 0) {
      synthRef.current?.startAmbientDrone();
      synthRef.current?.updateDroneChaos(chaos);
    } else {
      synthRef.current?.stopAmbientDrone();
    }
  }, [isPaused, gameOver, chaos, volume]);

  // Issue 2.1 Fix: Opening manual modal pauses the active game matrix
  const handleOpenManual = () => {
    if (!isPaused && !gameOver) {
      togglePause();
    }
    setShowManual(true);
  };

  // Issue 9 Fix: Opening leaderboard modal preserves game-over score submission if pending
  const handleOpenLeaderboard = () => {
    if (!isPaused && !gameOver) {
      togglePause();
    }
    if (gameOver && lastFinishedRun && !submittedRunId) {
      setPendingSubmission(lastFinishedRun);
    }
    setShowLeaderboard(true);
  };

  const handleCloseLeaderboard = useCallback(() => {
    setShowLeaderboard(false);
    setPendingSubmission(null);
  }, []);

  const handleReboot = useCallback(() => {
    setShowLeaderboard(false);
    setPendingSubmission(null);
    togglePause();
  }, [togglePause]);

  // Reset run submission record when a new game begins
  useEffect(() => {
    if (!gameOver && lastFinishedRun) {
      queueMicrotask(() => {
        setLastFinishedRun(null);
        setSubmittedRunId(null);
      });
    }
  }, [gameOver, lastFinishedRun]);

  // Issue 19 Fix: Screen reader announcements only on milestone events (pure derived calculation)
  const announcement = gameOver
    ? `Critical failure. Game over. Final score: ${score}`
    : comboMessage
    ? `${comboMessage.text}! Level: ${level}, Score: ${score}`
    : 'Entropic Tetris Matrix ready. Press Enter to engage.';

  // Issue 20 & Decoupling Fix: Load Personal Best from localStorage and Global Record from /api/leaderboard
  useEffect(() => {
    try {
      const saved = localStorage.getItem('entropic_tetris_highscore');
      if (saved) {
        const val = parseInt(saved, 10) || 0;
        queueMicrotask(() => setPersonalBest(val));
      }
    } catch {
      // localStorage fallback
    }

    // Query global leaderboard
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (data?.leaderboard?.[0]?.score) {
          const topScore = data.leaderboard[0].score;
          setGlobalRecord(topScore);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (score > personalBest) {
      queueMicrotask(() => setPersonalBest(score));
      try {
        localStorage.setItem('entropic_tetris_highscore', score.toString());
      } catch {
        // Safe fallback
      }
    }
  }, [score, personalBest]);

  // Issue 9 Fix: On Game Over with any score > 0, prompt player for callsign submission with telemetry
  useEffect(() => {
    if (gameOver && score > 0) {
      const telemetry = getGameTelemetry();
      const run = { score, lines, level, telemetry };
      queueMicrotask(() => {
        setLastFinishedRun(run);
        setPendingSubmission(run);
        setShowLeaderboard(true);
      });
    }
  }, [gameOver, score, lines, level, getGameTelemetry]);

  // Stepped audio volume cycle: 100% -> 60% -> 25% -> MUTED -> 100% (Issue 4.3 fix)
  const cycleVolume = () => {
    let nextVol = 1.0;
    if (volume === 1.0) nextVol = 0.6;
    else if (volume === 0.6) nextVol = 0.25;
    else if (volume === 0.25) nextVol = 0;
    else nextVol = 1.0;

    setVolume(nextVol);
    synthRef.current?.setVolume(nextVol);
  };

  // Color Theme calculations based on chaos meter
  const getThemeColor = useCallback((opacity = 1) => {
    if (chaos < 40) return `rgba(6, 182, 212, ${opacity})`; // Cyan
    if (chaos < 75) return `rgba(234, 179, 8, ${opacity})`; // Yellow
    return `rgba(239, 68, 68, ${opacity})`; // Red
  }, [chaos]);

  const themeColor = getThemeColor(1);
  const themeColorMuted = getThemeColor(0.5);

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 lg:gap-6 p-2 sm:p-6 lg:p-8 bg-black text-white font-share-tech min-h-screen selection:bg-cyan-500/30 relative overflow-x-hidden touch-manipulation">
      {/* Issue 19 Fix: Screen Reader Milestone Announcer */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Background Neural Circuit Lines */}
      <svg className="absolute inset-0 pointer-events-none z-0 opacity-20 w-full h-full">
        <line x1="15%" y1="10%" x2="45%" y2="50%" stroke={themeColor} strokeWidth="0.5" />
        <line x1="85%" y1="15%" x2="60%" y2="45%" stroke={themeColor} strokeWidth="0.5" />
        <line x1="10%" y1="85%" x2="35%" y2="60%" stroke={themeColor} strokeWidth="0.5" />
      </svg>

      {/* CRT Scanline Overlay (with dynamic jitter noise on critical chaos) */}
      <div className={`absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] transition-opacity duration-300 ${chaos >= 75 ? 'animate-noise opacity-40' : 'opacity-25'}`} />

      {/* LEFT PANEL (Desktop only) */}
      <div className="hidden lg:flex flex-col gap-4 w-48 shrink-0 relative z-10">
        <HoldPanel holdPiece={holdPiece} canHold={canHold} themeColor={themeColor} themeColorMuted={themeColorMuted} />
        <EntropyPulse chaos={chaos} />
        <SystemStats personalBest={personalBest} globalRecord={globalRecord} level={level} lines={lines} />
      </div>

      {/* CENTER PANEL (GAME CANVAS + MOBILE HUD + CONTROLS) */}
      <div className="flex flex-col items-center gap-2 lg:gap-3 w-full max-w-[340px] sm:max-w-[380px] lg:max-w-none relative z-10">
        {/* Header HUD */}
        <div className="flex justify-between items-end w-full px-1 border-b border-gray-800 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight italic leading-none font-orbitron bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              ENTROPIC
            </h1>
            <div className="text-[8px] sm:text-[9px] text-cyan-400/80 mt-0.5 font-orbitron tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
              SYSTEM_PROTOCOL // AGGRESSIVE_ADVERSARY
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePause}
                className="text-[9px] font-orbitron p-1.5 sm:px-2.5 sm:py-2 min-h-[44px] min-w-[44px] border border-gray-800 rounded hover:border-cyan-500/50 bg-gray-950/60 text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                aria-label={isPaused ? "Resume Game Matrix" : "Pause Game Matrix"}
              >
                {isPaused ? <Play className="w-3 h-3 text-emerald-400 shrink-0" /> : <Pause className="w-3 h-3 text-amber-400 shrink-0" />}
                <span className="hidden sm:inline">{isPaused ? (gameOver ? 'REBOOT' : 'RESUME') : 'PAUSE'}</span>
              </button>
              <button
                onClick={handleOpenLeaderboard}
                className="text-[9px] font-orbitron p-1.5 sm:px-2.5 sm:py-2 min-h-[44px] min-w-[44px] border border-amber-800/80 rounded hover:border-amber-400 bg-amber-950/40 text-amber-300 transition-colors cursor-pointer flex items-center justify-center gap-1"
                aria-label="Open Leaderboard"
              >
                <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">RANKS</span>
              </button>
              <button
                onClick={handleOpenManual}
                className="text-[9px] font-orbitron p-1.5 sm:px-2.5 sm:py-2 min-h-[44px] min-w-[44px] border border-cyan-800/80 rounded hover:border-cyan-400 bg-cyan-950/40 text-cyan-300 transition-colors cursor-pointer flex items-center justify-center gap-1"
                aria-label="Open Operational Manual"
              >
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">MANUAL</span>
              </button>
              <button
                onClick={cycleVolume}
                className="text-[9px] font-orbitron p-1.5 sm:px-2.5 sm:py-2 min-h-[44px] min-w-[44px] border border-gray-800 rounded hover:border-cyan-500/50 transition-colors text-gray-400 hover:text-white cursor-pointer flex items-center justify-center gap-1"
                aria-label={`Audio Volume: ${volume === 0 ? 'Muted' : `${Math.round(volume * 100)}%`}`}
              >
                {volume === 0 ? (
                  <VolumeX className="w-3 h-3 text-gray-500 shrink-0" />
                ) : volume <= 0.3 ? (
                  <Volume1 className="w-3 h-3 text-cyan-300 shrink-0" />
                ) : (
                  <Volume2 className="w-3 h-3 text-cyan-400 shrink-0" />
                )}
                <span className="hidden sm:inline">{volume === 0 ? 'MUTE' : `${Math.round(volume * 100)}%`}</span>
              </button>
            </div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black font-orbitron text-white tabular-nums drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
              {score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Compact Mobile Status Bar (with canHold indicator) */}
        <MobileStatusBar 
          holdPiece={holdPiece} 
          canHold={canHold}
          nextPieceType={nextPieceType} 
          chaos={chaos} 
          level={level} 
          lines={lines} 
        />

        {/* Issue 6 Fix: Cyber Thought Ticker for Mobile Operators */}
        <MobileThoughtTicker thought={thoughts[0]?.text} />

        {/* Dedicated 60 FPS Canvas Matrix (Issues 5, 7, 18, 27, 29, 30 & touch gestures) */}
        <MatrixCanvas 
          grid={grid}
          activePiece={activePiece}
          ghostPosition={ghostPosition}
          gameOver={gameOver}
          isPaused={isPaused}
          chaos={chaos}
          lockedCell={lockedCell}
          comboMessage={comboMessage}
          themeColor={themeColor}
          level={level}
          lines={lines}
          score={score}
          combo={combo}
          onCanvasClick={togglePause}
          onMoveLeft={() => movePiece(-1, 0)}
          onMoveRight={() => movePiece(1, 0)}
          onRotate={() => rotatePiece('cw')}
          onSoftDrop={() => movePiece(0, 1)}
          onHardDrop={hardDrop}
          onHold={holdPieceAction}
          onUserGesture={() => synthRef.current?.unlock()}
        />

        {/* Mobile Touch Controls with onTouchCancel & Dual Cluster Ergonomics (Issues 6, 3.1, 3.4) */}
        <MobileControls 
          onMoveLeft={() => movePiece(-1, 0)}
          onMoveRight={() => movePiece(1, 0)}
          onRotateCW={() => rotatePiece('cw')}
          onRotateCCW={() => rotatePiece('ccw')}
          onSoftDrop={() => movePiece(0, 1)}
          onHardDrop={hardDrop}
          onHold={holdPieceAction}
          onTogglePause={togglePause}
          isPaused={isPaused}
        />
      </div>

      {/* RIGHT PANEL (Desktop only) */}
      <div className="hidden lg:flex flex-col gap-4 w-72 relative z-10">
        <AdversaryNextPanel nextPieceType={nextPieceType} themeColor={themeColor} themeColorMuted={themeColorMuted} />
        <AgentIntelTerminal thoughts={thoughts} themeColor={themeColor} themeColorMuted={themeColorMuted} />
        <ControlsReference />
      </div>

      {/* SYSTEM MANUAL MODAL */}
      <ManualModal isOpen={showManual} onClose={() => setShowManual(false)} />

      {/* GLOBAL LEADERBOARD MODAL */}
      <LeaderboardModal 
        isOpen={showLeaderboard} 
        onClose={handleCloseLeaderboard}
        pendingSubmission={pendingSubmission}
        onSubmitted={(topScore) => {
          setSubmittedRunId(Date.now().toString());
          setPendingSubmission(null);
          if (topScore) {
            setGlobalRecord(topScore);
          }
        }}
        onReboot={handleReboot}
      />
    </div>
  );
};
