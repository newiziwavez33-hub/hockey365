/**
 * Hockey365 Global Configuration
 */

// Dynamically compute base path for GitHub Pages (e.g., /hockey365 or /)
function computeBasePath() {
  const path = window.location.pathname;
  // If deployed in a subdirectory like /hockey365/
  const match = path.match(/^(\/[^\/]+)/);
  if (match && match[1] && match[1] === '/hockey365') {
    return '/hockey365';
  }
  return '';
}

export const CONFIG = {
  SITE_NAME: 'Hockey365',
  VERSION: '1.2.1',
  BASE_PATH: computeBasePath(),
  POLL_INTERVAL_LIVE_MS: 30000, // 30s polling for live matches
  DEFAULT_TIMEZONE: 'Europe/Moscow',
  SUPPORTED_LEAGUES: ['KHL', 'NHL', 'VHL', 'MHL'],
  API_TIMEOUT_MS: 12000,
  CACHE_TTL_MS: 60000, // 1 min memory cache
};

export function getAssetUrl(relPath) {
  const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  const base = CONFIG.BASE_PATH ? CONFIG.BASE_PATH + '/' : '/';
  return base + cleanRel;
}

export function getDataUrl(relPath) {
  return getAssetUrl(`data/${relPath.startsWith('/') ? relPath.slice(1) : relPath}`);
}
