/**
 * Hockey365 Online / Live Center Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, startLivePolling } from '../core/api.js';
import { getTodayISODate } from '../core/format.js';
import { createMatchRow } from '../components/match-row.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

let activeFilter = 'all';
let stopPolling = null;
let lastUpdatedTime = new Date();

export async function initOnlinePage() {
  const container = qs('#online-matches-slot');
  const liveCountBadge = qs('#live-count-badge');
  const updatedStamp = qs('#updated-stamp');
  const filterGroup = qs('#online-filters');

  let competitions = [];
  try {
    competitions = await getCompetitions();
  } catch (e) {
    console.error(e);
  }

  // Update "updated N seconds ago" counter
  setInterval(() => {
    if (!updatedStamp) return;
    const diffSec = Math.floor((new Date() - lastUpdatedTime) / 1000);
    updatedStamp.textContent = `Обновлено ${diffSec} сек назад`;
  }, 3000);

  if (filterGroup) {
    filterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      filterGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderMatches(currentMatchesList);
    });
  }

  let currentMatchesList = [];

  function renderMatches(matches) {
    container.innerHTML = '';

    // Filter
    let filtered = matches;
    if (activeFilter === 'live') {
      filtered = matches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION');
    } else if (activeFilter === 'finished') {
      filtered = matches.filter(m => m.status === 'FINISHED');
    } else if (activeFilter === 'scheduled') {
      filtered = matches.filter(m => m.status === 'SCHEDULED');
    } else if (activeFilter !== 'all') {
      filtered = matches.filter(m => m.compId === activeFilter);
    }

    const liveCount = matches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION').length;
    if (liveCountBadge) {
      liveCountBadge.textContent = `${liveCount} LIVE`;
      liveCountBadge.className = `badge ${liveCount > 0 ? 'badge-live' : 'badge-finished'}`;
    }

    if (filtered.length === 0) {
      renderEmpty(container, 'Матчи по выбранному фильтру не найдены.');
      return;
    }

    // Group by competition
    const grouped = {};
    for (const m of filtered) {
      if (!grouped[m.compId]) grouped[m.compId] = [];
      grouped[m.compId].push(m);
    }

    for (const compId of Object.keys(grouped)) {
      const compInfo = competitions.find(c => c.id === compId) || { name: compId, emblem: '' };
      const compCard = el('div', { className: 'comp-group' },
        el('div', { className: 'comp-header' },
          el('div', { className: 'comp-header-left' },
            compInfo.emblem ? el('img', { src: getAssetUrl(compInfo.emblem), alt: compInfo.name, className: 'comp-emblem' }) : null,
            el('a', { href: buildLink('/competition/', { id: compId }), className: 'link-accent' }, compInfo.name)
          ),
          el('span', { className: 'text-xs text-muted' }, `${grouped[compId].length} игр`)
        ),
        el('div', { className: 'comp-matches-list' },
          grouped[compId].map(m => createMatchRow(m))
        )
      );

      container.appendChild(compCard);
    }
  }

  function startPolling() {
    renderLoading(container, 4);
    const today = getTodayISODate();

    stopPolling = startLivePolling(today, (err, matches) => {
      lastUpdatedTime = new Date();
      if (err) {
        renderError(container, 'Не удалось получить данные онлайн-матчей', () => startPolling());
        return;
      }
      currentMatchesList = matches || [];
      renderMatches(currentMatchesList);
    }, 15000); // 15 seconds polling on online page
  }

  startPolling();
}
