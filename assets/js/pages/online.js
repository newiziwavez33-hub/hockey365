/**
 * Hockey365 Online / Live Center Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getMeta, startLivePolling } from '../core/api.js';
import { getTodayISODate, formatDate } from '../core/format.js';
import { createMatchRow, KNOWN_TEAMS } from '../components/match-row.js';
import { trackMatchUpdates } from '../core/live-tracker.js';
import { getParam, buildLink } from '../core/router.js';
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
      if (activeFilter === 'KHL') {
        container.appendChild(el('div', {
          className: 'stitch-widget-card text-center',
          style: { padding: '32px 16px', color: 'var(--text-muted)' }
        },
          el('div', { className: 'text-base font-bold text-white', style: { marginBottom: '8px' } }, 'Матчи КХЛ временно недоступны'),
          el('p', { className: 'text-sm' }, 'Ожидается подключение лицензированного поставщика данных КХЛ. Официальные матчи НХЛ доступны в реальном времени.'),
          el('a', {
            href: buildLink('/competition/', { id: 'KHL' }),
            className: 'inline-flex items-center gap-1 text-primary-container hover:text-primary text-sm font-semibold',
            style: { marginTop: '14px' }
          },
            el('span', {}, 'Перейти к турнирной таблице КХЛ'),
            el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
          )
        ));
      } else {
        renderEmpty(container, 'Матчи по выбранному фильтру не найдены.');
      }
      return;
    }

    // Group by competition (Stitch Design Pattern)
    const grouped = {};
    for (const m of filtered) {
      const compId = m.compId || 'OTHER';
      if (!grouped[compId]) grouped[compId] = [];
      grouped[compId].push(m);
    }

    const competitionOrder = ['KHL', 'NHL', 'VHL', 'MHL'];
    const compKeys = Object.keys(grouped).sort((a, b) => {
      const idxA = competitionOrder.indexOf(a);
      const idxB = competitionOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const compId of compKeys) {
      const groupMatches = grouped[compId];
      const compInfo = competitions.find(c => c.id === compId);
      const compName = compInfo?.name || (compId === 'NHL' ? 'НХЛ' : compId === 'KHL' ? 'КХЛ' : compId);
      const letter = compId === 'NHL' ? 'N' : compId === 'KHL' ? 'К' : compId.charAt(0).toUpperCase();
      const stageName = compInfo?.season ? `Регулярный сезон ${compInfo.season}` : 'Регулярный сезон 2026/27';

      const count = groupMatches.length;
      const mod10 = count % 10;
      const mod100 = count % 100;
      const word = (mod10 === 1 && mod100 !== 11) ? 'матч'
        : ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) ? 'матча'
        : 'матчей';
      const liveInGroup = groupMatches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION').length;
      const gamesCountText = liveInGroup > 0
        ? `${count} ${word} • ${liveInGroup} в прямом эфире`
        : `${count} ${word} игрового дня (МСК)`;

      const compHeader = el('div', { className: 'comp-header-stitch' },
        el('div', { className: 'comp-title-group' },
          el('div', { className: 'comp-letter-box' }, letter),
          el('div', {},
            el('div', { className: 'comp-name-line' },
              el('h2', { className: 'comp-heading' }, compName),
              el('span', { className: 'comp-badge-stage' }, stageName)
            ),
            el('span', { className: 'comp-games-count' }, gamesCountText)
          )
        ),
        el('a', {
          href: buildLink('/competition/', { id: compId }),
          className: 'comp-table-link'
        },
          el('span', {}, 'Таблица лиги'),
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'chevron_right')
        )
      );

      const matchesList = el('div', { className: 'comp-matches-list-stitch' },
        groupMatches.map(m => createMatchRow(m, KNOWN_TEAMS))
      );

      const sectionEl = el('div', { className: 'comp-group-stitch' },
        compHeader,
        matchesList
      );

      container.appendChild(sectionEl);
    }
  }

  async function startLiveCenter() {
    renderLoading(container, 4);
    try {
      const meta = await getMeta();
      const today = getTodayISODate();
      const urlDate = getParam('date');
      const targetDate = urlDate || (meta?.availableDates?.includes(today) ? today : meta?.activeDate || meta?.availableDates?.[0]);
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
      renderError(container, 'Не удалось получить live-матчи', startLiveCenter);
    }
  }

  startLiveCenter();
}
