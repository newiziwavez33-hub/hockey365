/**
 * Hockey365 API Client (Data Fetching & Live Polling)
 */

import { CONFIG, getDataUrl } from './config.js';

const memoryCache = new Map();
const NHL_WEB_API_BASE = 'https://api-web.nhle.com/v1';

export async function fetchJSON(url, useCache = true) {
  if (useCache && memoryCache.has(url)) {
    const cached = memoryCache.get(url);
    if (Date.now() - cached.timestamp < CONFIG.CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

  try {
    const fetchUrl = useCache ? url : `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      cache: useCache ? 'default' : 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (useCache) {
      memoryCache.set(url, { data, timestamp: Date.now() });
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Fetch failed for ${url}:`, error);
    throw error;
  }
}

export async function getMeta() {
  return fetchJSON(getDataUrl('meta.json'));
}

async function isUnverified(compId) {
  const meta = await getMeta();
  return meta.unverifiedCompetitions?.includes(compId) || false;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function officialTeamId(team) {
  const abbrev = team?.abbrev;
  return typeof abbrev === 'string' && abbrev.trim()
    ? `nhl:${abbrev.trim().toLowerCase()}`
    : null;
}

function officialPlayerId(playerId) {
  return playerId !== undefined && playerId !== null && String(playerId).trim()
    ? `nhl:p_${String(playerId).trim()}`
    : null;
}

function seasonLabel(season) {
  const value = String(season ?? '');
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}/${value.slice(4)}` : null;
}

function gameStatus(gameState, clock, scheduleState) {
  const raw = String(gameState || '').toUpperCase();
  if (['PPD', 'POSTPONED'].includes(raw) || String(scheduleState || '').toUpperCase() === 'PPD') {
    return 'POSTPONED';
  }
  if (['CAN', 'CANCELLED'].includes(raw)) return 'CANCELLED';
  if (['FINAL', 'OFF'].includes(raw)) return 'FINISHED';
  if (['LIVE', 'CRIT'].includes(raw)) {
    return clock?.inIntermission === true ? 'INTERMISSION' : 'LIVE';
  }
  if (['FUT', 'PRE', 'TBD'].includes(raw)) return 'SCHEDULED';
  return null;
}

function stageForGameType(gameType) {
  return { 1: 'preseason', 2: 'regular', 3: 'playoff' }[gameType] || null;
}

function finishedInFor(game, status) {
  if (status !== 'FINISHED') return null;
  const periodType = game?.gameOutcome?.lastPeriodType || game?.periodDescriptor?.periodType;
  return ['REG', 'OT', 'SO'].includes(periodType) ? periodType : null;
}

function normalizeTeam(team) {
  const id = officialTeamId(team);
  if (!id) return null;
  const normalized = { id };
  if (hasNumber(team.score)) normalized.score = team.score;
  if (hasNumber(team.sog)) normalized.shots = team.sog;
  return normalized;
}

function rosterNameMap(payload) {
  const names = new Map();
  for (const spot of payload?.rosterSpots || []) {
    const id = spot?.playerId;
    const first = spot?.firstName?.default;
    const last = spot?.lastName?.default;
    if (id !== undefined && (first || last)) {
      names.set(String(id), [first, last].filter(Boolean).join(' '));
    }
  }
  return names;
}

function eventTeam(ownerId, homeTeam, awayTeam) {
  if (ownerId === undefined || ownerId === null) return null;
  if (String(ownerId) === String(homeTeam?.id)) return 'home';
  if (String(ownerId) === String(awayTeam?.id)) return 'away';
  return null;
}

function normalizePlay(play, homeTeam, awayTeam, names) {
  if (!isRecord(play)) return null;
  const key = String(play.typeDescKey || '').toLowerCase();
  const periodType = play.periodDescriptor?.periodType;
  const type = key === 'goal'
    ? periodType === 'SO' ? 'SHOOTOUT' : 'GOAL'
    : key === 'penalty' ? 'PENALTY'
      : key === 'shootout-complete' || key === 'shootout-shot' ? 'SHOOTOUT'
        : key === 'goalie-change' ? 'GOALIE_CHANGE'
          : key === 'timeout' ? 'TIMEOUT' : null;
  if (!type) return null;

  const details = isRecord(play.details) ? play.details : {};
  const event = { type };
  if (hasNumber(play.periodDescriptor?.number)) event.period = play.periodDescriptor.number;
  if (typeof play.timeInPeriod === 'string') event.time = play.timeInPeriod;

  const team = eventTeam(details.eventOwnerTeamId, homeTeam, awayTeam);
  if (team) event.team = team;

  const playerValue = type === 'GOAL'
    ? details.scoringPlayerId
    : type === 'PENALTY'
      ? details.committedByPlayerId
      : details.shooterPlayerId ?? details.scoringPlayerId;
  const playerId = officialPlayerId(playerValue);
  if (playerId) {
    event.playerId = playerId;
    const name = names.get(String(playerValue));
    if (name) event.playerName = name;
  }

  if (type === 'GOAL') {
    const assists = [details.assist1PlayerId, details.assist2PlayerId]
      .map(officialPlayerId).filter(Boolean);
    if (assists.length) event.assists = assists;
    if (hasNumber(details.homeScore) && hasNumber(details.awayScore)) {
      event.score = `${details.homeScore}-${details.awayScore}`;
    }
  } else if (type === 'PENALTY') {
    if (hasNumber(details.duration)) event.minutes = details.duration;
    if (typeof details.descKey === 'string') event.reason = details.descKey;
  } else if (type === 'SHOOTOUT' && typeof play.typeDescKey === 'string') {
    event.result = play.typeDescKey;
  }

  if (hasNumber(play.sortOrder)) event.order = play.sortOrder;
  return event;
}

function normalizeEvents(payload, homeTeam, awayTeam) {
  if (!Array.isArray(payload?.plays)) return [];
  const names = rosterNameMap(payload);
  return payload.plays.map(play => normalizePlay(play, homeTeam, awayTeam, names)).filter(Boolean);
}

function normalizeGoalies(teamStats, names) {
  if (!Array.isArray(teamStats?.goalies)) return [];
  return teamStats.goalies.map(goalie => {
    const id = officialPlayerId(goalie?.playerId);
    if (!id) return null;
    const name = names.get(String(goalie.playerId)) || goalie?.name?.default;
    const result = { playerId: id };
    if (typeof name === 'string' && name) result.name = name;
    if (hasNumber(goalie?.sweaterNumber)) result.number = goalie.sweaterNumber;
    return result;
  }).filter(Boolean);
}

function normalizeNhlGame(payload, sourceUrls, fallbackId = null) {
  if (!isRecord(payload)) return null;
  const homeRaw = payload.homeTeam;
  const awayRaw = payload.awayTeam;
  const home = normalizeTeam(homeRaw);
  const away = normalizeTeam(awayRaw);
  if (!home || !away) return null;

  const status = gameStatus(payload.gameState, payload.clock, payload.gameScheduleState);
  const season = seasonLabel(payload.season);
  if (!status || !season || typeof payload.startTimeUTC !== 'string') return null;
  const normalized = {
    id: payload.id !== undefined && payload.id !== null ? `nhl:${payload.id}` : fallbackId,
    compId: 'NHL',
    season,
    utcDate: payload.startTimeUTC,
    status,
    home,
    away,
    source: {
      provider: 'NHL Web API',
      official: true,
      endpoints: sourceUrls,
      fetchedAt: new Date().toISOString()
    }
  };

  if (!normalized.id) return null;
  const stage = stageForGameType(payload.gameType);
  if (stage) normalized.stage = stage;
  if (status === 'LIVE' || status === 'INTERMISSION' || status === 'FINISHED') {
    if (hasNumber(payload.periodDescriptor?.number)) normalized.period = payload.periodDescriptor.number;
  }
  if (status === 'LIVE' && typeof payload.clock?.timeRemaining === 'string') {
    normalized.clock = payload.clock.timeRemaining;
  }
  if (status === 'FINISHED') normalized.finishedIn = finishedInFor(payload, status);
  if (typeof payload.venue?.default === 'string') normalized.arena = payload.venue.default;

  normalized.events = normalizeEvents(payload, homeRaw, awayRaw);

  const stats = {};
  if (hasNumber(homeRaw?.sog) && hasNumber(awayRaw?.sog)) stats.shots = [homeRaw.sog, awayRaw.sog];
  if (Object.keys(stats).length) normalized.stats = stats;

  const playerStats = payload.playerByGameStats;
  if (isRecord(playerStats)) {
    const names = rosterNameMap(payload);
    const homeGoalies = normalizeGoalies(playerStats.homeTeam, names);
    const awayGoalies = normalizeGoalies(playerStats.awayTeam, names);
    if (homeGoalies.length || awayGoalies.length) {
      normalized.lineups = {};
      if (homeGoalies.length) normalized.lineups.home = { goalies: homeGoalies };
      if (awayGoalies.length) normalized.lineups.away = { goalies: awayGoalies };
    }
  }

  if (typeof payload.gameCenterLink === 'string' && payload.gameCenterLink.startsWith('/gamecenter/')) {
    const gameCenterUrl = `https://www.nhl.com${payload.gameCenterLink}`;
    normalized.broadcast = {
      type: 'external',
      verified: true,
      provider: 'NHL.com',
      url: gameCenterUrl,
      sourceName: 'NHL.com Gamecenter',
      sourceUrl: gameCenterUrl,
      verifiedAt: new Date().toISOString()
    };
  }
  return normalized;
}

async function fetchNhlJSON(path, useCache = true) {
  return fetchJSON(`${NHL_WEB_API_BASE}${path}`, useCache);
}

async function getStaticMatchesByDate(dateStr) {
  const url = getDataUrl(`matches/by-date/${dateStr}.json`);
  const [matches, meta] = await Promise.all([fetchJSON(url, false), getMeta()]);
  return (Array.isArray(matches) ? matches : []).filter(match => !meta.unverifiedCompetitions?.includes(match.compId));
}

function unavailable(compId) {
  throw new Error(`${compId}: нет подтверждённого источника данных`);
}

export async function getCompetitions() {
  return fetchJSON(getDataUrl('competitions.json'));
}

export async function getMatchesByDate(dateStr, useCache = true) {
  try {
    const data = await fetchNhlJSON(`/schedule/${encodeURIComponent(dateStr)}`, useCache);
    const games = (data?.gameWeek || [])
      .filter(day => day?.date === dateStr)
      .flatMap(day => Array.isArray(day.games) ? day.games : []);
    return games.map(game => normalizeNhlGame(game, [`${NHL_WEB_API_BASE}/schedule/${dateStr}`]))
      .filter(Boolean);
  } catch (officialError) {
    // Browsers may reject the NHL API because of CORS or a transient outage.
    // The published snapshot remains the safe, verified fallback.
    try {
      return await getStaticMatchesByDate(dateStr);
    } catch (fallbackError) {
      fallbackError.cause = officialError;
      throw fallbackError;
    }
  }
}

export async function getMatch(matchId, useCache = true) {
  if (await isUnverified(matchId.split(':')[0].toUpperCase())) unavailable(matchId);

  const matchNumber = /^nhl:(\d+)$/i.exec(matchId)?.[1];
  if (matchNumber) {
    const boxscorePath = `/gamecenter/${matchNumber}/boxscore`;
    const playByPlayPath = `/gamecenter/${matchNumber}/play-by-play`;
    const [boxscore, playByPlay] = await Promise.allSettled([
      fetchNhlJSON(boxscorePath, useCache),
      fetchNhlJSON(playByPlayPath, useCache)
    ]);
    const boxscoreData = boxscore.status === 'fulfilled' && isRecord(boxscore.value) ? boxscore.value : null;
    const playByPlayData = playByPlay.status === 'fulfilled' && isRecord(playByPlay.value) ? playByPlay.value : null;
    const payload = boxscoreData || playByPlayData;
    if (payload) {
      const endpoints = [];
      if (boxscoreData) endpoints.push(`${NHL_WEB_API_BASE}${boxscorePath}`);
      if (playByPlayData) endpoints.push(`${NHL_WEB_API_BASE}${playByPlayPath}`);
      const normalized = normalizeNhlGame(payload, endpoints, `nhl:${matchNumber}`);
      if (normalized) {
        // Boxscore has the authoritative team/game state while play-by-play
        // contributes the event stream when both endpoints are available.
        if (playByPlayData && boxscoreData) {
          const playEvents = normalizeEvents(playByPlayData, playByPlayData.homeTeam, playByPlayData.awayTeam);
          if (playEvents.length) normalized.events = playEvents;
        }
        if (playByPlayData?.clock && normalized.status === 'LIVE') {
          normalized.clock = playByPlayData.clock.timeRemaining;
        }
        normalized.source.endpoints = endpoints;
        return normalized;
      }
    }
  }

  return fetchJSON(getDataUrl(`matches/${matchId}.json`), useCache);
}

export async function getTeam(teamId) {
  if (await isUnverified(teamId.split(':')[0].toUpperCase())) unavailable(teamId);
  return fetchJSON(getDataUrl(`teams/${teamId}.json`));
}

export async function getPlayer(playerId) {
  if (await isUnverified(playerId.split(':')[0].toUpperCase())) unavailable(playerId);
  return fetchJSON(getDataUrl(`players/${playerId}.json`));
}

export async function getStandings(compId, season = '2026/27') {
  if (await isUnverified(compId)) return { groups: [] };
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`standings/${compId}-${cleanSeason}.json`));
}

export async function getPlayoffs(compId, season = '2026/27') {
  if (await isUnverified(compId)) return { rounds: [] };
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`playoffs/${compId}-${cleanSeason}.json`));
}

export async function getLeaders(compId, season = '2026/27') {
  if (await isUnverified(compId)) return { categories: {} };
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`leaders/${compId}-${cleanSeason}.json`));
}

export async function getNews() {
  const data = await fetchJSON(getDataUrl('news/index.json'));
  return {
    ...data,
    news: (data.news || []).filter(item => /^https?:\/\//.test(item.url || ''))
  };
}

export async function getTransfers(season = '2026-2027') {
  const cleanSeason = season.replace('/', '-');
  const [data, meta] = await Promise.all([fetchJSON(getDataUrl(`transfers/${cleanSeason}.json`)), getMeta()]);
  return { ...data, transfers: (data.transfers || []).filter(item =>
    !meta.unverifiedCompetitions?.some(comp => [item.fromTeamId, item.toTeamId, item.playerId]
      .some(id => id?.toUpperCase().startsWith(`${comp}:`)))) };
}

export async function getSearchIndex() {
  const [items, meta, news] = await Promise.all([fetchJSON(getDataUrl('search-index.json')), getMeta(), getNews()]);
  const verifiedNews = new Set(news.news.map(item => item.id));
  return items.filter(item => !meta.unverifiedCompetitions?.some(comp =>
    item.id?.toUpperCase().startsWith(`${comp}:`) || item.id === comp) &&
    (item.type !== 'news' || verifiedNews.has(item.id)));
}

/**
 * Live polling helper for date-based matches with instant refresh capability
 */
export function startLivePolling(dateStr, callback, intervalMs = CONFIG.POLL_INTERVAL_LIVE_MS) {
  let isCancelled = false;
  let inFlight = false;
  let timer = null;

  async function poll() {
    if (isCancelled || inFlight) return;
    inFlight = true;
    try {
      const data = await getMatchesByDate(dateStr, false);
      if (!isCancelled) callback(null, data);
    } catch (err) {
      if (!isCancelled) callback(err, null);
    } finally {
      inFlight = false;
    }
  }

  poll();
  timer = setInterval(poll, intervalMs);

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && !isCancelled) {
      poll();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  const cleanup = () => {
    isCancelled = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
  cleanup.refresh = poll;
  return cleanup;
}

/**
 * Live polling helper for a single active match
 */
export function startMatchPolling(matchId, callback, intervalMs = CONFIG.POLL_INTERVAL_LIVE_MS) {
  let isCancelled = false;
  let inFlight = false;
  let timer = null;

  async function poll() {
    if (isCancelled || inFlight) return;
    inFlight = true;
    try {
      const data = await getMatch(matchId, false);
      if (!isCancelled) callback(null, data);
    } catch (err) {
      if (!isCancelled) callback(err, null);
    } finally {
      inFlight = false;
    }
  }

  poll();
  timer = setInterval(poll, intervalMs);

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && !isCancelled) {
      poll();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  const cleanup = () => {
    isCancelled = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
  cleanup.refresh = poll;
  return cleanup;
}
