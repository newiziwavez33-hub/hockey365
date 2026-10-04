// Run with: node --test tests/test_khl_feed.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { getKhlMatchesByDate, getKhlEvent, getKhlMatch } from '../assets/js/core/khl-feed.js';

const BASE = 'https://khl.api.webcaster.pro/api/khl_mobile';
const start = Date.parse('2026-10-04T17:00:00Z');
const image = 'https://thumbs.webcaster.pro/rec-1-1.webcaster.pro/cska.png';
const data = {
  current_stage_id: 407,
  stages_v2: [{ id: 407, season: '2026/2027', type: 'regular' }],
  teams: [
    { id: 16, khl_id: 2, name: 'ЦСКА', image },
    { id: 315, khl_id: 568, name: 'Драконы', image: 'http://thumbs.webcaster.pro/insecure.png' }
  ]
};

function event(overrides = {}) {
  return { event: {
    id: 78231, match_id: '902100', stage_id: 407, type_id: 24,
    game_state_key: 'live', period: 2,
    start_at: start, event_start_at: start - 600_000,
    team_a: { id: 16, khl_id: 2, name: 'ЦСКА', image },
    team_b: { id: 315, khl_id: 568, name: 'Драконы', image: 'javascript:alert(1)' },
    score: '2:1', scores: { first_period: '1:0', second_period: '1:1', third_period: null,
      overtime: null, bullitt: null },
    stage_name: 'Регулярный чемпионат 2026/2027',
    m3u8_url: 'https://example.test/private.m3u8', iframe_code: '<iframe>video</iframe>',
    remote_ip: '192.0.2.1', ...overrides
  } };
}

function mock(pages, { teams = data.teams } = {}) {
  const calls = [];
  async function fetcher(url, useCache) {
    calls.push({ url, useCache });
    if (url === `${BASE}/data.json`) return { ...data, teams };
    assert.equal(useCache, false, 'event requests must bypass fetchJSON cache');
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/khl_mobile/events_v2.json');
    assert.equal(parsed.searchParams.get('stage_id'), '407');
    return pages[Number(parsed.searchParams.get('page') || 1) - 1] ?? [];
  }
  return { fetcher, calls };
}

test('two polls refresh status and score, never expose video URLs or IP', async () => {
  const source = mock([[event()], []]);
  const first = await getKhlMatchesByDate('2026-10-04', source.fetcher);
  assert.equal(first.length, 1);
  const live = first[0];
  assert.equal(live.id, 'khl:902100');
  assert.equal(live.utcDate, '2026-10-04T17:00:00.000Z');
  assert.equal(live.status, 'LIVE');
  assert.equal(live.period, 2);
  assert.equal(live.home.id, 'khl:cska');
  assert.equal(live.away.id, 'khl:dragons');
  assert.equal(live.home.score, 2);
  assert.equal(live.away.score, 1);
  assert.deepEqual(live.home.periods, [1, 1]);
  assert.equal(live.home.logo, image);
  assert.equal(live.away.logo, null);
  assert.deepEqual(live.source, {
    provider: 'KHL mobile backend', official: true, verified: true, verifiedMatches: true,
    licenseConfirmed: false, delivery: 'live', endpoint: `${BASE}/events_v2.json`,
    stageId: 407, eventId: 78231, matchId: '902100', fetchedAt: live.source.fetchedAt
  });
  assert.ok(Number.isFinite(Date.parse(live.source.fetchedAt)));
  assert.doesNotMatch(JSON.stringify(live), /m3u8|iframe|192\.0\.2\.1/);

  source.fetcher = mock([[event({ game_state_key: 'finished', period: -1,
    score: '3:1', scores: { first_period: '1:0', second_period: '1:1',
      third_period: '1:0', overtime: null, bullitt: null } })], []]).fetcher;
  const second = (await getKhlMatchesByDate('2026-10-04', source.fetcher))[0];
  assert.equal(second.status, 'FINISHED');
  assert.equal(second.period, null);
  assert.equal(second.finishedIn, 'REG');
  assert.equal(second.home.score, 3);
  assert.deepEqual(second.home.periods, [1, 1, 1]);
  assert.equal(source.calls[0].useCache, true);
  assert.ok(source.calls.slice(1).every(call => call.useCache === false));
});

test('date bounds in seconds, paginated until empty, media filtered and match_id deduplicated', async () => {
  const source = mock([
    [event(), event({ id: 900, type_id: 4, score: '99:0' }),
      event({ id: 901, stage_id: 370, score: '99:0' })],
    [event({ id: 78232, type_id: 18, game_state_key: 'finished', score: '3:2',
      scores: { first_period: '1:0', second_period: '1:1', third_period: '1:1' } }),
      event({ id: 78233, match_id: '902200', start_at: Date.parse('2026-10-05T00:00:00Z'),
        event_start_at: Date.parse('2026-10-04T23:50:00Z') })], []
  ]);
  const matches = await getKhlMatchesByDate('2026-10-04', source.fetcher);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].source.eventId, 78232);
  assert.equal(matches[0].home.score, 3);
  assert.deepEqual(source.calls.map(call => call.useCache), [true, false, false, false]);
  const query = new URL(source.calls[1].url).searchParams;
  assert.equal(query.get('q[start_at_gt_time_from_unixtime]'), String(start / 1000 - 17 * 3600 - 1));
  assert.equal(query.get('q[start_at_lt_time_from_unixtime]'), String(start / 1000 + 7 * 3600));
  assert.equal(query.get('order_direction'), 'asc');
  assert.deepEqual(source.calls.slice(1).map(call => new URL(call.url).searchParams.get('page')), ['1', '2', '3']);
});

test('future 0:0 is null, shootout attempts do not become period goals', async () => {
  const source = mock([[event({ id: 1, game_state_key: 'not_yet_started', period: -1,
    score: '0:0', scores: { first_period: null, second_period: null, third_period: null } }),
    event({ id: 2, match_id: '902101', game_state_key: 'finished', period: -1,
      score: '3:2', scores: { first_period: '1:1', second_period: '1:1',
        third_period: '0:0', overtime: '0:0', bullitt: '1:0' } })], []]);
  const matches = await getKhlMatchesByDate('2026-10-04', source.fetcher);
  assert.equal(matches[0].status, 'SCHEDULED');
  assert.equal(matches[0].home.score, null);
  assert.equal(matches[0].away.score, null);
  assert.equal(matches[0].period, null);
  assert.deepEqual(matches[0].home.periods, []);
  assert.equal(matches[1].finishedIn, 'SO');
  assert.deepEqual(matches[1].home.periods, []);
});

test('valid empty date returns empty; invalid data, state and transport errors propagate', async () => {
  assert.deepEqual(await getKhlMatchesByDate('2026-10-04', mock([[]]).fetcher), []);
  await assert.rejects(getKhlMatchesByDate('2026-02-30', mock([[]]).fetcher), /Invalid KHL date/);
  await assert.rejects(getKhlMatchesByDate('2026-10-04', mock([[]], { teams: [{ id: 16 }] }).fetcher), /data\.teams/);
  await assert.rejects(getKhlMatchesByDate('2026-10-04', mock([[event({ game_state_key: 'mystery' })], []]).fetcher), /Unknown KHL game state/);
  await assert.rejects(getKhlMatchesByDate('2026-10-04', mock([[event({
    team_a: { id: 2, khl_id: 16, name: 'ЦСКА' }
  })], []]).fetcher), /Unknown KHL team/);
  await assert.rejects(getKhlMatchesByDate('2026-10-04', mock([[event({
    team_a: { id: 16, khl_id: 999, name: 'ЦСКА' }
  })], []]).fetcher), /Conflicting KHL team ids/);
  await assert.rejects(getKhlMatchesByDate('2026-10-04', async url => {
    if (url.endsWith('/data.json')) return data;
    throw new Error('CORS unavailable');
  }), /CORS unavailable/);
});

test('page limit rejects truncated result; event lookup validates id and current stage', async () => {
  await assert.rejects(getKhlMatchesByDate('2026-10-04', mock(Array.from({ length: 10 }, () => [event()])).fetcher), /pagination limit/);
  const source = mock([[event(), event({ id: 12, match_id: '902101', stage_id: 370 })]]);
  const value = await getKhlEvent(78231, source.fetcher);
  assert.equal(value?.id, 'khl:902100');
  assert.equal(source.calls.at(-1).useCache, false);
  assert.equal(new URL(source.calls.at(-1).url).searchParams.get('q[id_eq]'), '78231');
  assert.equal(await getKhlEvent(12, source.fetcher), null);
});

test('a fixture supplies its real event id for exact q[id_eq], with match id verified', async () => {
  const id = '903001';
  const fixture = mock([[event({ id: 789001, match_id: id })], []]);
  await getKhlMatchesByDate('2026-10-04', fixture.fetcher);
  const calls = [];
  const lookup = async (url, cache) => {
    calls.push({ url, cache });
    if (url === `${BASE}/data.json`) return data;
    assert.equal(new URL(url).searchParams.get('q[id_eq]'), '789001');
    return [event({ id: 789001, match_id: id, score: '3:2' })];
  };
  const found = await getKhlMatch(id, lookup);
  assert.equal(found.id, `khl:${id}`);
  assert.equal(found.home.score, 3);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].cache, false);

  // The server may ignore a query: never return a different match.
  const mismatch = await getKhlMatch(id, async url => {
    if (url === `${BASE}/data.json`) return data;
    if (new URL(url).searchParams.has('q[id_eq]')) return [event({ id: 789001, match_id: '903002' })];
    return [];
  });
  assert.equal(mismatch, null);
});

test('cold direct link searches only current stage, exact match_id and accepted type', async () => {
  const calls = [];
  const fetcher = async url => {
    if (url === `${BASE}/data.json`) return data;
    const params = new URL(url).searchParams;
    calls.push(params);
    assert.equal(params.get('stage_id'), '407');
    assert.equal(params.has('q[match_id_eq]'), false, 'this filter is ignored by the upstream');
    if (params.get('page') === '1') return [event({ id: 1, match_id: '903999' }),
      event({ id: 2, match_id: '903003', stage_id: 370 }),
      event({ id: 3, match_id: '903003', type_id: 4 })];
    return [event({ id: 4, match_id: '903003', type_id: 18, score: '4:2' })];
  };
  const found = await getKhlMatch('903003', fetcher);
  assert.equal(found.source.eventId, 4);
  assert.equal(found.home.score, 4);
  assert.deepEqual(calls.map(query => query.get('page')), ['1', '2']);
  assert.equal(await getKhlMatch('903004', async url => url === `${BASE}/data.json` ? data : []), null);
  await assert.rejects(getKhlMatch('not-numeric', fetcher), /Invalid KHL match id/);
  let scans = 0;
  const missing = async url => {
    if (url === `${BASE}/data.json`) return data;
    scans++;
    return [event({ id: 7, match_id: '903999' })];
  };
  await assert.rejects(getKhlMatch('903005', missing), /pagination limit/);
  assert.equal(scans, 4, 'cold discovery has a small page budget');
  assert.equal(await getKhlMatch('903005', missing), null);
  assert.equal(scans, 4, 'a missing match must not rescan on each poll');
});

test('untrusted hint must match actual event id, match id, stage and accepted type', async () => {
  for (const wrong of [
    event({ id: 800012, match_id: '903099' }),
    event({ id: 800013, match_id: '903006' }),
    event({ id: 800012, match_id: '903006', stage_id: 370 }),
    event({ id: 800012, match_id: '903006', type_id: 4 })
  ]) {
    const calls = [];
    const fetcher = async url => {
      if (url === `${BASE}/data.json`) return data;
      const params = new URL(url).searchParams;
      calls.push(params);
      return params.has('q[id_eq]') ? [wrong] : [];
    };
    assert.equal(await getKhlMatch('903006', fetcher, '800012'), null);
    assert.equal(calls[0].get('q[id_eq]'), '800012');
  }
  assert.equal(await getKhlMatch('903007', async url => url === `${BASE}/data.json` ? data : [], 'not-a-number'), null);
});
