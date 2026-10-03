import { getSearchIndex } from './api.js';
import { el } from './dom.js';
import { buildLink } from './router.js';

export async function availablePlayerIds() {
  try {
    const index = await getSearchIndex();
    return new Set(index.filter(item => item.type === 'player').map(item => item.id));
  } catch {
    return new Set();
  }
}

export function playerName(playerId, name, available) {
  return playerId && available.has(playerId)
    ? el('a', { href: buildLink('/player/', { id: playerId }), className: 'link-accent' }, name || playerId)
    : el('span', {}, name || playerId || 'Игрок не указан');
}
