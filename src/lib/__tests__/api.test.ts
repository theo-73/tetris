import { describe, it, expect } from 'vitest';
import { GET, POST } from '../../app/api/leaderboard/route';

describe('Leaderboard API Contract & Sanity Validation', () => {
  it('GET /api/leaderboard returns top scores sorted descending', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.leaderboard)).toBe(true);
    expect(data.leaderboard.length).toBeGreaterThan(0);

    // Verify descending sort
    for (let i = 0; i < data.leaderboard.length - 1; i++) {
      expect(data.leaderboard[i].score).toBeGreaterThanOrEqual(data.leaderboard[i + 1].score);
    }
  });

  it('POST /api/leaderboard records valid score and cleans callsign', async () => {
    const payload = {
      name: '  neo-99!  ',
      score: 12400,
      lines: 24,
      level: 3,
    };
    const req = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.entry.name).toBe('NEO-99');
    expect(data.entry.score).toBe(12400);
    expect(data.entry.lines).toBe(24);
    expect(data.entry.level).toBe(3);
  });

  it('POST /api/leaderboard rejects negative or non-numeric scores', async () => {
    const badReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: -500, lines: 10, level: 1 }),
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('POST /api/leaderboard rejects impossible forged scores exceeding plausibility threshold', async () => {
    const forgedReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 999999999, lines: 2, level: 1 }),
    });
    const res = await POST(forgedReq);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Plausibility threshold exceeded');
  });

  it('POST /api/leaderboard enforces rate limit and returns 429 when flood detected', async () => {
    const spamIp = '10.0.0.99';
    let lastStatus = 200;

    for (let i = 0; i < 6; i++) {
      const spamReq = new Request('http://localhost:3000/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': spamIp,
        },
        body: JSON.stringify({ name: 'SPAMMER', score: 1000 + i, lines: 2, level: 1 }),
      });
      const res = await POST(spamReq);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });

  it('POST /api/leaderboard rejects forged DevTools score (lines=0, score=44999)', async () => {
    const forgedReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.4',
      },
      body: JSON.stringify({ name: 'HACKER', score: 44999, lines: 0, level: 1 }),
    });
    const res = await POST(forgedReq);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Plausibility threshold exceeded');
  });

  it('POST /api/leaderboard accepts verified game telemetry and records entry', async () => {
    const validReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.5',
      },
      body: JSON.stringify({
        name: 'PILOT_ONE',
        score: 4200,
        lines: 6,
        level: 1,
        telemetry: {
          piecesPlaced: 18,
          dropCount: 14,
          combos: 2,
          purgesTriggered: 1,
          gameDurationMs: 45000,
        },
      }),
    });
    const res = await POST(validReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.entry.name).toBe('PILOT_ONE');
    expect(data.entry.score).toBe(4200);
  });

  it('POST /api/leaderboard accepts verified zero-line survival run with heavy hard-drops', async () => {
    const validReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.6',
      },
      body: JSON.stringify({
        name: 'SURVIVOR',
        score: 3800,
        lines: 0,
        level: 1,
        telemetry: {
          piecesPlaced: 120,
          dropCount: 120,
          combos: 0,
          purgesTriggered: 0,
          gameDurationMs: 65000,
        },
      }),
    });
    const res = await POST(validReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.entry.name).toBe('SURVIVOR');
    expect(data.entry.score).toBe(3800);
  });

  it('POST /api/leaderboard accepts full 10-character callsigns like CYBER_ZERO without truncation', async () => {
    const validReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.7',
      },
      body: JSON.stringify({
        name: 'CYBER_ZERO',
        score: 6500,
        lines: 10,
        level: 2,
      }),
    });
    const res = await POST(validReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.entry.name).toBe('CYBER_ZERO');
    expect(data.entry.name.length).toBe(10);
  });

  it('POST /api/leaderboard blocks callsign flooding when exceeding window limit', async () => {
    const callsign = 'FLOOD_BOT';
    let lastStatus = 200;

    for (let i = 0; i < 4; i++) {
      const floodReq = new Request('http://localhost:3000/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `172.20.0.${10 + i}`, // cycling IPs
        },
        body: JSON.stringify({
          name: callsign,
          score: 1000 + i,
          lines: 2,
          level: 1,
        }),
      });
      const res = await POST(floodReq);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });

  it('POST /api/leaderboard rejects forged score with 0 lines and missing telemetry', async () => {
    const forgedReq = new Request('http://localhost:3000/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.8',
      },
      body: JSON.stringify({
        name: 'EXPLOIT',
        score: 10000,
        lines: 0,
        level: 1,
      }),
    });
    const res = await POST(forgedReq);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Plausibility threshold exceeded');
  });
});
