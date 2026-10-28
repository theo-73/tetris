'use client';
import React from 'react';
import { PieceType, SHAPES, COLORS } from '../lib/tetris';

// Issue 1.2 & Issue 8 Fix: Render canonical tetromino dimensions with uniform dimensions (Zero CLS)
export const renderMiniPiece = (type: PieceType | null) => {
  if (!type) return <div className="w-[52px] h-[52px] lg:w-16 lg:h-16 bg-gray-950/60 rounded border border-gray-800/60 shrink-0" />;
  const shape = SHAPES[type];
  return (
    <div className="flex flex-col gap-0.5 lg:gap-1 p-1.5 lg:p-2 bg-black/70 border border-gray-800 rounded shadow-inner items-center justify-center w-[52px] h-[52px] lg:w-16 lg:h-16 shrink-0">
      {shape.map((row, r) => (
        <div key={r} className="flex gap-0.5 lg:gap-1">
          {row.map((val, c) => (
            <div
              key={c}
              className={`w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-[1px] transition-colors ${val ? '' : 'opacity-0'}`}
              style={{ backgroundColor: val ? COLORS[type] : 'transparent' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// Left Desktop: Hold Matrix (Issue 3.3 Fix: Clear visual lockout state when hold is consumed)
export const HoldPanel: React.FC<{
  holdPiece: PieceType | null;
  canHold: boolean;
  themeColor: string;
  themeColorMuted: string;
}> = ({ holdPiece, canHold, themeColor, themeColorMuted }) => (
  <div className={`p-4 border-2 bg-black/85 backdrop-blur-xl relative overflow-hidden transition-all duration-300 ${canHold ? '' : 'opacity-50'}`} style={{ borderColor: themeColorMuted }}>
    <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 flex justify-between items-center font-orbitron" style={{ color: themeColor }}>
      <span>Hold Matrix</span>
      <span className={`text-[9px] ${canHold ? 'text-gray-500' : 'text-red-400 font-bold'}`}>
        {canHold ? '[C]' : 'LOCKED'}
      </span>
    </div>
    <div className="flex justify-center h-20 items-center bg-black/50 rounded border border-gray-900 shadow-inner">
      {renderMiniPiece(holdPiece)}
    </div>
  </div>
);

// Left Desktop: Entropy Pulse Bar
export const EntropyPulse: React.FC<{ chaos: number }> = ({ chaos }) => (
  <div className="p-4 border border-red-950/40 bg-black/85 backdrop-blur-xl relative overflow-hidden">
    <div className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] mb-3 font-orbitron flex justify-between items-center">
      <span>Entropy Pulse</span>
      <span className="text-[9px] tabular-nums">{chaos}%</span>
    </div>
    <div className="h-44 w-full bg-black border border-red-900/30 relative overflow-hidden rounded">
      <div 
        className="h-full w-full bg-gradient-to-t from-red-950 via-red-600 to-red-400 origin-bottom transition-transform duration-300 ease-out"
        style={{ 
          transform: `scaleY(${Math.max(0, Math.min(100, chaos)) / 100})`, 
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' 
        }}
      />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.5)_2px,rgba(0,0,0,0.5)_4px)] pointer-events-none" />
    </div>
  </div>
);

// Left Desktop: System Stats Card (Decoupled Personal Record & Global Best)
export const SystemStats: React.FC<{
  personalBest: number;
  globalRecord: number;
  level: number;
  lines: number;
}> = ({ personalBest, globalRecord, level, lines }) => (
  <div className="p-3 border border-gray-900 bg-gray-950/80 rounded flex flex-col gap-2 text-[10px] font-orbitron">
    <div className="flex justify-between items-center">
      <span className="text-gray-500">MY RECORD</span>
      <span className="text-white font-bold tabular-nums">{personalBest.toLocaleString()}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-gray-500">GLOBAL #1</span>
      <span className="text-amber-400 font-bold tabular-nums">{globalRecord.toLocaleString()}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-gray-500">LEVEL</span>
      <span className="text-cyan-400 font-bold tabular-nums">{level}</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-gray-500">LINES</span>
      <span className="text-cyan-400 font-bold tabular-nums">{lines}</span>
    </div>
    <div className="flex justify-between items-center border-t border-gray-900 pt-1.5">
      <span className="text-gray-500">ENGINE</span>
      <span className="flex items-center gap-1.5 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
        NATIVE_AI
      </span>
    </div>
  </div>
);

// Right Desktop: Adversary Next
export const AdversaryNextPanel: React.FC<{
  nextPieceType: PieceType;
  themeColor: string;
  themeColorMuted: string;
}> = ({ nextPieceType, themeColor, themeColorMuted }) => (
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
);

// Right Desktop: Agent Intel Terminal
export const AgentIntelTerminal: React.FC<{
  thoughts: { text: string; time: string }[];
  themeColor: string;
  themeColorMuted: string;
}> = ({ thoughts, themeColor, themeColorMuted }) => (
  <div className="h-56 p-4 border-2 bg-black/85 backdrop-blur-xl flex flex-col relative overflow-hidden transition-colors duration-700" style={{ borderColor: themeColorMuted }}>
    <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-orbitron" style={{ color: themeColor }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
      Agent Intel Log
    </div>
    <div className="flex-1 font-mono text-[9px] text-gray-400 space-y-2 overflow-y-auto scrollbar-none pr-1">
      {thoughts.map((thought, i) => (
        <div key={i} className={`flex gap-2 leading-relaxed ${i === 0 ? 'text-cyan-200 font-bold' : 'opacity-40'}`}>
          <span className="text-cyan-400/90 shrink-0">[{thought.time}]</span>
          <p>{thought.text}</p>
        </div>
      ))}
    </div>
  </div>
);

// Right Desktop: Controls Reference
export const ControlsReference: React.FC = () => (
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
);

// Mobile Top Status Bar
export const MobileStatusBar: React.FC<{
  holdPiece: PieceType | null;
  canHold: boolean;
  nextPieceType: PieceType;
  chaos: number;
  level: number;
  lines: number;
}> = ({ holdPiece, canHold, nextPieceType, chaos, level, lines }) => (
  <div className="flex lg:hidden items-center justify-between w-full p-2 bg-gray-950/90 border border-gray-800 rounded-lg font-orbitron text-[9px]">
    <div className={`flex items-center gap-1.5 ${canHold ? '' : 'opacity-60'}`}>
      <div className="text-gray-400">HOLD</div>
      {!canHold && (
        <span className="text-[7px] px-1 py-0.5 bg-red-950/80 border border-red-500/60 text-red-400 rounded font-bold">
          LOCK
        </span>
      )}
      {renderMiniPiece(holdPiece)}
    </div>
    <div className="flex flex-col items-center gap-1">
      <div className="text-red-400 font-bold tracking-wider">CHAOS {chaos}%</div>
      <div className="w-24 h-1.5 bg-black rounded-full overflow-hidden border border-red-950">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 via-amber-500 to-red-500 origin-left transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${Math.max(0, Math.min(100, chaos)) / 100})` }}
        />
      </div>
      <div className="text-[8px] text-gray-500">
        LVL: <span className="text-white font-bold">{level}</span> | LINES: <span className="text-cyan-400 font-bold">{lines}</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className="text-gray-400">NEXT</div>
      {renderMiniPiece(nextPieceType)}
    </div>
  </div>
);

// Issue 6 Fix: Compact Cyber Thought Ticker for Mobile Players
export const MobileThoughtTicker: React.FC<{ thought?: string }> = ({ thought }) => (
  <div className="flex lg:hidden items-center gap-1.5 px-2.5 py-1 w-full bg-black/85 border border-cyan-950/70 rounded font-mono text-[9px] text-cyan-400 overflow-hidden shadow-inner">
    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
    <span className="truncate">{thought || "ADVERSARY_ACTIVE // MONITORING"}</span>
  </div>
);
