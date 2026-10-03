/**
 * Hockey365 Online / Live Center Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getMeta, startLivePolling } from '../core/api.js';
import { getTodayISODate, formatDate } from '../core/format.js';
import { createMatchRow, KNOWN_TEAMS } from '../components/match-row.js';
import { trackMatchUpdates } from '../core/live-tracker.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl, CONFIG } from '../core/config.js';

let activeFilter = 'all';
let stopPolling = null;

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
  let pollCountdown = 10;
  let countdownTimer = null;

  // Add Real-Time Live Status Bar above matches
  const statusBar = el('div', { className: 'live-status-bar' },
    el('div', { className: 'live-countdown-text' },
      el('span', { className: 'live-dot' }),
      el('span', { id: 'live-ticker-text' }, 'Прямой эфир: обновление каждые 10с')
    ),
    el('button', {
      className: 'live-refresh-btn',
      id: 'manual-refresh-btn',
      type: 'button',
      title: 'Обновить прямо сейчас',
      onClick: () => {
        if (stopPolling && stopPolling.refresh) {
          const btn = qs('#manual-refresh-btn');
          if (btn) btn.classList.add('spinning');
          stopPolling.refresh().finally(() => {
            setTimeout(() => { if (btn) btn.classList.remove('spinning'); }, 600);
          });
          pollCountdown = 10;
        }
      }
    },
      el('svg', { width: '13', height: '13', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('path', { d: 'M23 4v6h-6M1 20v-6h6' }),
        el('path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' })
      ),
      el('span', {}, 'Обновить')
    )
  );

  container.parentNode.insertBefore(statusBar, container);

  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      pollCountdown--;
      if (pollCountdown <= 0) pollCountdown = 10;
      const ticker = qs('#live-ticker-text');
      if (ticker) {
        ticker.textContent = `Прямой эфир: следующее обновление через ${pollCountdown}с`;
      }
    }, 1000);
  }

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

    const liveMatches = matches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION');
    const liveCount = liveMatches.length;

    if (liveCountBadge) {
      if (liveCount > 0) {
        liveCountBadge.innerHTML = `<span class="live-dot" style="margin-right: 4px;"></span>${liveCount} LIVE`;
        liveCountBadge.className = 'badge badge-live';
      } else {
        liveCountBadge.textContent = '0 LIVE';
        liveCountBadge.className = 'badge badge-scheduled';
      }
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
          grouped[compId].map(m => createMatchRow(m, KNOWN_TEAMS))
        )
      );

      container.appendChild(compCard);
    }
  }

  async function startLiveCenter() {
    renderLoading(container, 4);
    try {
      const meta = await getMeta();
      const today = getTodayISODate();
      const targetDate = meta?.availableDates?.includes(today) ? today : meta?.activeDate || meta?.availableDates?.[0];
      if (!targetDate) throw new Error('No snapshot dates');

      if (stopPolling) stopPolling();

      stopPolling = startLivePolling(targetDate, (err, matches) => {
        if (err) {
          if (updatedStamp) updatedStamp.textContent = 'Ошибка подключения к серверу';
          return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (updatedStamp) {
          updatedStamp.innerHTML = `Обновлено в ${timeStr} • <span style="color: var(--primary-container);">В реальном времени</span>`;
        }

        currentMatchesList = matches || [];
        trackMatchUpdates(currentMatchesList, KNOWN_TEAMS);
        renderMatches(currentMatchesList);
        pollCountdown = 10;
      }, 10000);

      startCountdown();
    } catch (e) {
      if (updatedStamp) updatedStamp.textContent = 'Не удалось загрузить данные';
      renderError(container, 'Не удалось получить сохранённые матчи', startLiveCenter);
    }
  }

  startLiveCenter();
}
