/**
 * Hockey365 Team Profile Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getTeam, getMatchesByDate, getPlayer } from '../core/api.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { createTabs } from '../components/tabs.js';
import { createMatchRow } from '../components/match-row.js';
import { getAssetUrl } from '../core/config.js';
import { getTodayISODate } from '../core/format.js';

export async function initTeamPage() {
  const teamId = getParam('id') || 'khl:ska';
  let activeTab = getParam('tab') || 'matches';

  const headerSlot = qs('#team-header-slot');
  const tabsSlot = qs('#team-tabs-slot');
  const contentSlot = qs('#team-content-slot');

  renderLoading(headerSlot, 2);
  renderLoading(contentSlot, 4);

  let team = null;
  try {
    team = await getTeam(teamId);
  } catch (err) {
    renderError(contentSlot, 'Команда не найдена');
    return;
  }

  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');
  const isFav = store.isFavorite('teams', team.id);

  // Render Team Header
  headerSlot.innerHTML = '';
  const headerCard = el('div', { className: 'card' },
    el('div', { className: 'card-body flex items-center justify-between flex-wrap gap-16' },
      el('div', { className: 'flex items-center gap-16' },
        el('img', {
          src: team.logo ? getAssetUrl(team.logo) : defaultLogo,
          alt: team.name,
          style: { width: '72px', height: '72px', objectFit: 'contain' },
          onerror: (e) => { e.target.src = defaultLogo; }
        }),
        el('div', {},
          el('h1', { className: 'text-2xl text-bold' }, team.name),
          el('div', { className: 'text-sm text-muted' },
            `${team.city} • ${team.conference || ''} (${team.division || ''})`
          ),
          team.arena ? el('div', { className: 'text-xs text-secondary', style: { marginTop: '4px' } },
            `Арена: ${team.arena.name} (${team.arena.capacity || '12 000'} мест)`
          ) : null
        )
      ),

      // Favorite toggle button
      el('button', {
        className: `btn-primary ${isFav ? 'active' : ''}`,
        onClick: (e) => {
          const active = store.toggleFavorite('teams', team.id);
          e.currentTarget.textContent = active ? '★ В избранном' : '☆ В избранное';
        }
      }, isFav ? '★ В избранном' : '☆ В избранное')
    )
  );
  headerSlot.appendChild(headerCard);

  // Navigation Tabs
  const tabsConfig = [
    { id: 'matches', label: 'Матчи команды' },
    { id: 'roster', label: 'Состав клуба' },
    { id: 'about', label: 'Информация о клубе' }
  ];

  function renderTabNav() {
    tabsSlot.innerHTML = '';
    tabsSlot.appendChild(createTabs(tabsConfig, activeTab, (newTab) => {
      activeTab = newTab;
      setParam('tab', activeTab, true);
      renderTabNav();
      renderTabBody();
    }));
  }

  renderTabNav();

  async function renderTabBody() {
    contentSlot.innerHTML = '';

    if (activeTab === 'matches') {
      renderLoading(contentSlot, 3);
      try {
        const todayMatches = await getMatchesByDate(getTodayISODate());
        const teamMatches = (todayMatches || []).filter(m => m.home.id === teamId || m.away.id === teamId);
        contentSlot.innerHTML = '';
        if (teamMatches.length === 0) {
          renderEmpty(contentSlot, 'Сегодня матчей команды нет.');
        } else {
          const card = el('div', { className: 'card' },
            el('div', { className: 'card-header' },
              el('h3', { className: 'card-title' }, 'Ближайшие / текущие матчи')
            ),
            el('div', {}, teamMatches.map(m => createMatchRow(m)))
          );
          contentSlot.appendChild(card);
        }
      } catch (e) {
        renderEmpty(contentSlot, 'Матчи пока не загружены.');
      }
    } else if (activeTab === 'roster') {
      renderRoster(contentSlot, team);
    } else if (activeTab === 'about') {
      renderAbout(contentSlot, team);
    }
  }

  renderTabBody();
}

function renderRoster(container, team) {
  // Show roster cards
  const card = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, `Состав команды (${team.name})`)
    ),
    el('div', { className: 'card-body' },
      el('div', { className: 'layout-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
        // Sample core players for top clubs
        [
          { name: 'Александр Никишин', pos: 'D', num: 57, id: 'khl:p_nikishin' },
          { name: 'Никита Гусев', pos: 'LW', num: 97, id: 'khl:p_gusev' },
          { name: 'Николай Голдобин', pos: 'RW', num: 87, id: 'khl:p_goldobin' },
          { name: 'Александр Радулов', pos: 'RW', num: 47, id: 'khl:p_radulov' },
          { name: 'Даниил Исаев', pos: 'G', num: 92, id: 'khl:p_isaev' }
        ].map(p => el('div', { className: 'card', style: { margin: 0, padding: '12px' } },
          el('div', { className: 'flex items-center justify-between' },
            el('div', {},
              el('a', { href: buildLink('/player/', { id: p.id }), className: 'text-bold link-accent' }, p.name),
              el('div', { className: 'text-xs text-muted' }, `Амплуа: ${p.pos}`)
            ),
            el('span', { className: 'badge badge-scheduled' }, `#${p.num}`)
          )
        ))
      )
    )
  );
  container.appendChild(card);
}

function renderAbout(container, team) {
  const card = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, `О клубе ${team.name}`)
    ),
    el('div', { className: 'card-body flex-col gap-12 text-sm' },
      el('div', {}, el('strong', {}, 'Полное название: '), team.nameEn || team.name),
      el('div', {}, el('strong', {}, 'Город: '), team.city),
      el('div', {}, el('strong', {}, 'Год основания: '), team.founded || '-'),
      el('div', {}, el('strong', {}, 'Главный тренер: '), team.coach || 'Не указан'),
      el('div', {}, el('strong', {}, 'Арена: '), team.arena ? `${team.arena.name} (${team.arena.capacity || '12 000'} зрителей)` : 'Арена клуба'),
      el('div', {}, el('strong', {}, 'Лиги: '), (team.competitions || []).join(', '))
    )
  );
  container.appendChild(card);
}
