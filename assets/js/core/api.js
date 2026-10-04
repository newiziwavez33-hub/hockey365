/**
 * Hockey365 API Client (Data Fetching & Live Polling)
 */

import { CONFIG, getAssetUrl, getDataUrl } from './config.js';

const memoryCache = new Map();
const NHL_WEB_API_BASE = 'https://api-web.nhle.com/v1';
let proxyProbe = null;

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
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (useCache) {
      memoryCache.set(url, { data, timestamp: Date.now() });
    }
    return data;
  } catch (error) {
    console.error(`Fetch failed for ${url}:`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
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
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}/${value.slice(6)}` : null;
}

function gameStatus(gameState, clock, scheduleState) {
  const raw = String(gameState || '').toUpperCase();
  if (['PPD', 'POSTPONED'].includes(raw) || String(scheduleState || '').toUpperCase() === 'PPD') {
    return 'POSTPONED';
  }
  if (['CAN', 'CNCL', 'CANCELLED'].includes(raw)) return 'CANCELLED';
  if (['FINAL', 'OFF'].includes(raw)) return 'FINISHED';
  if (['LIVE', 'CRIT'].includes(raw)) {
    return clock?.inIntermission === true ? 'INTERMISSION' : 'LIVE';
  }
  if (['FUT', 'PRE', 'TBD', 'SCHEDULED'].includes(raw)) return 'SCHEDULED';
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
      delivery: sourceUrls.some(url => url.includes('/gamecenter/')) ? 'live' : 'schedule',
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
  const proxy = await getNhlProxy();
  if (proxy) {
    const separator = proxy.includes('?') ? '&' : '?';
    try {
      return await fetchJSON(`${proxy}${separator}path=${encodeURIComponent(path.replace(/^\//, ''))}`, useCache);
    } catch {
      // A working bridge may have a transient outage. Keep direct official
      // access as the next choice, and the explicit snapshot as the last one.
    }
  }
  return fetchJSON(`${NHL_WEB_API_BASE}${path}`, useCache);
}

async function getNhlProxy() {
  if (!CONFIG.NHL_PROXY_URL) return null;
  if (!proxyProbe) {
    proxyProbe = (async () => {
      const proxy = getAssetUrl(CONFIG.NHL_PROXY_URL);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch(`${proxy}${proxy.includes('?') ? '&' : '?'}health=1`, {
          signal: controller.signal, cache: 'no-store'
        });
        if (!response.ok) return null;
        const health = await response.json();
        return health?.hockey365NhlProxy === true ? proxy : null;
      } catch {
        // No PHP on a static host is normal, not a match-data error.
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return proxyProbe;
}

function withFeed(matches, feed) {
  Object.defineProperty(matches, 'feed', { value: feed, configurable: true });
  return matches;
}

function snapshotMatch(match, meta) {
  return { ...match, source: {
    ...match.source, delivery: 'snapshot',
    fetchedAt: match.source?.fetchedAt || meta?.updatedAt || null
  } };
}

function mergeMatchUpdate(snapshot, authoritative) {
  return {
    ...snapshot,
    ...authoritative,
    // Keep schedule metadata which is not present in gamecenter while letting
    // the authoritative feed win for score, status, and event data.
    home: { ...snapshot.home, ...authoritative.home },
    away: { ...snapshot.away, ...authoritative.away }
  };
}

function isActiveNhlMatch(match) {
  const startedRecently = match?.status === 'SCHEDULED' &&
    Date.now() >= Date.parse(match.utcDate) && Date.now() - Date.parse(match.utcDate) < 12 * 3600_000;
  return match?.compId === 'NHL' &&
    (match.status === 'LIVE' || match.status === 'INTERMISSION' || startedRecently);
}

async function getNhlGamecenterMatch(matchNumber, useCache = true) {
  const boxscorePath = `/gamecenter/${matchNumber}/boxscore`;
  const playByPlayPath = `/gamecenter/${matchNumber}/play-by-play`;
  const [boxscore, playByPlay] = await Promise.allSettled([
    fetchNhlJSON(boxscorePath, useCache),
    fetchNhlJSON(playByPlayPath, useCache)
  ]);
  const boxscoreData = boxscore.status === 'fulfilled' && isRecord(boxscore.value) ? boxscore.value : null;
  const playByPlayData = playByPlay.status === 'fulfilled' && isRecord(playByPlay.value) ? playByPlay.value : null;
  const endpoints = [];
  if (boxscoreData) endpoints.push(`${NHL_WEB_API_BASE}${boxscorePath}`);
  if (playByPlayData) endpoints.push(`${NHL_WEB_API_BASE}${playByPlayPath}`);

  // Boxscore is authoritative for team/game state; play-by-play supplies the
  // event stream when both endpoints are available.
  for (const payload of [boxscoreData, playByPlayData]) {
    const normalized = normalizeNhlGame(payload, endpoints, `nhl:${matchNumber}`);
    if (!normalized) continue;

    if (playByPlayData && boxscoreData) {
      const playEvents = normalizeEvents(playByPlayData, playByPlayData.homeTeam, playByPlayData.awayTeam);
      if (playEvents.length) normalized.events = playEvents;
      // Some gamecenter responses publish team scores in play-by-play before
      // the boxscore catches up. Keep boxscore state authoritative, but use
      // those official PBP scores when the boxscore omits them.
      if (!hasNumber(normalized.home.score) && hasNumber(playByPlayData.homeTeam?.score)) {
        normalized.home.score = playByPlayData.homeTeam.score;
      }
      if (!hasNumber(normalized.away.score) && hasNumber(playByPlayData.awayTeam?.score)) {
        normalized.away.score = playByPlayData.awayTeam.score;
      }
    }
    if (typeof playByPlayData?.clock?.timeRemaining === 'string' && normalized.status === 'LIVE') {
      normalized.clock = playByPlayData.clock.timeRemaining;
    }
    normalized.source.endpoints = endpoints;
    return normalized;
  }
  return null;
}

async function refreshActiveNhlMatches(matches, useCache = false) {
  if (!Array.isArray(matches)) return [];

  return Promise.all(matches.map(async match => {
    if (!isActiveNhlMatch(match)) return match;
    const matchNumber = /^nhl:(\d+)$/i.exec(match.id || '')?.[1];
    if (!matchNumber) return match;

    try {
      const authoritative = await getNhlGamecenterMatch(matchNumber, useCache);
      return authoritative ? mergeMatchUpdate(match, authoritative)
        : { ...match, source: { ...match.source, delivery: 'schedule' } };
    } catch (error) {
      // Keep the official schedule visible when a gamecenter endpoint is
      // temporarily unavailable. The next poll can recover the live state.
      console.warn(`NHL gamecenter refresh failed for ${match.id}:`, error);
      return { ...match, source: { ...match.source, delivery: 'schedule' } };
    }
  }));
}

async function getStaticMatchesByDate(dateStr) {
  const url = getDataUrl(`matches/by-date/${dateStr}.json`);
  const [matches, meta] = await Promise.all([fetchJSON(url, false), getMeta()]);
  const verified = (Array.isArray(matches) ? matches : [])
    .filter(match => !meta.unverifiedCompetitions?.includes(match.compId))
    .map(match => snapshotMatch(match, meta));
  return withFeed(verified, { mode: 'snapshot', updatedAt: meta.updatedAt || null });
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
    if (!Array.isArray(data?.gameWeek)) throw new Error('Invalid NHL schedule response');
    const games = data.gameWeek
      .filter(day => day?.date === dateStr)
      .flatMap(day => Array.isArray(day.games) ? day.games : []);
    const scheduleMatches = games.map(game => normalizeNhlGame(game, [`${NHL_WEB_API_BASE}/schedule/${dateStr}`]))
      .filter(Boolean);
    // NHL schedule responses can contain only the fixture and a stale score.
    // Refresh active games from gamecenter before the list reaches the UI.
    const matches = await refreshActiveNhlMatches(scheduleMatches, useCache);
    return withFeed(matches, {
      // A date contains scheduled fixtures as well as active games. The
      // presence of at least one authoritative gamecenter response means the
      // live score is connected even though future fixtures still come from
      // the schedule endpoint.
      mode: matches.some(match => match.source?.delivery === 'live') ? 'live'
        : matches.some(match => match.source?.delivery === 'schedule') ? 'partial' : 'unknown',
      updatedAt: new Date().toISOString()
    });
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
    const gamecenterMatch = await getNhlGamecenterMatch(matchNumber, useCache);
    if (gamecenterMatch) return gamecenterMatch;
  }

  const [snapshot, meta] = await Promise.all([
    fetchJSON(getDataUrl(`matches/${matchId}.json`), useCache), getMeta()
  ]);
  return snapshotMatch(snapshot, meta);
}

export async function getTeam(teamId) {
  if (await isUnverified(teamId.split(':')[0].toUpperCase())) unavailable(teamId);
  return fetchJSON(getDataUrl(`teams/${teamId}.json`));
}

function normalizeNhlPlayer(payload, playerId) {
  if (!isRecord(payload) || !payload.playerId) return null;
  const first = payload.firstName?.default || '';
  const last = payload.lastName?.default || '';
  const teamAbbrev = String(payload.currentTeamAbbrev || '').toLowerCase();
  if (!first && !last) return null;

  const stats = [];
  for (const row of payload.seasonTotals || []) {
    const season = seasonLabel(row.season);
    if (!season || !row.leagueAbbrev) continue;
    const stat = {
      season,
      compId: row.leagueAbbrev === 'NHL' ? 'NHL' : String(row.leagueAbbrev),
      gp: row.gamesPlayed ?? 0
    };
    if (row.goals !== undefined) stat.g = row.goals;
    if (row.assists !== undefined) stat.a = row.assists;
    if (row.points !== undefined) stat.pts = row.points;
    if (row.plusMinus !== undefined) stat.plusMinus = row.plusMinus;
    if (row.pim !== undefined) stat.pim = row.pim;
    if (row.shots !== undefined) stat.shots = row.shots;
    if (row.timeOnIcePerGame) stat.toi = row.timeOnIcePerGame;
    if (row.wins !== undefined || row.goalsAgainstAverage !== undefined) {
      stat.gk = {
        w: row.wins,
        l: row.losses,
        otl: row.otLosses,
        gaa: row.goalsAgainstAverage,
        svPct: row.savePctg,
        so: row.shutouts
      };
    }
    stats.push(stat);
  }

  return {
    id: `nhl:p_${payload.playerId}`,
    name: `${first} ${last}`.trim(),
    nameEn: `${first} ${last}`.trim(),
    position: payload.position || null,
    shoots: payload.shootsCatches || null,
    birthDate: payload.birthDate || null,
    heightCm: payload.heightInCentimeters ?? null,
    weightKg: payload.weightInKilograms ?? null,
    nationality: payload.birthCountry || null,
    number: payload.sweaterNumber ?? null,
    teamId: teamAbbrev ? `nhl:${teamAbbrev}` : null,
    photo: payload.headshot || null,
    stats,
    career: [],
    source: {
      provider: 'NHL Web API',
      official: true,
      endpoint: `${NHL_WEB_API_BASE}/player/${payload.playerId}/landing`,
      fetchedAt: new Date().toISOString()
    }
  };
}

export async function getPlayer(playerId) {
  if (await isUnverified(playerId.split(':')[0].toUpperCase())) unavailable(playerId);
  const nhlPlayerId = /^nhl:p_(\d+)$/i.exec(playerId)?.[1];
  if (nhlPlayerId) {
    try {
      const official = normalizeNhlPlayer(
        await fetchNhlJSON(`/player/${nhlPlayerId}/landing`, false),
        playerId
      );
      if (official) return official;
    } catch (error) {
      console.warn(`Official NHL player request failed for ${playerId}; using published snapshot`, error);
    }
  }
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
  let liveStream = null;

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

  // When the Hono backend is deployed on the same origin, use its SSE stream
  // as a low-latency trigger. Its payload is schedule-shaped, so do not pass
  // it directly to the UI: the normal poll refreshes active NHL games from
  // authoritative gamecenter endpoints and keeps non-live matches in view.
  if (CONFIG.LIVE_SSE_URL && typeof EventSource !== 'undefined') {
    try {
      const streamUrl = getAssetUrl(CONFIG.LIVE_SSE_URL);
      const separator = streamUrl.includes('?') ? '&' : '?';
      liveStream = new EventSource(`${streamUrl}${separator}date=${encodeURIComponent(dateStr)}`);
      liveStream.addEventListener('match_update', event => {
        try {
          const payload = JSON.parse(event.data);
          if (!isCancelled && Array.isArray(payload.matches)) poll();
        } catch (error) {
          console.warn('Invalid live stream payload', error);
        }
      });
      liveStream.onerror = () => {
        liveStream?.close();
        liveStream = null;
      };
    } catch (error) {
      console.warn('Live stream unavailable; using official polling', error);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && !isCancelled) {
      poll();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  const cleanup = () => {
    isCancelled = true;
    clearInterval(timer);
    liveStream?.close();
    liveStream = null;
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
