import test from 'node:test';
import assert from 'node:assert/strict';
import app, { liveMatchesPayload } from '../src/index.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('GET /health returns 200 and version 2.0.0', async () => {
  const res = await app.request('/health');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.version, '2.0.0');
});

test('GET /api/meta returns site metadata', async () => {
  const res = await app.request('/api/meta');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.siteName);
});

test('GET /api/matches returns match list for date', async () => {
  const res = await app.request('/api/matches?date=2026-10-04');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.matches));
  assert.equal(data.date, '2026-10-04');
});

test('GET /api/matches hydrates a live score from NHL gamecenter', async (t) => {
  const date = '2026-10-04';
  const gameId = 2026029999;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith(`/schedule/${date}`)) {
      return jsonResponse({
        gameWeek: [{
          date,
          games: [{
            id: gameId,
            season: 20262027,
            startTimeUTC: `${date}T17:00:00Z`,
            gameState: 'LIVE',
            periodDescriptor: { number: 1 },
            homeTeam: { abbrev: 'AAA' },
            awayTeam: { abbrev: 'BBB' }
          }]
        }]
      });
    }
    if (url.endsWith(`/gamecenter/${gameId}/boxscore`)) {
      return jsonResponse({
        gameState: 'LIVE',
        periodDescriptor: { number: 2 },
        clock: { timeRemaining: '09:41', inIntermission: false },
        homeTeam: { abbrev: 'AAA', score: 3, sog: 22 },
        awayTeam: { abbrev: 'BBB', score: 1, sog: 17 }
      });
    }
    if (url.endsWith(`/gamecenter/${gameId}/play-by-play`)) {
      return jsonResponse({
        gameState: 'LIVE',
        homeTeam: { abbrev: 'AAA', score: 3 },
        awayTeam: { abbrev: 'BBB', score: 1 }
      });
    }
    throw new Error(`Unexpected NHL URL: ${url}`);
  });

  const res = await app.request(`/api/matches?date=${date}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.matches.length, 1);
  assert.deepEqual(data.matches[0].home, { id: 'nhl:aaa', score: 3, shots: 22 });
  assert.deepEqual(data.matches[0].away, { id: 'nhl:bbb', score: 1, shots: 17 });
  assert.equal(data.matches[0].period, 2);
  assert.equal(data.matches[0].clock, '09:41');
  assert.equal(data.matches[0].status, 'LIVE');
  assert.ok(calls.some(url => url.endsWith(`/gamecenter/${gameId}/boxscore`)));
  assert.ok(calls.some(url => url.endsWith(`/gamecenter/${gameId}/play-by-play`)));
});

test('SSE match_update payload keeps the client-compatible full match list', () => {
  const matches = [
    { id: 'nhl:1', status: 'LIVE', home: { score: 2 }, away: { score: 0 } },
    { id: 'nhl:2', status: 'SCHEDULED', home: { score: null }, away: { score: null } }
  ];
  const payload = liveMatchesPayload({
    date: '2026-10-04',
    matches,
    fetchedAt: '2026-10-04T17:00:00.000Z'
  });

  assert.equal(payload.date, '2026-10-04');
  assert.deepEqual(payload.matches, matches);
  assert.equal(payload.fetchedAt, '2026-10-04T17:00:00.000Z');
});

test('GET /api/news returns normalized hockey news', async () => {
  const res = await app.request('/api/news');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.news));
});

test('KHL player endpoint refuses unverified local dossier data', async () => {
  const res = await app.request('/api/players/khl:p_goldobin');
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.match(data.error, /no verified provider/i);
});

test('Chat API handles posting, filtering and rate-limiting', async () => {
  const roomId = 'test_match_room_1';
  const userId = `user_${Date.now()}`;

  // 1. Post valid message with profanity that should be censored
  const postRes = await app.request(`/api/chat/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      userName: 'Хоккеист87',
      authProvider: 'telegram',
      content: 'Отличный гол, сука красота!'
    })
  });

  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.success, true);
  assert.equal(postData.message.content, 'Отличный гол, *** красота!');

  // 2. Immediate second post by same user triggers rate-limit (429)
  const rapidRes = await app.request(`/api/chat/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      userName: 'Хоккеист87',
      content: 'Спам спам'
    })
  });
  assert.equal(rapidRes.status, 429);

  // 3. Retrieve messages
  const getRes = await app.request(`/api/chat/${roomId}/messages`);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.count, 1);
  assert.equal(getData.messages[0].userName, 'Хоккеист87');
});
