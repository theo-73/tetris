import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  lines: number;
  level: number;
  date: string;
}

// Multi-Tier Persistence Provider (Upstash Redis Cloud -> Local File -> In-Memory)
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', name: 'CYBER_ZERO', score: 28400, lines: 48, level: 5, date: '2026-10-25' },
  { id: '2', name: 'NEURAL_GHOST', score: 19800, lines: 34, level: 4, date: '2026-10-26' },
  { id: '3', name: 'MALICE_KILLER', score: 14200, lines: 25, level: 3, date: '2026-10-27' },
  { id: '4', name: 'VOID_RUNNER', score: 9500, lines: 18, level: 2, date: '2026-10-28' },
  { id: '5', name: 'OPERATOR', score: 5400, lines: 12, level: 2, date: '2026-10-28' },
];

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST !== undefined;
let memoryLeaderboard: LeaderboardEntry[] = [...DEFAULT_LEADERBOARD];

async function getCloudLeaderboard(): Promise<LeaderboardEntry[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/entropic_leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.result) {
        let parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // Ignore parse failure
          }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[Leaderboard] Cloud persistence read error:', err);
  }
  return null;
}

async function setCloudLeaderboard(entries: LeaderboardEntry[]): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const res = await fetch(`${url}/set/entropic_leaderboard`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entries),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Leaderboard] Cloud persistence write error:', err);
    return false;
  }
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (isTestEnv) {
    return memoryLeaderboard;
  }
  const cloudData = await getCloudLeaderboard();
  if (cloudData) {
    memoryLeaderboard = cloudData;
    return memoryLeaderboard;
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = await fs.promises.readFile(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryLeaderboard = parsed;
        return memoryLeaderboard;
      }
    }
  } catch {
    // Fall back to memory registry if file read fails
  }
  return memoryLeaderboard;
}

async function persistLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
  memoryLeaderboard = entries;
  if (isTestEnv) {
    return;
  }
  await setCloudLeaderboard(entries);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    // In restricted serverless edge containers (e.g. Vercel read-only filesystem),
    // filesystem writes throw EROFS. Memory registry safely maintains runtime state.
    console.warn('[Leaderboard] File persistence unavailable in edge container; fallback to memory store:', err);
  }
}

// In-memory sliding window IP rate limiter (Max 5 submissions per 60s window)
const ipRateMap = new Map<string, { count: number; resetTime: number }>();
const callsignRateMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_CALLSIGN_REQUESTS_PER_WINDOW = 3;

export async function GET() {
  const current = await getLeaderboard();
  const sorted = [...current].sort((a, b) => b.score - a.score).slice(0, 10);
  return NextResponse.json(
    { success: true, leaderboard: sorted },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    // Issue 2.2 Fix: In-memory IP rate limiting to prevent spam submissions
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    const now = Date.now();
    const rateRecord = ipRateMap.get(ip);

    if (rateRecord && now < rateRecord.resetTime) {
      if (rateRecord.count >= MAX_REQUESTS_PER_WINDOW) {
        const retryAfter = Math.ceil((rateRecord.resetTime - now) / 1000);
        return NextResponse.json(
          { success: false, error: 'Too many submissions. Please wait before submitting again.' },
          { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
        );
      }
      rateRecord.count += 1;
    } else {
      ipRateMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    }

    // Prune stale entries if map grows large
    if (ipRateMap.size > 1000) {
      for (const [key, val] of ipRateMap.entries()) {
        if (now > val.resetTime) ipRateMap.delete(key);
      }
    }

    const body = await request.json();
    const { name, score, lines, level, telemetry } = body;

    if (typeof score !== 'number' || score < 0 || isNaN(score)) {
      return NextResponse.json({ success: false, error: 'Invalid score value' }, { status: 400 });
    }

    const validLines = typeof lines === 'number' && !isNaN(lines) ? Math.max(0, Math.floor(lines)) : 0;
    const validLevel = typeof level === 'number' && !isNaN(level) ? Math.max(1, Math.floor(level)) : 1;

    // Telemetry & mathematical anti-cheat validation
    if (telemetry && typeof telemetry === 'object') {
      const { piecesPlaced, purgesTriggered, combos, gameDurationMs } = telemetry;
      if (score > 0 && typeof piecesPlaced === 'number' && piecesPlaced <= 0) {
        return NextResponse.json({ success: false, error: 'Plausibility threshold exceeded' }, { status: 422 });
      }
      if (typeof gameDurationMs === 'number' && gameDurationMs < 400 && score > 100) {
        return NextResponse.json({ success: false, error: 'Plausibility threshold exceeded' }, { status: 422 });
      }

      const maxFromLines = validLines * 1500 * (validLevel + 1);
      const maxFromDrops = (typeof piecesPlaced === 'number' ? piecesPlaced : 1) * 40 * (validLevel + 1);
      const maxFromPurges = (typeof purgesTriggered === 'number' ? purgesTriggered : 0) * 1200 * (validLevel + 1);
      const maxFromCombos = (typeof combos === 'number' ? combos : 0) * 600 * (validLevel + 1);
      const allowance = 2500 * (validLevel + 1);

      const theoreticalLimit = maxFromLines + maxFromDrops + maxFromPurges + maxFromCombos + allowance;
      if (score > theoreticalLimit) {
        return NextResponse.json({ success: false, error: 'Plausibility threshold exceeded' }, { status: 422 });
      }
    } else {
      // Issue 3.2 Fix: Fallback anti-cheat validation when telemetry is omitted
      const maxPlausibleScore = validLines > 0 
        ? (validLines * 2000 + 500) * (validLevel + 1) 
        : 300;
      if (score > maxPlausibleScore) {
        return NextResponse.json({ success: false, error: 'Plausibility threshold exceeded' }, { status: 422 });
      }
    }

    // Clean and sanitize callsign (alphanumeric, max 10 chars, uppercase)
    const cleanName = typeof name === 'string' && name.trim().length > 0
      ? name.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10).toUpperCase() || 'OPERATOR'
      : 'OPERATOR';

    // Callsign-level rate limit guard to prevent targeted flooding
    const callsignRecord = callsignRateMap.get(cleanName);
    if (callsignRecord && now < callsignRecord.resetTime) {
      if (callsignRecord.count >= MAX_CALLSIGN_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          { success: false, error: 'Too many submissions for this callsign. Please wait.' },
          { status: 429 }
        );
      }
      callsignRecord.count += 1;
    } else {
      callsignRateMap.set(cleanName, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    }

    if (callsignRateMap.size > 1000) {
      for (const [key, val] of callsignRateMap.entries()) {
        if (now > val.resetTime) callsignRateMap.delete(key);
      }
    }

    const newEntry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      score: Math.floor(score),
      lines: validLines,
      level: validLevel,
      date: new Date().toISOString().split('T')[0],
    };

    const currentList = await getLeaderboard();
    const updated = [...currentList, newEntry];
    updated.sort((a, b) => b.score - a.score);
    const topEntries = updated.slice(0, 20);
    await persistLeaderboard(topEntries);

    return NextResponse.json({ success: true, entry: newEntry, leaderboard: topEntries.slice(0, 10) });
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed request payload' }, { status: 400 });
  }
}
