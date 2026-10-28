'use client';
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus first focusable item on open
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

      // Tab trap
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
  }, [isOpen, onClose]);

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
        aria-labelledby="manual-title"
        className="bg-black/95 border-2 border-cyan-500/60 rounded-xl max-w-2xl w-full p-6 text-white font-share-tech shadow-[0_0_50px_rgba(6,182,212,0.3)] relative max-h-[85vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
          <div>
            <h2 id="manual-title" className="text-xl font-black font-orbitron text-cyan-300 tracking-wider">
              SYSTEM PROTOCOL // OPERATIONAL MANUAL (README)
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              ENTROPIC_TETRIS // ARCHITECTURE_SPECIFICATION
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 border border-gray-800 rounded hover:border-cyan-500 transition-colors cursor-pointer"
            aria-label="Close Manual"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-xs text-gray-300 leading-relaxed font-mono">
          <section className="bg-gray-950/60 p-3.5 rounded border border-gray-900">
            <h3 className="text-sm font-bold font-orbitron text-cyan-400 mb-1.5 uppercase">
              1. Threat Overview: The Adversarial Engine
            </h3>
            <p>
              Entropic Tetris replaces traditional 7-bag randomizers with a predictive, adversarial AI. For every move, the adversary executes a 1-ply minimax simulation across all 7 tetrominoes, projecting placements and line clears. It selects the piece that leaves the player with maximum entropy (highest aggregate height, holes, surface bumpiness, and deep single-column wells).
            </p>
          </section>

          <section className="bg-gray-950/60 p-3.5 rounded border border-gray-900">
            <h3 className="text-sm font-bold font-orbitron text-red-400 mb-1.5 uppercase">
              2. Shadow Sabotage & System Purge Protocol
            </h3>
            <p className="mb-2">
              Periodically, the AI triggers a <span className="text-red-400 font-bold">CELL LOCK</span> (highlighted by a pulsing red crosshair) beneath your falling piece to disrupt placement vectors.
            </p>
            <div className="p-2 bg-red-950/30 border border-red-900/50 rounded text-red-200">
              <span className="font-bold text-white">COUNTERMEASURE:</span> Completing the row containing the locked cell initiates a <span className="text-cyan-300 font-bold">SYSTEM_PURGE</span>. This destroys the lock, zeroes the Chaos Meter, and awards a <span className="text-amber-300 font-bold">+1,000 pt x Level</span> bonus.
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
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-cyan-200 font-orbitron text-xs rounded transition-colors cursor-pointer"
          >
            DISMISS (STANDBY)
          </button>
        </div>
      </div>
    </div>
  );
};
