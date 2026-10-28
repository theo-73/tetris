// Procedural Web Audio Synthesizer with master gain and instant mute
export type AudioEventType = 'move' | 'rotate' | 'softdrop' | 'harddrop' | 'lock' | 'clear' | 'tetris' | 'purge' | 'gameover' | 'hazard' | 'hold';

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  public enabled: boolean = true;

  // Issue 13 Fix: Procedural ambient tension drone state
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private droneActive: boolean = false;
  private droneStopTimeoutId: NodeJS.Timeout | null = null;
  private currentVolume: number = 1.0;

  private handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.ctx && this.ctx.state === 'suspended' && this.enabled) {
      this.ctx.resume().catch(() => {});
    }
  };

  constructor() {
    // Issue 2.4 Fix: Mobile Safari & Chromium Web Audio autoplay policy unlock & foreground resume
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);

      // User gesture unlock for Mobile Safari
      const unlockAudio = () => {
        if (this.enabled) {
          this.init();
        }
        ['click', 'touchstart', 'touchend'].forEach(evt => {
          document.removeEventListener(evt, unlockAudio);
        });
      };

      ['click', 'touchstart', 'touchend'].forEach(evt => {
        document.addEventListener(evt, unlockAudio, { passive: true });
      });
    }
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();

        // Limiter compressor to prevent audio clipping during concurrent sound effects
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Master volume and mute control
  getVolume(): number {
    return this.enabled ? this.currentVolume : 0;
  }

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    this.enabled = clamped > 0;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  setMuted(muted: boolean) {
    this.setVolume(muted ? 0 : (this.currentVolume || 1.0));
  }

  // Mobile Web Audio autoplay unlock handler for canvas user gestures
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Issue 16 Fix: Audio context clean teardown
  teardown() {
    this.stopAmbientDrone();
    if (this.droneStopTimeoutId) {
      clearTimeout(this.droneStopTimeoutId);
      this.droneStopTimeoutId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }

  // Issue 13 Fix: Procedural cyberpunk ambient tension drone
  startAmbientDrone() {
    if (!this.enabled) return;

    // Issue 1.2 Fix: If a stop timeout is currently pending from a quick pause, cancel it and resume drone
    if (this.droneStopTimeoutId) {
      clearTimeout(this.droneStopTimeoutId);
      this.droneStopTimeoutId = null;
      if (this.ctx && this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0.025, this.ctx.currentTime, 0.2);
        this.droneActive = true;
        return;
      }
    }

    if (this.droneActive) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneGain = this.ctx.createGain();

      this.droneOsc1.type = 'triangle';
      this.droneOsc1.frequency.setValueAtTime(55, now);

      this.droneOsc2.type = 'sawtooth';
      this.droneOsc2.frequency.setValueAtTime(55.4, now);

      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(110, now);
      this.droneFilter.Q.setValueAtTime(3.0, now);

      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.025, now + 1.2);

      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc1.start(now);
      this.droneOsc2.start(now);
      this.droneActive = true;
    } catch {
      // Safe fallback
    }
  }

  updateDroneChaos(chaos: number) {
    if (!this.droneActive || !this.ctx || !this.droneFilter || !this.droneGain) return;
    const now = this.ctx.currentTime;
    const normalized = Math.max(0, Math.min(100, chaos)) / 100;
    const targetFreq = 90 + normalized * 270;
    const targetGain = 0.025 + normalized * 0.035;

    this.droneFilter.frequency.setTargetAtTime(targetFreq, now, 0.3);
    this.droneGain.gain.setTargetAtTime(targetGain, now, 0.3);
  }

  stopAmbientDrone() {
    if (!this.droneActive || !this.ctx) return;
    if (this.droneStopTimeoutId) {
      clearTimeout(this.droneStopTimeoutId);
      this.droneStopTimeoutId = null;
    }
    try {
      const now = this.ctx.currentTime;
      if (this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0.0001, now, 0.2);
      }
      this.droneStopTimeoutId = setTimeout(() => {
        try {
          this.droneOsc1?.stop();
          this.droneOsc2?.stop();
          this.droneOsc1?.disconnect();
          this.droneOsc2?.disconnect();
          this.droneFilter?.disconnect();
          this.droneGain?.disconnect();
        } catch {
          // Ignore
        }
        this.droneOsc1 = null;
        this.droneOsc2 = null;
        this.droneFilter = null;
        this.droneGain = null;
        this.droneActive = false;
        this.droneStopTimeoutId = null;
      }, 250);
    } catch {
      this.droneActive = false;
    }
  }

  private connectAndPlay(osc: OscillatorNode, gain: GainNode, start: number, stop: number) {
    if (!this.ctx || !this.masterGain) return;
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Safe ignore if already cleaned up
      }
    };
    osc.start(start);
    osc.stop(stop);
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
        this.connectAndPlay(osc, gain, now, now + 0.03);
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
        this.connectAndPlay(osc, gain, now, now + 0.05);
        break;
      }
      case 'softdrop': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        this.connectAndPlay(osc, gain, now, now + 0.02);
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
        this.connectAndPlay(osc, gain, now, now + 0.1);
        break;
      }
      case 'lock': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        this.connectAndPlay(osc, gain, now, now + 0.04);
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
          this.connectAndPlay(osc, gain, now + idx * 0.04, now + idx * 0.04 + 0.12);
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
          this.connectAndPlay(osc, gain, now + idx * 0.06, now + idx * 0.06 + 0.25);
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
        this.connectAndPlay(osc, gain, now, now + 0.3);
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
          this.connectAndPlay(osc, gain, now + idx * 0.1, now + idx * 0.1 + 0.18);
        });
        break;
      }
      case 'hazard': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.14);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        this.connectAndPlay(osc, gain, now, now + 0.14);
        break;
      }
      case 'hold': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        this.connectAndPlay(osc, gain, now, now + 0.1);
        break;
      }
    }
  }
}
