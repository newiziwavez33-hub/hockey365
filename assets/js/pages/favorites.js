/**
 * Hockey365 Favorites & "My Feed" Page Logic
 */

import { qs, el, renderLoading, renderEmpty } from '../core/dom.js';
import { getMatchesByDate, getTeam } from '../core/api.js';
import { store } from '../core/store.js';
import { createMatchRow } from '../components/match-row.js';
import { getTodayISODate } from '../core/format.js';
import { buildLink } from '../core/router.js';

export async function initFavoritesPage() {
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
          el('a', { href: buildLink('/team/', { id: tid }), className: 'link-accent' }, tid.toUpperCase()),
          el('button', {
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

  // 2. "My Feed" - Matches involving favorite teams today
  try {
    const today = getTodayISODate();
    const matches = await getMatchesByDate(today);

    const relevantMatches = (matches || []).filter(m =>
      favTeams.includes(m.home.id) ||
      favTeams.includes(m.away.id) ||
      favMatches.includes(m.id)
    );

    const matchesSection = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h2', { className: 'card-title' }, 'Моя лента (Матчи дня избранных команд)')
      ),
      el('div', { className: 'card-body' },
        relevantMatches.length > 0 ? el('div', { className: 'comp-matches-list' },
          relevantMatches.map(m => createMatchRow(m))
        ) : el('div', { className: 'text-sm text-muted' }, 'Сегодня у ваших избранных команд нет матчей.')
      )
    );

    container.appendChild(matchesSection);
  } catch (e) {
    console.error(e);
  }
}
