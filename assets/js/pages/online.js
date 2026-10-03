/**
 * Hockey365 Online / Live Center Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getMeta } from '../core/api.js';
import { getTodayISODate, formatDate } from '../core/format.js';
import { createMatchRow } from '../components/match-row.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

let activeFilter = 'all';

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

  if (filterGroup) {
    filterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      filterGroup.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
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
      liveCountBadge.textContent = `${liveCount} в игре на момент среза`;
      liveCountBadge.className = 'badge badge-scheduled';
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

  async function loadSnapshot() {
    renderLoading(container, 4);
    try {
      const meta = await getMeta();
      const today = getTodayISODate();
      const targetDate = meta?.availableDates?.includes(today) ? today : meta?.activeDate || meta?.availableDates?.[0];
      if (!targetDate) throw new Error('No snapshot dates');
      if (updatedStamp) updatedStamp.textContent = `Срез данных: ${meta.updatedAt ? formatDate(meta.updatedAt, 'full') : targetDate}. Данные могут устареть.`;
      currentMatchesList = await getMatchesByDate(targetDate) || [];
      renderMatches(currentMatchesList);
    } catch (e) {
      if (updatedStamp) updatedStamp.textContent = 'Не удалось определить время среза';
      renderError(container, 'Не удалось получить сохранённые матчи', loadSnapshot);
    }
  }

  loadSnapshot();
}
