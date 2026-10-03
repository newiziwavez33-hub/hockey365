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
    const response = await fetch(url, {
      signal: controller.signal,
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

export async function getCompetitions() {
  return fetchJSON(getDataUrl('competitions.json'));
}

export async function getMatchesByDate(dateStr) {
  const url = getDataUrl(`matches/by-date/${dateStr}.json`);
  return fetchJSON(url, false); // Don't cache live date queries too long
}

export async function getMatch(matchId) {
  return fetchJSON(getDataUrl(`matches/${matchId}.json`));
}

export async function getTeam(teamId) {
  return fetchJSON(getDataUrl(`teams/${teamId}.json`));
}

export async function getPlayer(playerId) {
  return fetchJSON(getDataUrl(`players/${playerId}.json`));
}

export async function getStandings(compId, season = '2026/27') {
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`standings/${compId}-${cleanSeason}.json`));
}

export async function getPlayoffs(compId, season = '2026/27') {
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`playoffs/${compId}-${cleanSeason}.json`));
}

export async function getLeaders(compId, season = '2026/27') {
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`leaders/${compId}-${cleanSeason}.json`));
}

export async function getNews() {
  return fetchJSON(getDataUrl('news/index.json'));
}

export async function getTransfers(season = '2026-2027') {
  const cleanSeason = season.replace('/', '-');
  return fetchJSON(getDataUrl(`transfers/${cleanSeason}.json`));
}

export async function getSearchIndex() {
  return fetchJSON(getDataUrl('search-index.json'));
}

/**
 * Live polling helper: runs callback immediately, then every intervalMs
 */
export function startLivePolling(dateStr, callback, intervalMs = CONFIG.POLL_INTERVAL_LIVE_MS) {
  let isCancelled = false;

  async function poll() {
    if (isCancelled) return;
    try {
      const data = await getMatchesByDate(dateStr);
      callback(null, data);
    } catch (err) {
      callback(err, null);
    }
  }

  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    isCancelled = true;
    clearInterval(timer);
  };
}
