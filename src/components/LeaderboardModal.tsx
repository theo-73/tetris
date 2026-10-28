'use client';
import React, { useEffect, useState, useRef } from 'react';
import { X, Trophy, RefreshCw } from 'lucide-react';
import { LeaderboardEntry } from '../app/api/leaderboard/route';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingSubmission?: { 
    score: number; 
    lines: number; 
    level: number;
    telemetry?: {
      piecesPlaced?: number;
      dropCount?: number;
      combos?: number;
      purgesTriggered?: number;
      gameDurationMs?: number;
    };
  } | null;
  onSubmitted?: (topScore?: number) => void;
  onReboot?: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  pendingSubmission,
  onSubmitted,
  onReboot,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [callsign, setCallsign] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchScores = () => {
    setLoading(true);
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (data?.leaderboard) {
          setEntries(data.leaderboard);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.leaderboard) {
          setEntries(data.leaderboard);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const modalEl = modalRef.current;
    if (modalEl) {
      const focusables = modalEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'INPUT' && onReboot) {
        e.preventDefault();
        onClose();
        onReboot();
        return;
      }

      if (e.key === 'Tab' && modalEl) {
        const focusableList = Array.from(
          modalEl.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusableList.length === 0) return;

        const first = focusableList[0];
        const last = focusableList[focusableList.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, onReboot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSubmission || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: callsign.trim() || 'OPERATOR',
          score: pendingSubmission.score,
          lines: pendingSubmission.lines,
          level: pendingSubmission.level,
          telemetry: pendingSubmission.telemetry,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.leaderboard) {
        setEntries(data.leaderboard);
        setSubmitted(true);
        if (onSubmitted) onSubmitted(data.leaderboard[0]?.score);
      } else {
        setErrorMsg(data?.error || `TRANSMISSION FAILED (${res.status})`);
      }
    } catch {
      setErrorMsg('TRANSMISSION FAILED: NETWORK TIMEOUT');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-200"
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        className="bg-black/95 border-2 border-amber-500/60 rounded-xl max-w-lg w-full p-6 text-white font-share-tech shadow-[0_0_50px_rgba(245,158,11,0.25)] relative max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 id="leaderboard-title" className="text-lg font-black font-orbitron text-amber-300 tracking-wider">
                HALL OF OPERATORS // GLOBAL REGISTRY
              </h2>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                NEURAL_MATRIX // PERSISTENT_STANDINGS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchScores}
              className="text-gray-400 hover:text-white p-1 border border-gray-800 rounded hover:border-amber-500 transition-colors cursor-pointer"
              aria-label="Refresh Scores"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 border border-gray-800 rounded hover:border-amber-500 transition-colors cursor-pointer"
              aria-label="Close Leaderboard"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Callsign Prompt on High Score */}
        {pendingSubmission && !submitted && (
          <form onSubmit={handleSubmit} className="mb-4 p-3 bg-amber-950/30 border border-amber-600/50 rounded-lg flex flex-col gap-2">
            <div className="text-[11px] font-orbitron text-amber-300 font-bold flex justify-between">
              <span>RECORD NEW OPERATOR SCORE: {pendingSubmission.score.toLocaleString()}</span>
              <span className="text-gray-400">LVL {pendingSubmission.level}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={10}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                placeholder="CALLSIGN (MAX 10)"
                className="flex-1 bg-black border border-amber-500/50 px-3 py-1.5 rounded font-orbitron text-xs text-white placeholder-gray-600 uppercase focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-orbitron font-bold text-xs rounded transition-colors cursor-pointer"
              >
                {submitting ? 'RECORDING...' : 'TRANSMIT'}
              </button>
            </div>
            {errorMsg && (
              <p className="text-red-400 font-mono text-[11px] mt-1 tracking-wide">
                ⚠ {errorMsg}
              </p>
            )}
          </form>
        )}

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto pr-1">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] font-orbitron text-gray-500 uppercase tracking-widest">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">CALLSIGN</th>
                <th className="py-2 px-2 text-right">SCORE</th>
                <th className="py-2 px-2 text-right">LINES</th>
                <th className="py-2 px-2 text-right">LVL</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr
                  key={entry.id || idx}
                  className={`border-b border-gray-900/60 hover:bg-gray-900/40 transition-colors ${
                    idx === 0 ? 'text-amber-300 font-bold' : idx === 1 ? 'text-cyan-300' : idx === 2 ? 'text-emerald-300' : 'text-gray-300'
                  }`}
                >
                  <td className="py-2 px-2 font-orbitron text-[11px]">{idx + 1}</td>
                  <td className="py-2 px-2 font-bold font-orbitron tracking-wider">{entry.name}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold">{entry.score.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-400">{entry.lines}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-400">{entry.level}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500 font-mono text-xs">
                    NO OPERATOR SIGNALS DETECTED
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-3 mt-3 flex justify-between items-center text-[10px] font-mono text-gray-500">
          <span>{onReboot ? 'PRESS [ENTER] TO REBOOT // ESC TO CLOSE' : 'PRESS ESC TO CLOSE'}</span>
          <div className="flex gap-2">
            {onReboot && (
              <button
                onClick={() => {
                  onClose();
                  onReboot();
                }}
                className="px-3 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-orbitron text-xs rounded transition-colors cursor-pointer"
              >
                REBOOT MATRIX
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-orbitron text-xs rounded transition-colors cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
