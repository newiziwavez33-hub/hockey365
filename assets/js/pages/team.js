/**
 * Hockey365 Team Profile Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getTeam, getMatchesByDate, getPlayer, getSearchIndex, getMeta } from '../core/api.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { createTabs } from '../components/tabs.js';
import { createMatchRow } from '../components/match-row.js';
import { getAssetUrl } from '../core/config.js';
import { getTodayISODate, formatPosition } from '../core/format.js';

export async function initTeamPage() {
  const teamId = getParam('id');
  let activeTab = getParam('tab') || 'matches';
  if (!['matches', 'roster', 'about'].includes(activeTab)) activeTab = 'matches';
  let renderVersion = 0;

  const headerSlot = qs('#team-header-slot');
  const tabsSlot = qs('#team-tabs-slot');
  const contentSlot = qs('#team-content-slot');

  if (!teamId) {
    renderError(contentSlot, 'Выберите команду через поиск или турнирную таблицу');
    return;
  }

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
            `Арена: ${team.arena.name}${team.arena.capacity ? ` (${team.arena.capacity} мест)` : ''}`
          ) : null
        )
      ),

      // Favorite toggle button
      el('button', {
        className: `btn-primary ${isFav ? 'active' : ''}`,
        'aria-pressed': isFav ? 'true' : 'false',
        'aria-label': `${isFav ? 'Удалить' : 'Добавить'} ${team.name} ${isFav ? 'из' : 'в'} избранное`,
        onClick: (e) => {
          const active = store.toggleFavorite('teams', team.id);
          e.currentTarget.textContent = active ? '★ В избранном' : '☆ В избранное';
          e.currentTarget.setAttribute('aria-pressed', String(active));
          e.currentTarget.setAttribute('aria-label', `${active ? 'Удалить' : 'Добавить'} ${team.name} ${active ? 'из' : 'в'} избранное`);
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
    const version = ++renderVersion;
    contentSlot.innerHTML = '';
    contentSlot.id = `tab-pane-${activeTab}`;
    contentSlot.setAttribute('role', 'tabpanel');
    contentSlot.setAttribute('aria-labelledby', `tab-btn-${activeTab}`);

    if (activeTab === 'matches') {
      renderLoading(contentSlot, 3);
      try {
        const meta = await getMeta();
        const date = meta.availableDates?.includes(getTodayISODate()) ? getTodayISODate() : meta.activeDate;
        if (!date) throw new Error('No snapshot available');
        const todayMatches = await getMatchesByDate(date);
        if (version !== renderVersion) return;
        const teamMatches = (todayMatches || []).filter(m => m.home.id === teamId || m.away.id === teamId);
        contentSlot.innerHTML = '';
        if (teamMatches.length === 0) {
          renderEmpty(contentSlot, `В доступном срезе за ${date} матчей команды нет.`);
        } else {
          const card = el('div', { className: 'card' },
            el('div', { className: 'card-header' },
              el('h3', { className: 'card-title' }, `Матчи из среза за ${date}`)
            ),
            el('div', {}, teamMatches.map(m => createMatchRow(m)))
          );
          contentSlot.appendChild(card);
        }
      } catch (e) {
        if (version === renderVersion) renderError(contentSlot, 'Не удалось загрузить матчи', renderTabBody);
      }
    } else if (activeTab === 'roster') {
      renderLoading(contentSlot, 2);
      try {
        const index = await getSearchIndex();
        const profiles = await Promise.all(index.filter(item => item.type === 'player' && item.id?.startsWith(team.id.split(':')[0] + ':')).map(item => getPlayer(item.id).catch(() => null)));
        if (version === renderVersion) renderRoster(contentSlot, team, profiles.filter(player => player?.teamId === team.id));
      } catch {
        if (version === renderVersion) renderError(contentSlot, 'Не удалось загрузить доступные профили игроков', renderTabBody);
      }
    } else if (activeTab === 'about') {
      renderAbout(contentSlot, team);
    }
  }

  renderTabBody();
}

function renderRoster(container, team, players) {
  container.replaceChildren();
  if (!players.length) {
    renderEmpty(container, 'Подтверждённых профилей игроков этого клуба в текущем наборе данных нет.');
    return;
  }
  const card = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, `Доступные профили игроков (${team.name})`)
    ),
    el('div', { className: 'card-body' },
      el('div', { className: 'layout-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
        players.map(p => el('div', { className: 'card', style: { margin: 0, padding: '12px' } },
          el('div', { className: 'flex items-center justify-between' },
            el('div', {},
              el('a', { href: buildLink('/player/', { id: p.id }), className: 'text-bold link-accent' }, p.name),
              el('div', { className: 'text-xs text-muted' }, `Амплуа: ${formatPosition(p.position)}`)
            ),
            el('span', { className: 'badge badge-scheduled' }, `#${p.number ?? '—'}`)
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
      el('div', {}, el('strong', {}, 'Арена: '), team.arena ? `${team.arena.name}${team.arena.capacity ? ` (${team.arena.capacity} зрителей)` : ''}` : 'Не указана'),
      el('div', {}, el('strong', {}, 'Лиги: '), (team.competitions || []).join(', '))
    )
  );
  container.appendChild(card);
}
