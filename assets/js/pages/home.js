/**
 * Hockey365 Home Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getNews, getStandings, startLivePolling } from '../core/api.js';
import { getTodayISODate } from '../core/format.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createDatepicker } from '../components/datepicker.js';
import { createMatchRow } from '../components/match-row.js';
import { getAssetUrl } from '../core/config.js';

let activeDate = getParam('date') || getTodayISODate();
let activeFilter = 'all'; // 'all', 'live', 'KHL', 'NHL'
let stopPolling = null;

let cachedCompetitions = [];
let cachedTeamsMap = {};

export async function initHomePage() {
  const datepickerContainer = qs('#datepicker-slot');
  const matchesContainer = qs('#matches-slot');
  const sidebarNewsContainer = qs('#sidebar-news-slot');
  const sidebarStandingsContainer = qs('#sidebar-standings-slot');

  // Load competitions and teams
  try {
    cachedCompetitions = await getCompetitions();
  } catch (e) {
    console.error('Failed to load competitions:', e);
  }

  // Render Datepicker Ribbon
  function updateDateRibbon() {
    datepickerContainer.innerHTML = '';
    datepickerContainer.appendChild(createDatepicker(activeDate, (newDate) => {
      activeDate = newDate;
      setParam('date', activeDate, true);
      updateDateRibbon();
      loadMatchesForDate();
    }));
  }
  updateDateRibbon();

  // Setup Filter Buttons
  const filterBtns = qs('#filter-pills');
  if (filterBtns) {
    filterBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      filterBtns.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderCurrentMatches();
    });
  }

  let latestMatches = [];

  function renderCurrentMatches() {
    matchesContainer.innerHTML = '';

    let filtered = latestMatches;
    if (activeFilter === 'live') {
      filtered = latestMatches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION');
    } else if (activeFilter === 'KHL' || activeFilter === 'NHL') {
      filtered = latestMatches.filter(m => m.compId === activeFilter);
    }

    if (filtered.length === 0) {
      const msg = activeFilter === 'live'
        ? 'Сейчас нет матчей в режиме LIVE. Выберите другую дату или покажите все матчи.'
        : `На ${activeDate} матчи не найдены.`;
      renderEmpty(matchesContainer, msg);
      return;
    }

    // Group by competition
    const grouped = {};
    for (const m of filtered) {
      if (!grouped[m.compId]) grouped[m.compId] = [];
      grouped[m.compId].push(m);
    }

    for (const compId of Object.keys(grouped)) {
      const compInfo = cachedCompetitions.find(c => c.id === compId) || { name: compId, emblem: '' };
      const compCard = el('div', { className: 'comp-group' },
        el('div', { className: 'comp-header' },
          el('div', { className: 'comp-header-left' },
            compInfo.emblem ? el('img', { src: getAssetUrl(compInfo.emblem), alt: compInfo.name, className: 'comp-emblem' }) : null,
            el('a', { href: buildLink('/competition/', { id: compId }), className: 'link-accent' }, compInfo.name)
          ),
          el('a', { href: buildLink('/competition/', { id: compId, tab: 'table' }), className: 'text-xs text-muted link-accent' }, 'Таблица →')
        ),
        el('div', { className: 'comp-matches-list' },
          grouped[compId].map(m => createMatchRow(m, cachedTeamsMap))
        )
      );

      matchesContainer.appendChild(compCard);
    }
  }

  function loadMatchesForDate() {
    renderLoading(matchesContainer, 4);

    if (stopPolling) stopPolling();

    stopPolling = startLivePolling(activeDate, (err, matches) => {
      if (err) {
        renderError(matchesContainer, 'Матчи на эту дату не найдены', () => loadMatchesForDate());
        return;
      }
      latestMatches = matches || [];
      renderCurrentMatches();
    });
  }

  loadMatchesForDate();

  // Load Sidebar Content
  loadSidebarNews(sidebarNewsContainer);
  loadSidebarStandings(sidebarStandingsContainer);
}

async function loadSidebarNews(container) {
  if (!container) return;
  try {
    const data = await getNews();
    container.innerHTML = '';
    const items = (data.news || []).slice(0, 5);
    for (const n of items) {
      const item = el('div', { className: 'news-item' },
        el('div', { className: 'news-info' },
          el('a', { href: buildLink('/news/', { id: n.id }), className: 'news-title link-accent' }, n.title),
          el('div', { className: 'news-meta' }, n.source || 'Hockey365')
        )
      );
      container.appendChild(item);
    }
  } catch (e) {
    container.innerHTML = '<div class="text-xs text-muted">Новости временно недоступны</div>';
  }
}

async function loadSidebarStandings(container) {
  if (!container) return;
  try {
    const stKHL = await getStandings('KHL');
    const firstGroup = stKHL.groups[0];
    if (!firstGroup) return;

    container.innerHTML = '';
    const topRows = firstGroup.rows.slice(0, 5);

    const miniTable = el('table', { className: 'standings-table text-xs' },
      el('thead', {},
        el('tr', {},
          el('th', {}, '№'),
          el('th', { style: { textAlign: 'left' } }, 'Команда'),
          el('th', {}, 'И'),
          el('th', { className: 'col-pts' }, 'О')
        )
      ),
      el('tbody', {},
        topRows.map(r => el('tr', {},
          el('td', {}, r.pos),
          el('td', { style: { textAlign: 'left' } },
            el('a', { href: buildLink('/team/', { id: r.teamId }), className: 'link-accent' }, r.teamId.replace('khl:', '').toUpperCase())
          ),
          el('td', {}, r.gp),
          el('td', { className: 'col-pts' }, r.pts)
        ))
      )
    );

    container.appendChild(miniTable);
  } catch (e) {
    container.innerHTML = '<div class="text-xs text-muted">Таблица недоступна</div>';
  }
}
