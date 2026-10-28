'use client';
import React, { useRef, useEffect } from 'react';
import { 
  RotateCw, RotateCcw, Play, Pause, 
  ArrowLeft, ArrowRight, ArrowDown, ArrowDownToLine, RefreshCw 
} from 'lucide-react';

interface MobileControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onSoftDrop: () => void;
  onHardDrop: () => void;
  onHold: () => void;
  onTogglePause: () => void;
  isPaused: boolean;
}

// Issue 6 Fix: Action ref with useEffect synchronization avoids stale closures
const useTouchHold = (action: () => void) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  });

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    actionRef.current();
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        actionRef.current();
      }, 45);
    }, 150);
  };

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
};

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMoveLeft,
  onMoveRight,
  onRotateCW,
  onRotateCCW,
  onSoftDrop,
  onHardDrop,
  onHold,
  onTogglePause,
  isPaused,
}) => {
  const leftHold = useTouchHold(onMoveLeft);
  const rightHold = useTouchHold(onMoveRight);
  const downHold = useTouchHold(onSoftDrop);

  return (
    // Issue 3.1 Fix: Dual-Cluster Ergonomic Mobile Controls (Left Thumb Navigation, Right Thumb Actions)
    <div className="flex flex-col gap-2 w-full max-w-[360px] lg:hidden select-none mt-1">
      {/* Top Utility Bar */}
      <div className="flex justify-between items-center px-1">
        <button
          onClick={onTogglePause}
          className="flex-1 py-1.5 px-3 bg-gray-950 border border-gray-800 rounded text-[10px] active:bg-cyan-950/60 font-orbitron flex items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-cyan-300 transition-colors"
          aria-label={isPaused ? "Resume Game" : "Pause Game"}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 text-cyan-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
          <span>{isPaused ? "RESUME MATRIX [ENTER]" : "PAUSE MATRIX"}</span>
        </button>
      </div>

      {/* Main Dual Cluster */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {/* Left Thumb Cluster: D-Pad Navigation */}
        <div className="flex flex-col gap-1.5 bg-black/60 p-2 rounded-xl border border-gray-900 shadow-inner">
          <div className="text-[8px] font-orbitron text-gray-500 uppercase tracking-widest text-center">
            D-PAD NAV
          </div>
          <div className="grid grid-cols-3 gap-1.5 items-center">
            <button 
              {...leftHold}
              className="min-h-[48px] p-2 bg-gray-900 border border-gray-800 rounded-lg active:bg-cyan-950 font-orbitron flex items-center justify-center cursor-pointer text-cyan-300 shadow-md active:scale-95 transition-transform"
              aria-label="Move Left"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button 
              {...downHold}
              className="min-h-[48px] p-2 bg-gray-900 border border-gray-800 rounded-lg active:bg-cyan-950 font-orbitron flex items-center justify-center cursor-pointer text-cyan-300 shadow-md active:scale-95 transition-transform"
              aria-label="Soft Drop"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <button 
              {...rightHold}
              className="min-h-[48px] p-2 bg-gray-900 border border-gray-800 rounded-lg active:bg-cyan-950 font-orbitron flex items-center justify-center cursor-pointer text-cyan-300 shadow-md active:scale-95 transition-transform"
              aria-label="Move Right"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Thumb Cluster: Rotations & Tactical Actions */}
        <div className="flex flex-col gap-1.5 bg-black/60 p-2 rounded-xl border border-gray-900 shadow-inner">
          <div className="text-[8px] font-orbitron text-gray-500 uppercase tracking-widest text-center">
            ACTION CLUSTER
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button 
              onClick={onRotateCCW}
              className="min-h-[48px] p-2 bg-gray-900 border border-gray-800 rounded-lg active:bg-cyan-950 font-orbitron flex items-center justify-center cursor-pointer text-cyan-300 shadow-md active:scale-95 transition-transform"
              aria-label="Rotate Counter-Clockwise"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={onRotateCW}
              className="min-h-[48px] p-2 bg-gray-900 border border-gray-800 rounded-lg active:bg-cyan-950 font-orbitron flex items-center justify-center cursor-pointer text-cyan-300 shadow-md active:scale-95 transition-transform"
              aria-label="Rotate Clockwise"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button 
              onClick={onHardDrop}
              className="min-h-[48px] p-2 bg-cyan-950/80 border border-cyan-800 rounded-lg active:bg-cyan-800 font-orbitron text-cyan-200 flex items-center justify-center cursor-pointer shadow-md active:scale-95 transition-transform"
              aria-label="Hard Drop"
            >
              <ArrowDownToLine className="w-5 h-5 text-cyan-300" />
            </button>
            <button 
              onClick={onHold}
              className="min-h-[48px] p-2 bg-gray-900 border border-gray-800 rounded-lg active:bg-cyan-950 font-orbitron flex items-center justify-center cursor-pointer text-amber-300 shadow-md active:scale-95 transition-transform"
              aria-label="Hold Piece"
            >
              <RefreshCw className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
