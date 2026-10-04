import { getPlayer, getSearchIndex } from './api.js';
import { el } from './dom.js';
import { buildLink } from './router.js';

const PLAYER_LOOKUP_LIMIT = 64;
const PLAYER_LOOKUP_CONCURRENCY = 4;
const PLAYER_PENDING_LIMIT = 32;
const playerLookupCache = new Map();
const playerLookupInFlight = new Map();
const playerLookupQueue = [];
let activePlayerLookups = 0;

export function isNumericNhlPlayerId(playerId) {
  return typeof playerId === 'string' && /^nhl:p_\d+$/i.test(playerId.trim());
}

function cleanName(name) {
  if (typeof name !== 'string') return '';
  const value = name.trim();
  // Published feeds sometimes put an entity key in the name field. Never
  // display any league-scoped key (NHL:p_123, KHL:p_..., etc.) as a name.
  if (!value || /^(?:[a-z][a-z\d_-]*:[^\s]+|p_[^\s]+)$/i.test(value)) return '';
  return value;
}

export function displayPlayerName(playerId, name, fallback = 'Игрок') {
  return cleanName(name) || (fallback === 'Автор передачи' ? fallback : 'Игрок');
}

function officialHeadshot(profile) {
  const photo = typeof profile?.photo === 'string' ? profile.photo.trim() : '';
  const source = profile?.source;
  // A player id is never enough to construct a portrait URL. Only accept the
  // URL returned by the official NHL landing payload and its official host.
  if (source?.official !== true || !/^NHL Web API$/i.test(String(source.provider || '')) ||
      !/^https:\/\/assets\.nhle\.com\//i.test(photo)) return null;
  try {
    const url = new URL(photo);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'assets.nhle.com'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function normalizeLookupResult(playerId, profile) {
  if (!profile || profile.id !== playerId) return null;
  return {
    name: cleanName(profile.name) || cleanName(profile.nameEn),
    photo: officialHeadshot(profile)
  };
}

function cacheLookup(playerId, value) {
  playerLookupCache.set(playerId, value);
  return value;
}

function drainPlayerLookups() {
  while (activePlayerLookups < PLAYER_LOOKUP_CONCURRENCY && playerLookupQueue.length) {
    const { id, resolve } = playerLookupQueue.shift();
    activePlayerLookups++;
    // Always settle and cache failures; getPlayer may fail at the official
    // endpoint and again at its snapshot fallback.
    (async () => {
      try {
        return cacheLookup(id, normalizeLookupResult(id, await getPlayer(id)));
      } catch {
        return cacheLookup(id, null);
      }
    })().then(result => {
      activePlayerLookups--;
      playerLookupInFlight.delete(id);
      resolve(result);
      drainPlayerLookups();
    });
  }
}

/**
 * Resolve an event player using the official player endpoint. Results,
 * including failures, are bounded and in-flight requests are shared. No more
 * than four network lookups run at once; a bounded queue and a per-page budget
 * keep live polling from amplifying requests for huge event lists.
 */
export function lookupEventPlayer(playerId) {
  if (!isNumericNhlPlayerId(playerId)) return Promise.resolve(null);
  const id = playerId.trim().toLowerCase();
  if (playerLookupCache.has(id)) return Promise.resolve(playerLookupCache.get(id));
  if (playerLookupInFlight.has(id)) return playerLookupInFlight.get(id);
  if (playerLookupInFlight.size >= PLAYER_PENDING_LIMIT ||
      playerLookupCache.size + playerLookupInFlight.size >= PLAYER_LOOKUP_LIMIT) {
    return Promise.resolve(null);
  }

  let resolveRequest;
  const request = new Promise(resolve => { resolveRequest = resolve; });
  playerLookupInFlight.set(id, request);
  playerLookupQueue.push({ id, resolve: resolveRequest });
  drainPlayerLookups();
  return request;
}

// Kept small and explicit for focused component tests without exposing the
// cache implementation to application code.
export function clearEventPlayerLookupCache() {
  // Never discard a queued resolver while tests reset scenarios.
  if (activePlayerLookups || playerLookupInFlight.size || playerLookupQueue.length) {
    throw new Error('Wait for pending event player lookups before clearing the cache');
  }
  playerLookupCache.clear();
}

export function playerIdentity(playerId, name, available, fallback = 'Игрок') {
  const label = el('span', { className: 'player-name-label' }, displayPlayerName(playerId, name, fallback));
  const dossierId = isNumericNhlPlayerId(playerId) ? playerId.trim().toLowerCase() : playerId;
  const hasProfile = available instanceof Set && (available.has(playerId) || available.has(dossierId));
  const href = isNumericNhlPlayerId(playerId) || hasProfile
    ? buildLink('/player/', { id: dossierId })
    : null;
  return href
    ? el('a', { href, className: 'link-accent' }, label)
    : label;
}

export async function availablePlayerIds() {
  try {
    const index = await getSearchIndex();
    return new Set(index.filter(item => item.type === 'player').map(item => item.id));
  } catch {
    return new Set();
  }
}

export function playerName(playerId, name, available) {
  return playerIdentity(playerId, name, available);
}
