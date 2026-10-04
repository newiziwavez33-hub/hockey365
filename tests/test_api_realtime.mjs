// Run with: node --experimental-default-type=module --test tests/test_api_realtime.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { location: { pathname: '/' } };
const listeners = new Map();
globalThis.document = {
  visibilityState: 'visible',
  addEventListener(name, callback) { listeners.set(name, callback); },
  removeEventListener(name, callback) {
    if (listeners.get(name) === callback) listeners.delete(name);
  }
};

const { getMatchesByDate, getMatch, getPlayer } = await import('../assets/js/core/api.js');

function response(data) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() { return data; }
  };
}

function scheduleGame(overrides = {}) {
  return {
    id: 2026020099,
    season: 20262027,
    gameType: 2,
    venue: { default: 'Test Arena' },
    startTimeUTC: '2026-10-04T17:00:00Z',
    gameState: 'LIVE',
    gameScheduleState: 'OK',
    periodDescriptor: { number: 2, periodType: 'REG' },
    clock: { timeRemaining: '05:12', running: true, inIntermission: false },
    awayTeam: { id: 16, abbrev: 'CHI', score: 1, sog: 14 },
    homeTeam: { id: 7, abbrev: 'BUF', score: 2, sog: 18 },
    gameCenterLink: '/gamecenter/chi-vs-buf/2026/10/04/2026020099',
    ...overrides
  };
}

test('date schedule prefers official NHL data and does not invent events', async () => {
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    assert.match(String(url), /^https:\/\/api-web\.nhle\.com\/v1\/schedule\/2026-10-04/);
    return response({
      gameWeek: [
        { date: '2026-10-03', games: [scheduleGame({ id: 1 })] },
        { date: '2026-10-04', games: [scheduleGame()] }
      ]
    });
  };

  const matches = await getMatchesByDate('2026-10-04', false);
  assert.equal(calls.length, 1);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].home, { id: 'nhl:buf', score: 2, shots: 18 });
  assert.deepEqual(matches[0].away, { id: 'nhl:chi', score: 1, shots: 14 });
  assert.equal(matches[0].status, 'LIVE');
  assert.equal(matches[0].period, 2);
  assert.equal(matches[0].clock, '05:12');
  assert.deepEqual(matches[0].events, []);
  assert.equal(matches[0].source.provider, 'NHL Web API');
  assert.equal(matches[0].source.official, true);
});

test('gamecenter combines boxscore with play-by-play and keeps official event fields', async () => {
  const calls = [];
  globalThis.fetch = async url => {
    const value = String(url);
    calls.push(value);
    if (value.includes('/data/meta.json')) return response({ unverifiedCompetitions: ['KHL'] });
    if (value.includes('/boxscore')) {
      return response({
        id: 2026020098,
        season: 20262027,
        gameType: 2,
        venue: { default: 'Test Arena' },
        startTimeUTC: '2026-10-04T17:00:00Z',
        gameState: 'OFF',
        periodDescriptor: { number: 3, periodType: 'REG' },
        gameOutcome: { lastPeriodType: 'REG' },
        awayTeam: { id: 16, abbrev: 'CHI', score: 3, sog: 15 },
        homeTeam: { id: 7, abbrev: 'BUF', score: 4, sog: 28 },
        playerByGameStats: {
          homeTeam: { goalies: [{ playerId: 8480045, sweaterNumber: 1, name: { default: 'U. Luukkonen' } }] },
          awayTeam: { goalies: [{ playerId: 8481519, sweaterNumber: 30, name: { default: 'S. Knight' } }] }
        }
      });
    }
    assert.match(value, /\/play-by-play\?/);
    return response({
      id: 2026020098,
      season: 20262027,
      gameType: 2,
      startTimeUTC: '2026-10-04T17:00:00Z',
      gameState: 'OFF',
      periodDescriptor: { number: 3, periodType: 'REG' },
      awayTeam: { id: 16, abbrev: 'CHI', score: 3, sog: 15 },
      homeTeam: { id: 7, abbrev: 'BUF', score: 4, sog: 28 },
      rosterSpots: [{ playerId: 8477987, firstName: { default: 'Ryan' }, lastName: { default: 'Donato' } }],
      plays: [
        {
          typeDescKey: 'goal',
          periodDescriptor: { number: 1, periodType: 'REG' },
          timeInPeriod: '07:59',
          sortOrder: 127,
          details: {
            eventOwnerTeamId: 16,
            scoringPlayerId: 8477987,
            assist1PlayerId: 8481568,
            homeScore: 0,
            awayScore: 1
          }
        },
        {
          typeDescKey: 'penalty',
          periodDescriptor: { number: 2, periodType: 'REG' },
          timeInPeriod: '11:39',
          details: { eventOwnerTeamId: 7, committedByPlayerId: 8482659, duration: 2, descKey: 'hooking' }
        }
      ]
    });
  };

  const match = await getMatch('nhl:2026020098', false);
  assert.equal(calls.filter(url => url.includes('api-web.nhle.com')).length, 2);
  assert.equal(match.status, 'FINISHED');
  assert.equal(match.finishedIn, 'REG');
  assert.deepEqual(match.stats.shots, [28, 15]);
  assert.equal(match.lineups.home.goalies[0].playerId, 'nhl:p_8480045');
  assert.deepEqual(match.events[0], {
    type: 'GOAL', period: 1, time: '07:59', team: 'away', playerId: 'nhl:p_8477987',
    playerName: 'Ryan Donato', assists: ['nhl:p_8481568'], score: '0-1', order: 127
  });
  assert.equal(match.events[1].type, 'PENALTY');
  assert.equal(match.events[1].minutes, 2);
  assert.equal(match.events[1].reason, 'hooking');
});

test('official network failure falls back to static JSON and keeps KHL hidden', async () => {
  globalThis.fetch = async url => {
    const path = new URL(String(url), 'https://hockey365.test').pathname;
    if (path.startsWith('/data/')) {
      if (path.endsWith('/meta.json')) return response({ unverifiedCompetitions: ['KHL'] });
      if (path.endsWith('/by-date/2099-01-02.json')) return response([
        { id: 'khl:demo', compId: 'KHL' },
        { id: 'nhl:static', compId: 'NHL' }
      ]);
    }
    throw new Error('network unavailable');
  };

  const matches = await getMatchesByDate('2099-01-02', false);
  assert.deepEqual(matches.map(match => match.id), ['nhl:static']);
});

test('NHL player dossiers use official landing data and official headshots', async () => {
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/data/meta.json')) return response({ unverifiedCompetitions: ['KHL'] });
    assert.match(value, /api-web\.nhle\.com\/v1\/player\/8478402\/landing/);
    return response({
      playerId: 8478402,
      firstName: { default: 'Connor' },
      lastName: { default: 'McDavid' },
      position: 'C',
      currentTeamAbbrev: 'EDM',
      headshot: 'https://assets.nhle.com/mugs/nhl/20262027/EDM/8478402.png',
      seasonTotals: [{ season: 20262027, leagueAbbrev: 'NHL', gamesPlayed: 7, goals: 7, assists: 7, points: 14 }]
    });
  };

  const player = await getPlayer('nhl:p_8478402');
  assert.equal(player.source.official, true);
  assert.equal(player.photo, 'https://assets.nhle.com/mugs/nhl/20262027/EDM/8478402.png');
  assert.deepEqual(player.stats[0], {
    season: '2026/27', compId: 'NHL', gp: 7, g: 7, a: 7, pts: 14
  });
});
