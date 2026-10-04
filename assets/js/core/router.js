/**
 * Hockey365 Lightweight URL Parameter & Navigation Helper
 */

import { CONFIG } from './config.js';

export function getParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

export function setParam(name, value, replace = false) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === '') {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  if (replace) {
    window.history.replaceState({}, '', url.toString());
  } else {
    window.history.pushState({}, '', url.toString());
  }
}

export function navigateTo(path, params = {}) {
  const base = CONFIG.BASE_PATH || '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = new URL(window.location.origin + base + cleanPath);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) {
      targetUrl.searchParams.set(k, v);
    }
  }
  window.location.href = targetUrl.toString();
}

export function buildLink(path, params = {}) {
  const base = CONFIG.BASE_PATH || '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = new URL(window.location.origin + base + cleanPath);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) {
      targetUrl.searchParams.set(k, v);
    }
  }
  return targetUrl.pathname + targetUrl.search;
}

/** A mobile event id is a navigation hint, never proof of a match. */
export function buildMatchLink(match) {
  const id = match?.id;
  const source = match?.source;
  const matchNumber = /^khl:([1-9]\d*)$/.exec(id || '')?.[1];
  const event = source?.eventId;
  const validEvent = (typeof event === 'string' && /^[1-9]\d{0,11}$/.test(event)) ||
    (typeof event === 'number' && Number.isSafeInteger(event) && event > 0 && event <= 999999999999);
  const verified = match?.compId === 'KHL' && matchNumber &&
    source?.provider === 'KHL mobile backend' && source?.verified === true &&
    source?.verifiedMatches === true &&
    (source.matchId == null || String(source.matchId) === matchNumber);
  return buildLink('/match/', { id, ...(verified && validEvent ? { event: String(event) } : {}) });
}
