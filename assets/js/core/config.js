/**
 * Hockey365 Global Configuration
 */

// Resolve the deployed site directory from this module URL. This works at
// the domain root and from arbitrary static subdirectories.
function computeBasePath() {
  if (typeof window === 'undefined') return '';
  try {
    const moduleUrl = new URL(import.meta.url);
    if (moduleUrl.origin === window.location.origin) {
      const marker = '/assets/js/';
      const markerIndex = moduleUrl.pathname.indexOf(marker);
      if (markerIndex >= 0) return moduleUrl.pathname.slice(0, markerIndex);
    }
  } catch {
    // Use root deployment as the safe fallback.
  }
  return '';
}

export const CONFIG = {
  SITE_NAME: 'Hockey365',
  VERSION: '1.8.0',
  BASE_PATH: computeBasePath(),
  POLL_INTERVAL_LIVE_MS: 10000, // 10s fast polling for real-time live matches
  POLL_INTERVAL_IDLE_MS: 25000, // 25s polling for non-live schedules
  DEFAULT_TIMEZONE: 'Europe/Moscow',
  SUPPORTED_LEAGUES: ['KHL', 'NHL', 'VHL', 'MHL'],
  API_TIMEOUT_MS: 12000,
  CACHE_TTL_MS: 60000, // 1 min memory cache
};

export function getAssetUrl(relPath) {
  if (!relPath) return '';
  if (relPath.startsWith('http://') || relPath.startsWith('https://') || relPath.startsWith('data:')) {
    return relPath;
  }
  const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  const base = CONFIG.BASE_PATH ? CONFIG.BASE_PATH + '/' : '/';
  return base + cleanRel;
}

export function getDataUrl(relPath) {
  return getAssetUrl(`data/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`);
}
