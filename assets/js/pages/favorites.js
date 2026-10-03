/**
 * Hockey365 Favorites & "My Feed" Page Logic
 */

import { qs, el, renderLoading, renderEmpty } from '../core/dom.js';
import { getMatchesByDate, getTeam, getMeta } from '../core/api.js';
import { store } from '../core/store.js';
import { createMatchRow } from '../components/match-row.js';
import { buildLink } from '../core/router.js';

let renderVersion = 0;

export async function initFavoritesPage() {
  const version = ++renderVersion;
  const container = qs('#favorites-slot');
  renderLoading(container, 3);

  const favTeams = store.state.favorites.teams || [];
  const favMatches = store.state.favorites.matches || [];

  if (favTeams.length === 0 && favMatches.length === 0) {
    renderEmpty(container, 'У вас пока нет избранных команд или матчей. Добавляйте команды со страниц клубов или матчи с помощью звёздочки ☆ на главной!');
    return;
  }

  container.innerHTML = '';

  // 1. Favorite Teams Section
  if (favTeams.length > 0) {
    const teamsSection = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h2', { className: 'card-title' }, 'Избранные команды')
      ),
      el('div', { className: 'card-body flex gap-8 flex-wrap' },
        favTeams.map(tid => el('div', { className: 'badge badge-scheduled flex items-center gap-6', style: { padding: '6px 12px' } },
          el('a', { href: buildLink('/team/', { id: tid }), className: 'link-accent' }, tid.replace(/^(khl|nhl):/, '').toUpperCase()),
          el('button', {
            type: 'button',
            'aria-label': `Удалить ${tid} из избранного`,
            style: { cursor: 'pointer', marginLeft: '4px' },
            onClick: () => {
              store.toggleFavorite('teams', tid);
              initFavoritesPage();
            }
          }, '×')
        ))
      )
    );
    container.appendChild(teamsSection);
  }

  // 2. Matches available in the published snapshot (not a live feed).
  try {
    const meta = await getMeta();
    const dates = meta.availableDates || [];
    const results = await Promise.allSettled(dates.map(date => getMatchesByDate(date)));
    if (version !== renderVersion) return;
    const matches = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value || []);
    const relevantMatches = [...new Map(matches.filter(m =>
      favTeams.includes(m.home.id) ||
      favTeams.includes(m.away.id) ||
      favMatches.includes(m.id)
    ).map(m => [m.id, m])).values()].sort((a, b) => a.utcDate.localeCompare(b.utcDate));

    const matchesSection = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h2', { className: 'card-title' }, 'Избранные матчи из сохранённых игровых дней')
      ),
      el('div', { className: 'card-body' },
        relevantMatches.length > 0 ? el('div', { className: 'comp-matches-list' },
          relevantMatches.map(m => createMatchRow(m))
        ) : el('div', { className: 'text-sm text-muted' }, 'В доступных игровых днях нет матчей избранных команд.')
      )
    );

    container.appendChild(matchesSection);
  } catch (e) {
    if (version === renderVersion) container.appendChild(el('p', { className: 'card text-muted' }, 'Не удалось загрузить сохранённые игровые дни.'));
  }
}
