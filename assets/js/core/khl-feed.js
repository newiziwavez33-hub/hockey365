/** Direct KHL mobile schedule/score feed. No media URLs or raw responses leave this module. */
const BASE = 'https://khl.api.webcaster.pro/api/khl_mobile';
const DATA_URL = `${BASE}/data.json`;
const EVENTS_URL = `${BASE}/events_v2.json`;
const MAX_PAGES = 10;
// No guessed event ids and no season-long scan on every poll of a dead link.
const MAX_LOOKUP_PAGES = 4;
const eventIds = new Map();
const scannedMatchIds = new Set();
let indexedStageId = null;

export function getKhlKnownEventId(matchId) {
  return eventIds.get(`khl:${matchId}`) || null;
}

const SLUGS = {
  'Авангард': 'avangard', 'Автомобилист': 'avtomobilist', 'Адмирал': 'admiral',
  'Ак Барс': 'ak-bars', 'Амур': 'amur', 'Барыс': 'barys',
  'Динамо М': 'dynamo-msk', 'Динамо Мн': 'dynamo-mns', 'Драконы': 'dragons',
  'Лада': 'lada', 'Локомотив': 'lokomotiv', 'Металлург Мг': 'metallurg-mg',
  'Нефтехимик': 'neftekhimik', 'Салават Юлаев': 'salavat-yulaev',
  'Северсталь': 'severstal', 'Сибирь': 'sibir', 'СКА': 'ska',
  'Спартак': 'spartak', 'Торпедо': 'torpedo', 'Трактор': 'traktor',
  'ХК Сочи': 'sochi', 'ЦСКА': 'cska', 'Витязь': 'vityaz', 'Куньлунь РС': 'kunlun'
};

const STATES = {
  not_yet_started: 'SCHEDULED', live: 'LIVE', in_progress: 'LIVE', playing: 'LIVE',
  started: 'LIVE', intermission: 'INTERMISSION', finished: 'FINISHED',
  postponed: 'POSTPONED', cancelled: 'CANCELLED', canceled: 'CANCELLED'
};

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveId = value => /^\d+$/.test(String(value)) && Number(value) > 0;

function integer(value, label) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  throw new Error(`Invalid KHL ${label}`);
}

function score(value, label = 'score') {
  if (typeof value !== 'string' || !/^\d+:\d+$/.test(value)) throw new Error(`Invalid KHL ${label}`);
  return value.split(':').map(Number);
}

function timestamp(value) {
  const ms = integer(value, 'start_at');
  const date = new Date(ms > 1e11 ? ms : ms * 1000);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 2008) throw new Error('Invalid KHL start_at');
  return date;
}

function stageAndTeams(data) {
  if (!record(data) || !positiveId(data.current_stage_id) || !Array.isArray(data.teams)) {
    throw new Error('Invalid KHL data.json');
  }
  const stageId = integer(data.current_stage_id, 'current_stage_id');
  if (indexedStageId !== stageId) {
    eventIds.clear();
    scannedMatchIds.clear();
    indexedStageId = stageId;
  }
  const stage = data.stages_v2?.find(item => record(item) && Number(item.id) === stageId);
  if (stage && (!/^\d{4}\/\d{4}$/.test(stage.season) ||
      !['regular', 'playoff', 'preseason'].includes(stage.type))) {
    throw new Error('Invalid KHL current stage');
  }
  const teams = new Map();
  for (const team of data.teams) {
    if (!record(team) || !positiveId(team.id) || typeof team.name !== 'string' || !team.name.trim()) {
      throw new Error('Invalid KHL data.teams');
    }
    const id = String(team.id);
    if (teams.has(id) && teams.get(id).name !== team.name) throw new Error('Conflicting KHL data.teams');
    teams.set(id, team);
  }
  if (!teams.size) throw new Error('Empty KHL data.teams');
  return { stageId, stage, teams };
}

function safeLogo(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://thumbs.webcaster.pro' &&
      !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function team(raw, teams) {
  if (!record(raw) || !positiveId(raw.id)) throw new Error('Invalid KHL event team');
  const official = teams.get(String(raw.id)); // Mobile id, NEVER khl_id.
  const name = official?.name?.trim();
  const slug = Object.hasOwn(SLUGS, name) ? SLUGS[name] : null;
  if (!slug) throw new Error('Unknown KHL team');
  if (raw.khl_id !== undefined && official.khl_id !== undefined &&
      String(raw.khl_id) !== String(official.khl_id)) throw new Error('Conflicting KHL team ids');
  return { id: `khl:${slug}`, name, short: name.slice(0, 3).toUpperCase(),
    logo: safeLogo(raw.image) || safeLogo(official.image), score: null, periods: [], shots: null };
}

function periodScores(raw, status) {
  if (raw == null) return [[], [], null];
  if (!record(raw)) throw new Error('Invalid KHL scores');
  const home = [], away = [];
  for (const key of ['first_period', 'second_period', 'third_period', 'overtime']) {
    if (raw[key] == null) continue;
    const pair = score(raw[key], key);
    home.push(pair[0]); away.push(pair[1]);
  }
  const shootout = raw.bullitt != null;
  if (shootout) score(raw.bullitt, 'bullitt'); // Attempts are not official goals.
  if (status === 'FINISHED' && shootout) return [[], [], 'SO'];
  return [home, away, status === 'FINISHED' ? raw.overtime != null ? 'OT' : 'REG' : null];
}

function normalize(raw, context) {
  if (!record(raw) || ![18, 24].includes(Number(raw.type_id)) ||
      Number(raw.stage_id) !== context.stageId) return null;
  if (!positiveId(raw.match_id) || !positiveId(raw.id)) throw new Error('Invalid KHL match id');
  const status = Object.hasOwn(STATES, raw.game_state_key) ? STATES[raw.game_state_key] : null;
  if (!status) throw new Error('Unknown KHL game state');
  const start = timestamp(raw.start_at);
  const home = team(raw.team_a, context.teams);
  const away = team(raw.team_b, context.teams);
  if (home.id === away.id) throw new Error('Duplicate KHL match team');
  const [homePeriods, awayPeriods, finishedIn] = periodScores(raw.scores, status);
  const pair = raw.score == null && status === 'SCHEDULED' ? null : score(raw.score);
  if (status === 'LIVE' || status === 'INTERMISSION' || status === 'FINISHED') {
    if (!pair) throw new Error('Missing KHL match score');
    [home.score, away.score] = pair;
  }
  home.periods = finishedIn === 'SO' ? [] : homePeriods;
  away.periods = finishedIn === 'SO' ? [] : awayPeriods;
  const number = Number(raw.period);
  const period = Number.isInteger(number) && number >= 1 ? number : null;
  const seasonValue = context.stage?.season || /\d{4}\/\d{4}/.exec(raw.stage_name || '')?.[0];
  if (!seasonValue) throw new Error('Missing KHL season');
  const season = `${seasonValue.slice(0, 4)}/${seasonValue.slice(-2)}`;
  const stage = context.stage?.type || (/плей|playoff/i.test(raw.stage_name || '') ? 'playoff' : 'regular');
  return {
    id: `khl:${raw.match_id}`, compId: 'KHL', season, stage,
    utcDate: start.toISOString(), status, period, clock: null, finishedIn,
    home, away, events: [], lineups: null, stats: null,
    source: { provider: 'KHL mobile backend', official: true, verified: true,
      verifiedMatches: true, licenseConfirmed: false, delivery: 'live',
      endpoint: EVENTS_URL, stageId: context.stageId, eventId: raw.id,
      matchId: String(raw.match_id), fetchedAt: new Date().toISOString() }
  };
}

/** Minimal official team identity; no legacy rosters, coaches or statistics. */
export async function getKhlTeam(teamId, fetcher) {
  const context = stageAndTeams(await fetcher(DATA_URL, true));
  const raw = [...context.teams.values()].find(item => `khl:${SLUGS[item.name]}` === teamId);
  if (!raw) throw new Error('Unknown KHL team');
  const rows = await fetcher(`${BASE}/teams_v2.json?stage_id=${context.stageId}`, true);
  if (!Array.isArray(rows)) throw new Error('Invalid KHL teams');
  const detail = rows.map(row => row?.team).find(item => String(item?.id) === String(raw.id));
  if (!detail || detail.name !== raw.name) throw new Error('Conflicting KHL team');
  return {
    id: teamId, slug: teamId.split(':')[1], name: raw.name,
    short: raw.name.slice(0, 3).toUpperCase(), city: detail.location || '',
    conference: detail.conference || null, division: detail.division || null,
    logo: safeLogo(detail.image) || safeLogo(raw.image), competitions: ['KHL'], roster: [],
    source: { provider: 'KHL mobile backend', official: true, verifiedTeam: true,
      licenseConfirmed: false, fetchedAt: new Date().toISOString() }
  };
}

function events(payload) {
  if (!Array.isArray(payload)) throw new Error('Invalid KHL events_v2.json');
  return payload.map(item => {
    if (!record(item) || !record(item.event)) throw new Error('Invalid KHL event wrapper');
    return item.event;
  });
}

/** Fetch a UTC calendar date; a valid empty schedule returns []. */
export async function getKhlMatchesByDate(dateStr, fetcher) {
  const day = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? Date.parse(`${dateStr}T00:00:00Z`) : NaN;
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== dateStr) {
    throw new Error('Invalid KHL date');
  }
  if (typeof fetcher !== 'function') throw new TypeError('KHL fetcher(url, useCache) required');
  const context = stageAndTeams(await fetcher(DATA_URL, true));
  const from = day / 1000;
  const query = new URLSearchParams({ stage_id: String(context.stageId),
    'q[start_at_gt_time_from_unixtime]': String(from - 1),
    'q[start_at_lt_time_from_unixtime]': String(from + 86400),
    order_direction: 'asc' });
  const matches = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    query.set('page', String(page));
    const rows = events(await fetcher(`${EVENTS_URL}?${query}`, false));
    if (!rows.length) return [...matches.values()].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    for (const raw of rows) {
      const match = normalize(raw, context);
      if (!match || match.utcDate.slice(0, 10) !== dateStr) continue;
      const previous = matches.get(match.id);
      if (!previous || (previous.source.eventId !== match.source.eventId && Number(raw.type_id) === 18)) {
        matches.set(match.id, match);
        eventIds.set(match.id, match.source.eventId);
      }
    }
  }
  throw new Error('KHL pagination limit reached');
}

/** Fetch a single mobile event id (not a guessed match id or video URL). */
export async function getKhlEvent(eventId, fetcher) {
  if (!positiveId(eventId)) throw new Error('Invalid KHL event id');
  if (typeof fetcher !== 'function') throw new TypeError('KHL fetcher(url, useCache) required');
  const context = stageAndTeams(await fetcher(DATA_URL, true));
  const query = new URLSearchParams({ stage_id: String(context.stageId), 'q[id_eq]': String(eventId) });
  const rows = events(await fetcher(`${EVENTS_URL}?${query}`, false));
  const raw = rows.find(item => String(item.id) === String(eventId));
  return raw ? normalize(raw, context) : null;
}

/** Match ids and mobile event ids are different. Verify both, even if a filter is ignored. */
export async function getKhlMatch(matchId, fetcher, eventHint = null) {
  if (!positiveId(matchId) || !Number.isSafeInteger(Number(matchId))) throw new Error('Invalid KHL match id');
  if (typeof fetcher !== 'function') throw new TypeError('KHL fetcher(url, useCache) required');
  const id = `khl:${matchId}`;
  const context = stageAndTeams(await fetcher(DATA_URL, true));
  const validHint = (typeof eventHint === 'string' && /^[1-9]\d{0,11}$/.test(eventHint)) ||
    (typeof eventHint === 'number' && Number.isSafeInteger(eventHint) && eventHint > 0 && eventHint <= 999999999999);
  const knownEventId = eventIds.get(id) || (validHint ? eventHint : null);
  if (knownEventId) {
    // q[id_eq] is a working server-side exact event filter; q[match_id_eq]
    // is silently ignored by this endpoint. Never equate these two ids.
    const query = new URLSearchParams({ stage_id: String(context.stageId), 'q[id_eq]': String(knownEventId) });
    const rows = events(await fetcher(`${EVENTS_URL}?${query}`, false));
    const raw = rows.find(item => String(item.id) === String(knownEventId));
    if (raw) {
      const match = normalize(raw, context);
      if (match?.id === id) {
        eventIds.set(id, match.source.eventId);
        return match;
      }
    }
    eventIds.delete(id);
  }

  // Fresh deep links without a usable event id get one short discovery attempt
  // per stage. A failed/incomplete scan is never retried by every live poll.
  if (scannedMatchIds.has(id)) return null;
  scannedMatchIds.add(id);
  const query = new URLSearchParams({ stage_id: String(context.stageId), order_direction: 'asc' });
  for (let page = 1; page <= MAX_LOOKUP_PAGES; page++) {
    query.set('page', String(page));
    const rows = events(await fetcher(`${EVENTS_URL}?${query}`, false));
    if (!rows.length) return null;
    for (const raw of rows) {
      if (String(raw.match_id) !== String(matchId)) continue;
      const match = normalize(raw, context);
      if (match?.id === id) {
        eventIds.set(id, match.source.eventId);
        return match;
      }
    }
  }
  throw new Error('KHL match lookup pagination limit reached');
}
