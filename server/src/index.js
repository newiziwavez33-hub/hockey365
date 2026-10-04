/**
 * Hockey365 High-Performance Live Backend API
 * Built with Hono (Node.js / Cloudflare / Vercel ready)
 * Features: REST API, Server-Sent Events (SSE) Live Stream, Ingestion Worker, and Moderated Chat
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const app = new Hono();

// Global Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-RateLimit-Limit']
}));

// In-Memory Chat Storage & SSE Subscribers
const chatMessages = new Map(); // roomId -> array of messages
const chatRateLimits = new Map(); // userId -> lastMessageTimestamp
const sseSubscribers = new Set(); // active SSE stream controllers
const sseSubscriberDates = new Map();
const livePollers = new Map();
const liveFingerprints = new Map();

// Banned words list for chat moderation (RU/EN basic filter)
const BANNED_PATTERNS = [
  /блять/i, /сука/i, /пиздец/i, /хуй/i, /ебать/i, /мудак/i, /пидор/i, /долбоеб/i,
  /fuck/i, /shit/i, /bitch/i, /cunt/i, /asshole/i
];

function sanitizeContent(text) {
  let clean = text.trim();
  for (const pattern of BANNED_PATTERNS) {
    clean = clean.replace(pattern, '***');
  }
  return clean;
}

// Helper to read JSON from repo data/ directory
function readLocalData(relPath) {
  try {
    const fullPath = path.join(REPO_ROOT, 'data', relPath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    }
  } catch (err) {
    console.warn(`Error reading local data ${relPath}:`, err.message);
  }
  return null;
}

// ----------------------------------------------------------------------------
// 1. HEALTH CHECK & METADATA
// ----------------------------------------------------------------------------

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    engine: 'Hono on Node.js',
    activeSseSubscribers: sseSubscribers.size
  });
});

app.get('/api/meta', (c) => {
  const meta = readLocalData('meta.json') || {
    version: '2.0.0',
    siteName: 'Hockey365',
    activeDate: new Date().toISOString().split('T')[0]
  };
  return c.json(meta);
});

// ----------------------------------------------------------------------------
// 2. MATCHES API (NHL Live + KHL Confirmed Schedules)
// ----------------------------------------------------------------------------

app.get('/api/matches', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
  const league = c.req.query('league')?.toUpperCase();

  // Try official NHL API first for real-time freshness
  let nhlMatches = [];
  try {
    const nhlRes = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(date)}`, {
      headers: { 'User-Agent': 'Hockey365-Server/2.0' },
      signal: AbortSignal.timeout(6000)
    });
    if (nhlRes.ok) {
      const data = await nhlRes.json();
      const games = (data?.gameWeek || [])
        .filter(d => d?.date === date)
        .flatMap(d => Array.isArray(d.games) ? d.games : []);

      nhlMatches = games.map(g => ({
        id: `nhl:${g.id}`,
        compId: 'NHL',
        season: String(g.season || '20262027'),
        utcDate: g.startTimeUTC,
        status: g.gameState === 'FINAL' || g.gameState === 'OFF' ? 'FINISHED'
          : ['LIVE', 'CRIT'].includes(g.gameState) ? (g.clock?.inIntermission ? 'INTERMISSION' : 'LIVE')
          : 'SCHEDULED',
        period: g.periodDescriptor?.number || null,
        clock: g.clock?.timeRemaining || null,
        finishedIn: g.gameOutcome?.lastPeriodType || null,
        home: {
          id: `nhl:${g.homeTeam?.abbrev?.toLowerCase()}`,
          score: g.homeTeam?.score ?? null,
          shots: g.homeTeam?.sog ?? null
        },
        away: {
          id: `nhl:${g.awayTeam?.abbrev?.toLowerCase()}`,
          score: g.awayTeam?.score ?? null,
          shots: g.awayTeam?.sog ?? null
        },
        source: {
          provider: 'NHL Web API',
          official: true,
          fetchedAt: new Date().toISOString()
        },
        verifiedExternalUrl: g.gameCenterLink ? `https://www.nhl.com${g.gameCenterLink}` : null
      }));
    }
  } catch (err) {
    console.warn(`NHL live schedule fetch fallback for ${date}:`, err.message);
  }

  // Fallback to local verified snapshots if live API is unavailable
  if (!nhlMatches.length) {
    const fallback = readLocalData(`matches/by-date/${date}.json`);
    if (Array.isArray(fallback)) {
      nhlMatches = fallback.filter(match => match?.compId === 'NHL');
    }
  }

  let results = nhlMatches;
  if (league) {
    results = results.filter(m => m.compId === league);
  }

  return c.json({
    date,
    total: results.length,
    matches: results,
    fetchedAt: new Date().toISOString()
  });
});

app.get('/api/matches/:id', async (c) => {
  const matchId = c.req.param('id');

  // If NHL match, fetch authoritative boxscore & play-by-play
  const nhlMatchNum = /^nhl:(\d+)$/i.exec(matchId)?.[1];
  if (nhlMatchNum) {
    try {
      const [boxRes, pbpRes] = await Promise.all([
        fetch(`https://api-web.nhle.com/v1/gamecenter/${nhlMatchNum}/boxscore`, { signal: AbortSignal.timeout(6000) }),
        fetch(`https://api-web.nhle.com/v1/gamecenter/${nhlMatchNum}/play-by-play`, { signal: AbortSignal.timeout(6000) })
      ]);

      const box = boxRes.ok ? await boxRes.json() : null;
      const pbp = pbpRes.ok ? await pbpRes.json() : null;

      if (box || pbp) {
        return c.json({
          id: matchId,
          compId: 'NHL',
          boxscore: box,
          playByPlay: pbp,
          source: { provider: 'NHL Web API', official: true, fetchedAt: new Date().toISOString() }
        });
      }
    } catch (err) {
      console.warn(`Error fetching live NHL gamecenter ${matchId}:`, err.message);
    }
  }

  // Fallback to local file
  const localMatch = readLocalData(`matches/${matchId}.json`);
  if (localMatch) {
    return c.json(localMatch);
  }

  return c.json({ error: 'Match not found', id: matchId }, 404);
});

// ----------------------------------------------------------------------------
// 3. SERVER-SENT EVENTS (SSE) REAL-TIME LIVE STREAM
// ----------------------------------------------------------------------------

app.get('/api/live', (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  return streamSSE(c, async (stream) => {
    sseSubscribers.add(stream);
    sseSubscriberDates.set(stream, date);
    ensureLivePoller(date);

    // The first event contains the current official snapshot so a client does
    // not wait for the next 5-second poll before rendering live scores.
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ message: 'Hockey365 Live SSE Stream Connected', date, time: new Date().toISOString() })
    });
    try {
      const response = await app.request(`/api/matches?date=${encodeURIComponent(date)}`);
      const payload = await response.json();
      await stream.writeSSE({
        event: 'match_update',
        data: JSON.stringify({ date, matches: payload.matches || [], fetchedAt: payload.fetchedAt })
      });
    } catch (error) {
      console.warn(`Initial live snapshot failed for ${date}:`, error.message);
    }

    // Keep-alive heartbeat every 15s
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ ping: Date.now() })
        });
      } catch {
        clearInterval(heartbeat);
        sseSubscribers.delete(stream);
      }
    }, 15000);

    stream.onAbort(() => {
      clearInterval(heartbeat);
      sseSubscribers.delete(stream);
      sseSubscriberDates.delete(stream);
      stopUnusedLivePoller(date);
    });
  });
});

function liveMatchesPayload(payload) {
  return {
    date: payload.date,
    matches: (payload.matches || []).filter(match => ['LIVE', 'INTERMISSION'].includes(match.status)),
    fetchedAt: payload.fetchedAt || new Date().toISOString()
  };
}

function ensureLivePoller(date) {
  if (livePollers.has(date)) return;
  const poll = async () => {
    try {
      const response = await app.request(`/api/matches?date=${encodeURIComponent(date)}`);
      const payload = liveMatchesPayload(await response.json());
      const fingerprint = JSON.stringify(payload.matches);
      if (fingerprint !== liveFingerprints.get(date)) {
        liveFingerprints.set(date, fingerprint);
        await broadcastLiveUpdate(payload, date);
      }
    } catch (error) {
      console.warn(`Live poll failed for ${date}:`, error.message);
    }
  };
  const timer = setInterval(poll, 5000);
  livePollers.set(date, timer);
  poll();
}

function stopUnusedLivePoller(date) {
  const stillUsed = [...sseSubscriberDates.values()].some(value => value === date);
  if (stillUsed) return;
  const timer = livePollers.get(date);
  if (timer) clearInterval(timer);
  livePollers.delete(date);
  liveFingerprints.delete(date);
}

// Broadcast helper for live match score updates
export async function broadcastLiveUpdate(matchEvent, date = matchEvent?.date) {
  const payload = JSON.stringify(matchEvent);
  for (const stream of sseSubscribers) {
    if (date && sseSubscriberDates.get(stream) !== date) continue;
    try {
      await stream.writeSSE({
        event: 'match_update',
        data: payload
      });
    } catch {
      sseSubscribers.delete(stream);
    }
  }
}

// ----------------------------------------------------------------------------
// 4. LIVE CHAT & MODERATION API (Telegram & Google Auth)
// ----------------------------------------------------------------------------

app.get('/api/chat/:roomId/messages', (c) => {
  const roomId = c.req.param('roomId');
  const messages = chatMessages.get(roomId) || [];
  return c.json({
    roomId,
    count: messages.length,
    messages: messages.slice(-50) // last 50 messages
  });
});

app.post('/api/chat/:roomId/messages', async (c) => {
  const roomId = c.req.param('roomId');
  const body = await c.req.json().catch(() => ({}));

  const { userId, userName, userAvatar, content, authProvider } = body;

  if (!userId || !userName || !content) {
    return c.json({ error: 'Missing required fields: userId, userName, content' }, 400);
  }

  // Rate Limiting: 1 message per 3 seconds per user
  const now = Date.now();
  const lastMsgTime = chatRateLimits.get(userId) || 0;
  if (now - lastMsgTime < 3000) {
    return c.json({
      error: 'Слишком частые сообщения. Пожалуйста, подождите 3 секунды.',
      retryAfterMs: 3000 - (now - lastMsgTime)
    }, 429);
  }
  chatRateLimits.set(userId, now);

  // Content Length Limit: max 300 characters
  if (content.length > 300) {
    return c.json({ error: 'Сообщение превышает лимит в 300 символов' }, 400);
  }

  // Automated Profanity Filter
  const sanitized = sanitizeContent(content);

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    roomId,
    userId,
    userName: userName.slice(0, 32),
    userAvatar: userAvatar || null,
    authProvider: authProvider || 'guest',
    content: sanitized,
    createdAt: new Date().toISOString()
  };

  if (!chatMessages.has(roomId)) {
    chatMessages.set(roomId, []);
  }
  const roomMsgs = chatMessages.get(roomId);
  roomMsgs.push(message);

  // Keep max 200 messages in memory per room
  if (roomMsgs.length > 200) {
    roomMsgs.shift();
  }

  return c.json({ success: true, message });
});

// ----------------------------------------------------------------------------
// 5. NEWS API
// ----------------------------------------------------------------------------

app.get('/api/news', (c) => {
  const news = readLocalData('news/index.json') || { news: [] };
  return c.json(news);
});

// ----------------------------------------------------------------------------
// 6. TEAMS & PLAYERS API
// ----------------------------------------------------------------------------

app.get('/api/teams/:id', (c) => {
  const teamId = c.req.param('id');
  const team = readLocalData(`teams/${teamId}.json`);
  if (team) return c.json(team);
  return c.json({ error: 'Team not found', id: teamId }, 404);
});

app.get('/api/players/:id', async (c) => {
  const playerId = c.req.param('id');
  const nhlId = /^nhl:p_(\d+)$/i.exec(playerId)?.[1];
  if (nhlId) {
    try {
      const response = await fetch(`https://api-web.nhle.com/v1/player/${nhlId}/landing`, {
        headers: { 'User-Agent': 'Hockey365-Server/2.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        const official = await response.json();
        const first = official.firstName?.default || '';
        const last = official.lastName?.default || '';
        return c.json({
          id: `nhl:p_${official.playerId}`,
          name: `${first} ${last}`.trim(),
          nameEn: `${first} ${last}`.trim(),
          position: official.position,
          shoots: official.shootsCatches || null,
          birthDate: official.birthDate || null,
          heightCm: official.heightInCentimeters ?? null,
          weightKg: official.weightInKilograms ?? null,
          nationality: official.birthCountry || null,
          number: official.sweaterNumber ?? null,
          teamId: official.currentTeamAbbrev ? `nhl:${official.currentTeamAbbrev.toLowerCase()}` : null,
          photo: official.headshot || null,
          stats: official.seasonTotals || [],
          career: [],
          source: { provider: 'NHL Web API', official: true, fetchedAt: new Date().toISOString() }
        });
      }
    } catch (err) {
      console.warn(`Official NHL player fetch failed for ${playerId}:`, err.message);
    }
  }
  if (/^khl:/i.test(playerId)) {
    return c.json({ error: 'KHL player data has no verified provider', id: playerId }, 404);
  }
  const player = readLocalData(`players/${playerId}.json`);
  if (player) return c.json(player);
  return c.json({ error: 'Player not found', id: playerId }, 404);
});

// Start Server if run directly
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const isMainScript = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainScript) {
  serve({
    fetch: app.fetch,
    port: PORT
  }, (info) => {
    console.log(`🏒 Hockey365 Live Backend Server running at http://localhost:${info.port}`);
  });
}

export default app;
