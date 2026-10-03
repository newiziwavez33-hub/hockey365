/**
 * Hockey365 Home Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getNews, getStandings, startLivePolling, getMeta } from '../core/api.js';
import { getTodayISODate } from '../core/format.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createDatepicker } from '../components/datepicker.js';
import { createMatchRow } from '../components/match-row.js';
import { getAssetUrl } from '../core/config.js';

let activeDate = getParam('date');
let activeFilter = 'all'; // 'all', 'live', 'KHL', 'NHL'
let stopPolling = null;

let cachedCompetitions = [];
let cachedTeamsMap = {};
let cachedMeta = null;

export async function initHomePage() {
  const datepickerContainer = qs('#datepicker-slot');
  const matchesContainer = qs('#matches-slot');
  const sidebarNewsContainer = qs('#sidebar-news-slot');
  const sidebarStandingsContainer = qs('#sidebar-standings-slot');

  // Load meta, competitions and teams
  try {
    const [metaRes, compRes] = await Promise.allSettled([getMeta(), getCompetitions()]);
    if (metaRes.status === 'fulfilled') cachedMeta = metaRes.value;
    if (compRes.status === 'fulfilled') cachedCompetitions = compRes.value;
  } catch (e) {
    console.error('Failed to load initial data:', e);
  }

  const availableDates = cachedMeta?.availableDates || [
    '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'
  ];
  const defaultDate = cachedMeta?.activeDate || availableDates[0] || '2026-10-03';

  // Smart date fallback: if no query param, check if today is in available dates, otherwise use current game day
  if (!activeDate) {
    const today = getTodayISODate();
    activeDate = availableDates.includes(today) ? today : defaultDate;
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
      if (activeFilter === 'live') {
        renderEmpty(matchesContainer, 'Сейчас нет матчей в режиме LIVE. Выберите «Все матчи» или другую дату.');
      } else {
        renderDateEmptyState(activeDate);
      }
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

  function renderDateEmptyState(date) {
    matchesContainer.innerHTML = '';
    const dateCounts = cachedMeta?.dateCounts || {};
    const card = el('div', { className: 'card text-center', style: { padding: 'var(--space-24)' } },
      el('div', { className: 'text-lg text-bold', style: { marginBottom: 'var(--space-8)' } }, `На дату ${date} матчи не запланированы`),
      el('p', { className: 'text-sm text-muted', style: { marginBottom: 'var(--space-16)' } }, 'Выберите игровой день с доступными матчами:'),
      el('div', { className: 'flex flex-wrap gap-8 justify-center' },
        availableDates.map(d => {
          const count = dateCounts[d] ? ` (${dateCounts[d]} игр)` : '';
          return el('button', {
            className: `btn-primary ${d === activeDate ? 'active' : ''}`,
            onClick: () => {
              activeDate = d;
              setParam('date', activeDate, true);
              updateDateRibbon();
              loadMatchesForDate();
            }
          }, `${d}${count}`);
        })
      )
    );
    matchesContainer.appendChild(card);
  }

  function loadMatchesForDate() {
    renderLoading(matchesContainer, 4);

    if (stopPolling) stopPolling();

    stopPolling = startLivePolling(activeDate, (err, matches) => {
      if (err) {
        renderDateEmptyState(activeDate);
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
