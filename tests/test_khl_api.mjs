// Run with: node --test tests/test_khl_api.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

globalThis.window = { location: { origin: 'https://hockey365.test', pathname: '/' } };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
const { getMatch, getMatchesByDate, startMatchPolling } = await import('../assets/js/core/api.js');
const { buildMatchLink } = await import('../assets/js/core/router.js');

const start = Date.parse('2026-10-04T17:00:00Z');
const meta = { unverifiedCompetitions: ['KHL'], updatedAt: '2026-10-04T18:00:00Z' };
const metadata = {
  current_stage_id: 407,
  stages_v2: [{ id: 407, season: '2026/2027', type: 'regular' }],
  teams: [{ id: 16, name: 'ЦСКА' }, { id: 315, name: 'Драконы' }]
};
const fixture = (matchId, eventId, score = '2:1') => ({ event: {
  id: eventId, match_id: matchId, stage_id: 407, type_id: 24,
  start_at: start, game_state_key: 'live', period: 2, score,
  team_a: { id: 16 }, team_b: { id: 315 },
  m3u8_url: 'https://private.test/stream.m3u8', remote_ip: '192.0.2.1'
} });
const response = (body, status = 200) => ({ ok: status < 400, status, statusText: 'test', json: async () => body });
const snapshot = (id, source = { provider: 'KHL mobile backend', verified: true,
  verifiedMatches: true, matchId: id.split(':')[1] }) => ({
  id, compId: 'KHL', utcDate: '2026-10-04T17:00:00Z', home: { score: 0 },
  away: { score: 0 }, source
});

test('one navigation helper carries only verified, numeric KHL event hints', () => {
  const linked = snapshot('khl:903050', { provider: 'KHL mobile backend', verified: true,
    verifiedMatches: true, eventId: 830050, matchId: '903050' });
  assert.equal(buildMatchLink(linked), '/match/?id=khl%3A903050&event=830050');
  for (const source of [
    { ...linked.source, verified: false },
    { ...linked.source, provider: 'legacy' },
    { ...linked.source, matchId: '903051' },
    { ...linked.source, matchId: 0 },
    { ...linked.source, eventId: '1&tab=video' },
    { ...linked.source, eventId: '99999999999999999999' }
  ]) {
    assert.equal(buildMatchLink({ ...linked, source }), '/match/?id=khl%3A903050');
  }
  assert.equal(buildMatchLink({ id: 'nhl:123', compId: 'NHL', source: linked.source }), '/match/?id=nhl%3A123');
});

test('full navigation starts a fresh module and still polls by the verified URL hint without snapshot', () => {
  const link = buildMatchLink(snapshot('khl:903060', { provider: 'KHL mobile backend',
    verified: true, verifiedMatches: true, eventId: 830060, matchId: '903060' }));
  const script = `
    import assert from 'node:assert/strict';
    globalThis.window = { location: { origin: 'https://hockey365.test', search: new URL(${JSON.stringify(link)}, 'https://hockey365.test').search } };
    globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
    const { getParam } = await import(${JSON.stringify(new URL('../assets/js/core/router.js', import.meta.url).href)});
    const { getMatch, startMatchPolling } = await import(${JSON.stringify(new URL('../assets/js/core/api.js', import.meta.url).href)});
    const calls = [];
    let score = '2:1';
    const response = body => ({ ok: true, json: async () => body });
    globalThis.fetch = async url => {
      const parsed = new URL(String(url), 'https://hockey365.test');
      if (parsed.pathname === '/api/khl.php') return { ok: false };
      if (parsed.pathname.startsWith('/data/matches/')) throw new Error('static file must not be needed');
      if (parsed.pathname.endsWith('/data.json')) return response(${JSON.stringify(metadata)});
      if (parsed.pathname.endsWith('/events_v2.json')) {
        calls.push(parsed.searchParams);
        assert.equal(parsed.searchParams.get('q[id_eq]'), '830060');
        return response([{ event: { id: 830060, match_id: '903060', stage_id: 407, type_id: 24,
          start_at: ${start}, game_state_key: 'live', period: 2, score,
          team_a: { id: 16 }, team_b: { id: 315 } } }]);
      }
      throw new Error('unexpected endpoint');
    };
    const hint = getParam('event');
    const first = await getMatch(getParam('id'), true, hint);
    score = '3:2';
    const next = await new Promise((resolve, reject) => {
      const stop = startMatchPolling(getParam('id'), (err, match) => {
        stop();
        if (err) reject(err); else resolve(match);
      }, 60000, hint);
    });
    assert.equal(first.home.score, 2);
    assert.equal(next.home.score, 3);
    assert.equal(calls.length, 2);
    console.log('fresh navigation: 2 exact event requests, 0 stage scans, 0 snapshots');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 10000 });
  assert.match(output, /fresh navigation: 2 exact event requests, 0 stage scans, 0 snapshots/);
});

test('live fixture opens and polls without snapshot, independent of NHL outage', async () => {
  const calls = [];
  let score = '2:1';
  globalThis.fetch = async url => {
    const text = String(url);
    const parsed = new URL(text, 'https://hockey365.test');
    calls.push(text);
    if (parsed.pathname === '/api/khl.php') return response({}, 404);
    if (parsed.pathname === '/api/nhl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/data.json') && parsed.hostname === 'khl.api.webcaster.pro') return response(metadata);
    if (parsed.pathname.endsWith('/events_v2.json')) {
      if (parsed.searchParams.has('q[id_eq]')) {
        assert.equal(parsed.searchParams.get('q[id_eq]'), '830011');
        return response([fixture('903011', 830011, score)]);
      }
      return response(parsed.searchParams.get('page') === '1' ? [fixture('903011', 830011, score)] : []);
    }
    if (parsed.pathname.endsWith('/meta.json')) return response(meta);
    if (parsed.pathname.startsWith('/data/matches/')) return response({}, 404);
    if (parsed.hostname === 'api-web.nhle.com') throw new Error('NHL offline');
    throw new Error('Unexpected endpoint');
  };
  const list = await getMatchesByDate('2026-10-04', false);
  assert.equal(list.feed.feeds.KHL.mode, 'live');
  assert.equal(list.feed.feeds.NHL.mode, 'unavailable');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'khl:903011');
  assert.equal(buildMatchLink(list[0]), '/match/?id=khl%3A903011&event=830011');
  const opened = await getMatch(list[0].id);
  assert.equal(opened.home.score, 2);
  assert.equal(opened.source.delivery, 'live');
  assert.equal(calls.filter(url => url.includes('/data/matches/khl:903011.json')).length, 0);
  assert.doesNotMatch(JSON.stringify(opened), /m3u8|192\.0\.2\.1/);

  score = '3:2';
  const updates = [];
  const done = new Promise((resolve, reject) => {
    const stop = startMatchPolling('khl:903011', (error, match) => {
      if (error) { stop(); reject(error); return; }
      updates.push(match);
      stop();
      resolve();
    }, 60_000);
  });
  await done;
  assert.equal(updates[0].home.score, 3);
  assert.equal(updates[0].away.score, 2);
  assert.equal(calls.filter(url => url.includes('/data/matches/khl:903011.json')).length, 0);
});

test('cold direct match id scans current stage; mismatched ids never leak', async () => {
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'https://hockey365.test');
    if (parsed.pathname === '/api/khl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/data.json')) return response(metadata);
    if (parsed.pathname.endsWith('/events_v2.json')) {
      if (parsed.searchParams.get('page') === '1') return response([fixture('903099', 830099)]);
      if (parsed.searchParams.get('page') === '2') return response([fixture('903012', 830012)]);
      return response([]);
    }
    if (parsed.pathname.endsWith('/meta.json')) return response(meta);
    if (parsed.pathname.startsWith('/data/matches/')) return response({}, 404);
    throw new Error('unexpected endpoint');
  };
  assert.equal((await getMatch('khl:903012')).source.eventId, 830012);
  await assert.rejects(getMatch('khl:903013'), /нет подтверждённого источника/);
});

test('verified snapshot may supply an event hint, but the API still decides the result', async () => {
  const calls = [];
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'https://hockey365.test');
    if (parsed.pathname === '/api/khl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/data/matches/khl:903080.json')) return response(snapshot('khl:903080', {
      provider: 'KHL mobile backend', verified: true, verifiedMatches: true,
      matchId: '903080', eventId: 830080
    }));
    if (parsed.pathname.endsWith('/data.json')) return response(metadata);
    if (parsed.pathname.endsWith('/events_v2.json')) {
      calls.push(parsed.searchParams);
      return response([fixture('903080', 830080, '5:3')]);
    }
    throw new Error('unexpected endpoint');
  };
  const result = await getMatch('khl:903080', false);
  assert.equal(result.source.delivery, 'live');
  assert.equal(result.home.score, 5);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].get('q[id_eq]'), '830080');
});

test('a wrong URL event hint cannot display another match or a legacy snapshot', async () => {
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'https://hockey365.test');
    if (parsed.pathname === '/api/khl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/data.json')) return response(metadata);
    if (parsed.pathname.endsWith('/events_v2.json')) {
      return response(parsed.searchParams.has('q[id_eq]') ? [fixture('903091', 830091)] : []);
    }
    if (parsed.pathname.endsWith('/meta.json')) return response({});
    if (parsed.pathname.endsWith('/data/matches/khl:903090.json')) return response(snapshot('khl:903090', {
      provider: 'legacy', verified: true, verifiedMatches: true
    }));
    throw new Error('unexpected endpoint');
  };
  await assert.rejects(getMatch('khl:903090', false, '830091'), /нет подтверждённого источника/);
});

test('a snapshot without event id does not repeat the bounded scan on polling', async () => {
  let pages = 0;
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'https://hockey365.test');
    if (parsed.pathname === '/api/khl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/data/matches/khl:903100.json')) return response(snapshot('khl:903100'));
    if (parsed.pathname.endsWith('/meta.json')) return response({});
    if (parsed.pathname.endsWith('/data.json')) return response(metadata);
    if (parsed.pathname.endsWith('/events_v2.json')) {
      pages++;
      return response([fixture('903999', 899999)]);
    }
    throw new Error('unexpected endpoint');
  };
  assert.equal((await getMatch('khl:903100', false)).source.delivery, 'snapshot');
  assert.equal(pages, 4);
  const polled = await new Promise((resolve, reject) => {
    const stop = startMatchPolling('khl:903100', (error, match) => {
      stop();
      if (error) reject(error); else resolve(match);
    }, 60_000);
  });
  assert.equal(polled.source.delivery, 'snapshot');
  assert.equal(pages, 4);
});

test('network failure or no exact match uses only a verified, matching snapshot', async () => {
  for (const kind of ['network', 'missing']) {
    for (const candidate of [snapshot('khl:903020'), snapshot('khl:903021'),
      snapshot('khl:903020', { provider: 'legacy', verified: true, verifiedMatches: true }),
      snapshot('khl:903020', { provider: 'KHL mobile backend', verified: true }),
      snapshot('khl:903020', { provider: 'KHL mobile backend', verified: true, verifiedMatches: true, matchId: '999' })]) {
      globalThis.fetch = async url => {
        const parsed = new URL(String(url), 'https://hockey365.test');
        if (parsed.pathname === '/api/khl.php') return response({}, 404);
        if (parsed.pathname.endsWith('/data.json')) return response(metadata);
        if (parsed.pathname.endsWith('/events_v2.json')) {
          if (kind === 'network') throw new Error('CORS unavailable');
          return response(parsed.searchParams.get('page') === '1' ? [fixture('903999', 899999)] : []);
        }
        if (parsed.pathname.endsWith('/meta.json')) return response({}); // No unverifiedCompetitions guard.
        if (parsed.pathname.endsWith('/data/matches/khl:903020.json')) return response(candidate);
        throw new Error('unexpected endpoint');
      };
      if (candidate.id === 'khl:903020' && candidate.source.provider === 'KHL mobile backend' &&
          candidate.source.verifiedMatches && candidate.source.matchId === '903020') {
        const result = await getMatch('khl:903020', false);
        assert.equal(result.source.delivery, 'snapshot');
      } else {
        await assert.rejects(getMatch('khl:903020', false), /нет подтверждённого источника/);
      }
    }
  }
});

test('date fallback hides legacy KHL even when meta has no unverifiedCompetitions', async () => {
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'https://hockey365.test');
    if (parsed.pathname === '/api/khl.php' || parsed.pathname === '/api/nhl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/meta.json')) return response({});
    if (parsed.pathname.endsWith('/by-date/2099-01-03.json')) return response([
      snapshot('khl:903030', { provider: 'legacy' }), snapshot('khl:903031')
    ]);
    throw new Error('feed offline');
  };
  const matches = await getMatchesByDate('2099-01-03', false);
  assert.deepEqual(matches.map(match => match.id), ['khl:903031']);
  assert.equal(matches.feed.feeds.KHL.mode, 'snapshot');
});

test('both KHL API and static file unavailable leaves the match unavailable', async () => {
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'https://hockey365.test');
    if (parsed.pathname === '/api/khl.php') return response({}, 404);
    if (parsed.pathname.endsWith('/meta.json')) return response({});
    if (parsed.pathname.startsWith('/data/matches/')) return response({}, 404);
    throw new Error('upstream unavailable');
  };
  await assert.rejects(getMatch('khl:903040', false), /нет подтверждённого источника/);
});
