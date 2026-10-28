# Entropic Tetris // Adversarial Neural Matrix

> An adversarial, cyberpunk Tetris game driven by a real-time heuristic AI engine that predicts player placements, calculates worst-case entropy vectors, and dynamically sabotages the matrix. Built natively on Next.js 16 + React 19 with zero external server dependencies.

---

## ⚡ Overview

**Entropic Tetris** flips standard Tetris mechanics on their head:
- Instead of random or 7-bag piece generators, every piece is calculated by a **Native Adversarial Heuristic Agent** executing client-side with 0ms latency.
- The agent simulates all possible player placements for each tetromino (using 1-ply virtual line-clear evaluation, deep well detection, and rotational symmetry pruning), computing the move that leaves the board in the highest entropy state (maximizing aggregate height, holes, deep wells, and surface bumpiness).
- **Entropy Pulse & Chaos Meter**: As the board destabilizes, the HUD transitions from calm cyan to amber, and finally critical red.
- **Shadow Agent & Cell Locks**: The adversary actively locks cells directly beneath your active pieces. Clearing the row containing a locked cell triggers a **System Purge**, resetting the chaos meter and awarding a +1,000 pt bonus.
- **Pure Client-Side Architecture**: Built with modern Next.js 16 and React 19, requiring no external backend servers or database connections. Deploys anywhere in seconds.

---

## 🛠️ Architecture

```
+-------------------------------------------------------------+
|             Next.js 16 + React 19 Unified Matrix            |
|                                                             |
|  * Native Adversarial Minimax Engine (0ms Latency)          |
|  * Shadow Saboteur & Predictive Targeting                   |
|  * 60 FPS Hardware-Accelerated Canvas Pipeline              |
|  * Procedural Web Audio Synthesizer (Zero Assets)           |
|  * Strict SRS Wall-Kicks & Guideline 500ms Lock Delay       |
|  * Responsive Cyber HUD (Desktop + Compact Mobile UI)       |
|  * Full Screen Reader Accessibility (aria-live)             |
+-------------------------------------------------------------+
```

---

## 🚀 Quickstart & Development

Run the game locally with standard Node.js:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to engage the matrix.

To create a production build:
```bash
npm run build
npm start
```

---

## 🎮 Controls

| Action | Primary Key | Secondary Key | Mobile Control |
| :--- | :--- | :--- | :--- |
| **Move Left / Right** | `←` / `→` | DAS (160ms) + ARR (30ms) | `←` / `→` (Tap-and-hold repeat) |
| **Rotate Clockwise (CW)** | `↑` | - | `↷ ROT` button |
| **Rotate Counter-Clockwise (CCW)** | `Z` | `Ctrl` | `↶ ROT` button |
| **Soft Drop** | `↓` | - | `↓` button |
| **Hard Drop** | `Space` | - | `DROP` button |
| **Hold Piece** | `C` | - | `HOLD` button |
| **Start / Pause / Reboot** | `Enter` | `P` / `Esc` | `PAUSE / RESUME` button |
| **Mute / Unmute Audio** | HUD Button | - | Header Audio Button |

---

## 🧩 Key Enhancements & Polish

1. **Native Adversarial Heuristic Engine**:
   - 1-ply minimax simulation across all 7 tetrominoes and all 4 rotation states.
   - Continuous starvation bonus withholding helpful pieces without repetition trap cliffs.
   - Dynamic tie-breaking entropy prevents clustered repetition.
2. **True Mobile-Responsive HUD**:
   - Replaced tall 1,700px multi-column scroll stack with a single-screen responsive canvas and compact mobile top bar.
   - Minimum 44x44px touch targets compliant with WCAG AA.
3. **Canvas 60 FPS HiDPI Pipeline**:
   - Retinal pixel buffer scaling with `devicePixelRatio`.
   - Continuous `requestAnimationFrame` render loop for cyber rain and particle physics.
4. **Zero-Dependency Procedural Sound**:
   - Web Audio synthesizer with clean oscillator/gain disconnection on playback end to prevent memory leaks.
5. **Guideline Mechanics**:
   - 500ms lock delay with up to 15 move/rotation resets.
   - Strict Super Rotation System (SRS) wall-kicks for all standard tetrominoes.
