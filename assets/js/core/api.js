/**
 * Hockey365 API Client (Data Fetching & Live Polling)
 */

import { CONFIG, getDataUrl } from './config.js';

const memoryCache = new Map();

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

function unavailable(compId) {
  throw new Error(`${compId}: нет подтверждённого источника данных`);
}

export async function getCompetitions() {
  return fetchJSON(getDataUrl('competitions.json'));
}

export async function getMatchesByDate(dateStr) {
  const url = getDataUrl(`matches/by-date/${dateStr}.json`);
  const [matches, meta] = await Promise.all([fetchJSON(url, false), getMeta()]);
  return matches.filter(match => !meta.unverifiedCompetitions?.includes(match.compId));
}

export async function getMatch(matchId, useCache = true) {
  if (await isUnverified(matchId.split(':')[0].toUpperCase())) unavailable(matchId);
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
      const data = await getMatchesByDate(dateStr);
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
