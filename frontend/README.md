# Entropic Tetris — Frontend Application

Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4 frontend for **Entropic Tetris**.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure the backend is running at `http://localhost:8000`:
```bash
cd ../backend
uvicorn main:app --reload --port 8000
```

### 2. Install & Run Frontend
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎮 Key Capabilities

- **60 FPS Continuous Canvas Pipeline**: Independent `requestAnimationFrame` render loop with particle bursts, dynamic CRT scanlines, and digital substrate rain.
- **Procedural Web Audio**: Zero-dependency Web Audio synthesizer providing low-latency tactical sound effects.
- **SRS Wall-Kick Engine**: Clockwise & counter-clockwise rotations with 500ms lock delay.
- **Dual Mode Connectivity**: Real-time WebSocket connection to Python Adversary with seamless automatic fallback to a client-side 7-bag randomizer if offline.
- **Responsive Controls**: Desktop keyboard support (DAS/ARR) + on-screen touch controls for mobile/tablet viewports.
