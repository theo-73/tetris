# Entropic Tetris // Adversarial Neural Matrix

> An adversarial, cyberpunk Tetris game driven by a real-time heuristic AI engine that predicts player placements, calculates worst-case entropy vectors, and dynamically sabotages the matrix.

---

## ⚡ Overview

**Entropic Tetris** flips standard Tetris mechanics on their head:
- Instead of random or 7-bag piece generators, every piece is calculated by an **Adversarial Heuristic Agent** running on a Python FastAPI backend.
- The agent simulates all possible player placements for each tetromino (using SRS wall-kicks and virtual line-clear evaluation), computing the move that leaves the board in the highest entropy state (maximizing aggregate height, holes, and surface bumpiness).
- **Entropy Pulse & Chaos Meter**: As the board destabilizes, the HUD transitions from calm cyan to amber, and finally critical red.
- **Shadow Agent & Cell Locks**: The adversary actively locks cells directly beneath your active pieces. Clearing the row containing a locked cell triggers a **System Purge**, resetting the chaos meter.
- **Full Offline Resilience**: If the Python backend is unavailable, the client seamlessly falls back to an internal 7-bag randomizer without interrupting gameplay.

---

## 🛠️ Architecture

```
                    +---------------------------+
                    |    Python FastAPI Server  |
                    |       (Port 8000)         |
                    |                           |
                    |  * Adversarial Minimax    |
                    |  * Heuristic Analyzer     |
                    |  * Shadow Agent Loop      |
                    +-------------+-------------+
                                  |
                                  | ws://localhost:8000/ws
                                  | (Bidirectional State)
                                  v
                    +---------------------------+
                    |   Next.js 16 + React 19   |
                    |       (Port 3000)         |
                    |                           |
                    |  * 60 FPS Canvas Pipeline |
                    |  * Procedural Web Audio   |
                    |  * DAS / ARR Keyboard     |
                    |  * 500ms Lock Delay       |
                    |  * Tailwind v4 HUD        |
                    +---------------------------+
```

---

## 🚀 Quickstart & Deployment

### Option 1: 1-Click Vercel Deploy (Zero External Server)
The entire game features an integrated **Native TypeScript Adversarial Minimax Engine** that runs directly inside Next.js with **0ms latency**:
1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com), click **Import Repository**.
3. Click **Deploy**. You're live in 30 seconds!

---

### Option 2: Local Development (Standalone or Dual-Service)

#### Running Standalone (Next.js + Native AI):
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to play.

#### Running with Optional Python WebSocket Server:
```bash
# Terminal 1 - Python FastAPI Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 - Next.js Frontend
cd frontend
npm install
npm run dev
```

---

## 🎮 Controls

| Action | Primary Key | Secondary Key |
| :--- | :--- | :--- |
| **Move Left / Right** | `←` / `→` | DAS (160ms) + ARR (30ms) |
| **Rotate Clockwise (CW)** | `↑` | - |
| **Rotate Counter-Clockwise (CCW)** | `Z` | `Ctrl` |
| **Soft Drop** | `↓` | - |
| **Hard Drop** | `Space` | - |
| **Hold Piece** | `C` | - |
| **Start / Pause / Reboot** | `Enter` | `P` / `Esc` |
| **Mute / Unmute Audio** | HUD Button | Procedural Synth Audio |

---

## 🧩 Key Enhancements & Bug Fixes

1. **Adversarial Heuristic Engine**:
   - Fixed the inverted starvation multiplier so the AI withholds helpful pieces rather than prioritizing them.
   - Fixed placement simulation to execute virtual line clears, correctly rewarding line wipes.
   - Expanded column bounds so vertical I and T pieces reach all columns `0..9`.
2. **WebSocket & Concurrency Reliability**:
   - Clamped active piece coordinates to prevent negative array indexing or `IndexError` crashes.
   - Cleaned up background tasks with guaranteed `try...finally` cancellation on disconnect.
3. **Canvas 60 FPS Animation Pipeline**:
   - Replaced static state-driven canvas drawing with a dedicated `requestAnimationFrame` render loop.
   - Particles, digital substrate rain, and glowing locked cells now animate smoothly at 60 FPS without freezing between drops.
4. **Game Physics & Guideline Mechanics**:
   - Added a 500ms lock delay with up to 15 move/rotation resets.
   - Added counter-clockwise (CCW) rotation support.
   - Added `e.preventDefault()` to stop browser window scrolling on game keys.
   - Fixed the hold mechanic to advance the piece queue immediately.
5. **Visuals & Audio**:
   - Connected Google Fonts (`Orbitron`, `Share Tech Mono`) into Tailwind CSS v4 via `@theme`.
   - Built a zero-dependency Web Audio procedural sound synthesizer (moves, rotations, drops, line clears, purges, game over).
   - Added local high score persistence via `localStorage`.
   - Added responsive design and mobile touch controls.
