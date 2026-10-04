/**
 * Hockey365 Home Page Logic — Google Stitch 100% Fidelity
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getNews, getStandings, getMeta, getMatch, startLivePolling } from '../core/api.js';
import { getTodayISODate, formatDate } from '../core/format.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createDatepicker } from '../components/datepicker.js';
import { createMatchRow, KNOWN_TEAMS } from '../components/match-row.js';
import { trackMatchUpdates } from '../core/live-tracker.js';
import { getAssetUrl } from '../core/config.js';

let activeDate = getParam('date');
let activeFilter = getParam('filter') || 'all'; // 'all', 'live', 'KHL', 'NHL', 'VHL', 'MHL'
let stopPolling = null;

let cachedCompetitions = [];
let cachedTeamsMap = { ...KNOWN_TEAMS };
let cachedMeta = null;

export async function initHomePage() {
  const datepickerContainer = qs('#header-datepicker-slot') || qs('#datepicker-slot');
  const highlightBannerContainer = qs('#highlight-banner-slot');
  const matchesContainer = qs('#matches-slot');
  const subtoolbarChipsContainer = qs('#subtoolbar-chips');
  const sidebarStatsContainer = qs('#sidebar-stats-slot');
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

  const availableDates = cachedMeta?.availableDates || [];
  const defaultDate = cachedMeta?.activeDate || availableDates[0] || getTodayISODate();
  const notice = qs('#snapshot-notice');
  if (notice && cachedMeta?.updatedAt) {
    notice.textContent = `Срез данных: ${formatDate(cachedMeta.updatedAt, 'full')}. Матчи не обновляются в реальном времени.`;
  }

  // Smart date fallback: if no query param, check if today is in available dates, otherwise use current game day
  if (!activeDate) {
    const today = getTodayISODate();
    activeDate = availableDates.includes(today) ? today : defaultDate;
  }

  // Render Datepicker Ribbon into Header Tier 2
  function updateDateRibbon() {
    if (!datepickerContainer) return;
    datepickerContainer.innerHTML = '';
    datepickerContainer.appendChild(createDatepicker(activeDate, (newDate) => {
      activeDate = newDate;
      setParam('date', activeDate, true);
      updateDateRibbon();
      loadMatchesForDate();
    }));
  }
  updateDateRibbon();

  // Listen to popstate for browser back/forward
  window.addEventListener('popstate', () => {
    activeDate = getParam('date') || defaultDate;
    activeFilter = getParam('filter') || 'all';
    syncFilterButtons();
    updateDateRibbon();
    loadMatchesForDate();
  });

  // Listen to custom date-change events
  window.addEventListener('hockey365:date-change', (e) => {
    if (e.detail?.date && e.detail.date !== activeDate) {
      activeDate = e.detail.date;
      updateDateRibbon();
      loadMatchesForDate();
    }
  });

  // Setup Tier 2 Filter Pills
  function syncFilterButtons() {
    const headerFilters = qs('#header-filter-pills');
    if (headerFilters) {
      headerFilters.querySelectorAll('.filter-pill').forEach(btn => {
        const matches = btn.dataset.filter === activeFilter;
        btn.classList.toggle('active', matches);
        btn.setAttribute('aria-pressed', String(matches));
      });
    }
    updateSubtoolbarChips();
  }

  const headerFilterBtns = qs('#header-filter-pills');
  if (headerFilterBtns) {
    headerFilterBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      setParam('filter', activeFilter === 'all' ? null : activeFilter, true);
      syncFilterButtons();
      renderCurrentMatches();
    });
  }

  let latestMatches = [];

  function updateSubtoolbarChips() {
    if (!subtoolbarChipsContainer) return;
    const totalCount = latestMatches.length;
    const nhlCount = latestMatches.filter(m => m.compId === 'NHL').length;
    const khlMatches = latestMatches.filter(m => m.compId === 'KHL');
    const khlCount = khlMatches.length;
    const khlFinished = khlMatches.filter(m => m.status === 'FINISHED').length;
    const liveCount = latestMatches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION').length;

    subtoolbarChipsContainer.innerHTML = '';

    const chips = [
      {
        filter: 'all',
        label: 'Все лиги',
        badge: `(${totalCount})`,
        badgeClass: 'text-text-muted'
      },
      {
        filter: 'NHL',
        label: 'НХЛ',
        badge: `(${nhlCount})`,
        badgeClass: 'text-text-muted'
      },
      {
        filter: 'KHL',
        label: 'КХЛ',
        badge: khlFinished > 0 ? `(${khlFinished} Завершено)` : `(${khlCount})`,
        badgeClass: khlFinished > 0 ? 'text-win-green font-semibold' : 'text-text-muted'
      },
      {
        filter: 'live',
        label: 'Live',
        isLive: true,
        badge: liveCount > 0 ? `(${liveCount})` : '',
        badgeClass: 'text-live-red font-bold'
      }
    ];

    chips.forEach(c => {
      const isActive = activeFilter === c.filter;
      const chipBtn = el('button', {
        type: 'button',
        className: `subtool-chip ${isActive ? 'active' : ''} ${c.isLive ? 'chip-live' : ''}`,
        onClick: () => {
          activeFilter = c.filter;
          setParam('filter', activeFilter === 'all' ? null : activeFilter, true);
          syncFilterButtons();
          renderCurrentMatches();
        }
      },
        c.isLive ? el('span', { className: 'live-dot-sm' }) : null,
        el('span', {}, c.label),
        c.badge ? el('span', { className: `chip-count ${c.badgeClass || ''}` }, ` ${c.badge}`) : null
      );
      subtoolbarChipsContainer.appendChild(chipBtn);
    });
  }

  function renderCurrentMatches() {
    if (!matchesContainer) return;
    matchesContainer.innerHTML = '';

    let filtered = latestMatches;
    if (activeFilter === 'live') {
      filtered = latestMatches.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION');
    } else if (activeFilter === 'KHL' || activeFilter === 'NHL' || activeFilter === 'VHL' || activeFilter === 'MHL') {
      filtered = latestMatches.filter(m => m.compId === activeFilter);
    }

    if (filtered.length === 0) {
      if (activeFilter === 'live') {
        renderEmpty(matchesContainer, 'В сохранённом срезе нет матчей со статусом «в игре». Выберите другой фильтр или дату.');
      } else {
        if (activeFilter === 'all') renderDateEmptyState(activeDate);
        else renderEmpty(matchesContainer, 'Матчей по выбранному фильтру на эту дату нет.');
      }
      return;
    }

    // Group by competition
    const grouped = {};
    for (const m of filtered) {
      if (!grouped[m.compId]) grouped[m.compId] = [];
      grouped[m.compId].push(m);
    }

    // Order competitions: KHL first, NHL second, others following
    const compOrder = ['KHL', 'NHL', 'VHL', 'MHL'];
    const compKeys = Object.keys(grouped).sort((a, b) => {
      const idxA = compOrder.indexOf(a);
      const idxB = compOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const compId of compKeys) {
      const compInfo = cachedCompetitions.find(c => c.id === compId) || { name: compId, emblem: '' };
      const compMatches = grouped[compId];
      const compLetter = compId === 'KHL' ? 'К' : compId === 'NHL' ? 'N' : compId[0];
      const stageName = compId === 'KHL' ? 'Регулярный чемпионат' : compId === 'NHL' ? 'Регулярный сезон 2026/27' : 'Регулярный чемпионат';
      const gamesCountText = compId === 'KHL'
        ? `${compMatches.length} матча за сегодня`
        : compId === 'NHL'
        ? `${compMatches.length} матчей сегодняшней ночи (МСК)`
        : `${compMatches.length} матчей в программе`;

      const compGroup = el('div', { className: 'comp-group-stitch' },
        // Tournament Header Banner
        el('div', { className: 'comp-header-stitch' },
          el('div', { className: 'comp-title-group' },
            el('div', { className: 'comp-letter-box' }, compLetter),
            el('div', {},
              el('div', { className: 'comp-name-line' },
                el('h2', { className: 'comp-heading' }, compInfo.name || compId),
                el('span', { className: 'comp-badge-stage' }, stageName)
              ),
              el('span', { className: 'comp-games-count' }, gamesCountText)
            )
          ),
          el('a', {
            href: buildLink('/competition/', { id: compId, tab: 'table' }),
            className: 'comp-table-link'
          },
            el('span', {}, 'Таблица'),
            el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
          )
        ),
        // Fixtures Rows
        el('div', { className: 'comp-matches-list-stitch' },
          compMatches.map(m => createMatchRow(m, cachedTeamsMap))
        )
      );

      matchesContainer.appendChild(compGroup);
    }
  }

  function renderDateEmptyState(date) {
    if (!matchesContainer) return;
    matchesContainer.innerHTML = '';
    const dateCounts = cachedMeta?.dateCounts || {};
    const card = el('div', { className: 'stitch-widget-card text-center', style: { padding: 'var(--space-32)' } },
      el('div', { className: 'text-lg font-headline', style: { marginBottom: 'var(--space-8)', color: 'var(--text-primary)' } }, `На дату ${date} матчи не запланированы`),
      el('p', { className: 'text-sm text-muted', style: { marginBottom: 'var(--space-16)' } }, 'Выберите игровой день с доступными матчами:'),
      el('div', { className: 'flex flex-wrap gap-8 justify-center' },
        availableDates.map(d => {
          const count = dateCounts[d] ? ` (${dateCounts[d]} игр)` : '';
          return el('button', {
            type: 'button',
            className: `stitch-day-card ${d === activeDate ? 'active' : ''}`,
            style: { minWidth: '120px', padding: '8px 12px' },
            onClick: () => {
              activeDate = d;
              setParam('date', activeDate, true);
              updateDateRibbon();
              loadMatchesForDate();
            }
          },
            el('span', { className: 'stitch-day-label' }, 'ИГРОВОЙ ДЕНЬ'),
            el('span', { className: 'stitch-day-num font-tabular' }, `${d}${count}`)
          );
        })
      )
    );
    matchesContainer.appendChild(card);
  }

  function loadMatchesForDate() {
    if (!matchesContainer) return;
    renderLoading(matchesContainer, 4);

    if (stopPolling) stopPolling();

    stopPolling = startLivePolling(activeDate, (err, matches) => {
      if (err) {
        latestMatches = [];
        if (highlightBannerContainer) highlightBannerContainer.replaceChildren();
        renderError(matchesContainer, 'Не удалось загрузить матчи выбранной даты', loadMatchesForDate);
        return;
      }

      latestMatches = matches || [];
      trackMatchUpdates(latestMatches, cachedTeamsMap);
      renderHighlightBanner(highlightBannerContainer, latestMatches);
      updateSubtoolbarChips();
      renderCurrentMatches();

      // Find candidate match for Daily Stats widget
      const statsCandidate = latestMatches.find(m => m.status === 'FINISHED' && m.stats && Array.isArray(m.stats.shotsOnGoal))
        || latestMatches.find(m => m.stats && Array.isArray(m.stats.shotsOnGoal));
      if (statsCandidate) {
        loadSidebarStats(sidebarStatsContainer, statsCandidate.id);
      } else {
        const card = qs('#sidebar-stats-card');
        if (card) card.style.display = 'none';
      }
    }, 10000);
  }

  loadMatchesForDate();

  // Load Right Rail Widgets in exact Stitch order
  loadSidebarStandings(sidebarStandingsContainer);
  loadSidebarNews(sidebarNewsContainer);
}

function renderHighlightBanner(container, matches) {
  if (!container) return;
  if (!matches || matches.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Find priority highlight candidate: 1) LIVE, 2) OT/SO thriller, 3) FINISHED with most goals, 4) first match
  let highlight = matches.find(m => m.status === 'LIVE' || m.status === 'INTERMISSION');
  if (!highlight) {
    highlight = matches.find(m => m.finishedIn === 'OT' || m.finishedIn === 'SO');
  }
  if (!highlight) {
    highlight = matches.find(m => m.status === 'FINISHED');
  }
  if (!highlight) {
    highlight = matches[0];
  }

  const homeInfo = cachedTeamsMap[highlight.home.id] || { name: highlight.home.id.replace(/^(khl|nhl):/, '').toUpperCase() };
  const awayInfo = cachedTeamsMap[highlight.away.id] || { name: highlight.away.id.replace(/^(khl|nhl):/, '').toUpperCase() };

  let statusClass = 'finished';
  let badgeText = 'МАТЧ ДНЯ ЗАВЕРШЕН';
  let contextNote = '';
  let ctaLabel = 'Смотреть обзор и видео шайб';

  if (highlight.status === 'LIVE' || highlight.status === 'INTERMISSION') {
    statusClass = 'live';
    badgeText = 'LIVE МАТЧ В ИГРЕ';
    contextNote = `${highlight.period}-й период (${highlight.clock || ''})`;
    ctaLabel = 'Следить за матчем Live';
  } else if (highlight.status === 'FINISHED') {
    statusClass = 'finished';
    if (highlight.finishedIn === 'OT') {
      badgeText = 'МАТЧ ДНЯ ЗАВЕРШЕН (ОТ)';
      contextNote = 'Овертайм';
    } else if (highlight.finishedIn === 'SO') {
      badgeText = 'МАТЧ ДНЯ ЗАВЕРШЕН (Б)';
      contextNote = 'Буллиты';
    } else {
      badgeText = 'МАТЧ ДНЯ ЗАВЕРШЕН';
      contextNote = 'Основное время';
    }
  } else {
    statusClass = 'scheduled';
    badgeText = 'ГЛАВНЫЙ МАТЧ ДНЯ';
    contextNote = `Начало в ${formatDate(highlight.utcDate, 'time')}`;
    ctaLabel = 'Превью встречи';
  }

  const scoreText = (highlight.status === 'SCHEDULED')
    ? '- : -'
    : `${highlight.home.score} : ${highlight.away.score}${highlight.finishedIn ? ' ' + highlight.finishedIn : ''}`;

  const heroImgUrl = getAssetUrl('assets/images/hero_banner.jpg');
  const matchUrl = buildLink('/match/', { id: highlight.id });

  const banner = el('div', {
    className: 'highlight-banner-stitch',
    style: {
      backgroundImage: `linear-gradient(90deg, rgba(26, 34, 48, 0.94) 0%, rgba(20, 26, 35, 0.88) 50%, rgba(34, 45, 62, 0.94) 100%), url('${heroImgUrl}')`
    }
  },
    el('div', { className: 'highlight-banner-inner' },
      // Left Cluster
      el('div', { className: 'banner-left-section' },
        el('div', { className: `banner-status-badge banner-status-${statusClass}` },
          el('span', { className: 'status-dot-pulse' }),
          el('span', {}, badgeText)
        ),
        el('p', { className: 'banner-headline' },
          el('span', { className: 'banner-team' }, homeInfo.name),
          el('span', { className: 'banner-separator' }, highlight.status === 'SCHEDULED' ? ' vs ' : ' — '),
          el('span', { className: 'banner-team' }, awayInfo.name),
          ': ',
          el('span', { className: 'banner-score-highlight font-tabular' }, scoreText)
        )
      ),

      // Right Cluster
      el('div', { className: 'banner-right-section' },
        contextNote ? el('span', { className: 'banner-context-info' }, contextNote) : null,
        el('a', { href: matchUrl, className: 'banner-cta-link' },
          el('span', {}, ctaLabel),
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
        )
      )
    )
  );

  container.replaceChildren(banner);
}

async function loadSidebarStandings(container) {
  if (!container) return;
  const card = qs('#sidebar-standings-card');
  try {
    const stKHL = await getStandings('KHL');
    const firstGroup = stKHL?.groups?.[0];
    if (!firstGroup || !firstGroup.rows?.length) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'flex';
    container.innerHTML = '';
    const topRows = firstGroup.rows.slice(0, 5);

    const miniTable = el('table', { className: 'standings-mini-table' },
      el('thead', {},
        el('tr', {},
          el('th', { className: 'col-center w-8' }, '№'),
          el('th', { className: 'col-left' }, 'Команда'),
          el('th', { className: 'col-center w-8' }, 'И'),
          el('th', { className: 'col-center w-8' }, 'В'),
          el('th', { className: 'col-center w-8' }, 'П'),
          el('th', { className: 'col-right w-10' }, 'О')
        )
      ),
      el('tbody', {},
        topRows.map((r, idx) => {
          const isTop = idx === 0;
          const teamInfo = cachedTeamsMap[r.teamId] || { name: r.teamId.replace('khl:', '').toUpperCase() };
          return el('tr', { className: 'standings-row' },
            el('td', { className: 'col-center' },
              el('span', { className: isTop ? 'rank-badge rank-1' : 'rank-badge' }, r.pos)
            ),
            el('td', { className: 'col-left' },
              el('span', { className: 'playoff-green-dot' }),
              el('a', {
                href: buildLink('/team/', { id: r.teamId }),
                className: 'standings-team-name'
              }, teamInfo.name)
            ),
            el('td', { className: 'col-center font-tabular text-sec' }, r.gp),
            el('td', { className: 'col-center font-tabular text-muted' }, r.w),
            el('td', { className: 'col-center font-tabular text-muted' }, r.l),
            el('td', { className: 'col-right font-headline font-tabular bold-pts' }, r.pts)
          );
        })
      )
    );

    const footer = el('div', { className: 'standings-card-footer' },
      el('div', { className: 'playoff-legend' },
        el('span', { className: 'playoff-green-dot' }),
        el('span', {}, 'Зона плей-офф (Запад)')
      ),
      el('a', {
        href: buildLink('/competition/', { id: 'KHL', tab: 'table' }),
        className: 'conf-link'
      }, 'Восточная конф. →')
    );

    container.appendChild(miniTable);
    container.appendChild(footer);
  } catch (e) {
    if (card) card.style.display = 'none';
  }
}

async function loadSidebarNews(container) {
  if (!container) return;
  const card = qs('#sidebar-news-card');
  try {
    const data = await getNews();
    container.innerHTML = '';
    const items = (data.news || []).slice(0, 4);
    if (!items.length) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'flex';
    for (const n of items) {
      const tag = n.tags?.[0] || 'КХЛ';
      const timeStr = formatDate(n.publishedAt, 'timeAgo');
      const newsItem = el('article', { className: 'news-feed-item' },
        el('div', { className: 'news-meta-row' },
          el('span', { className: 'news-cat-pill' }, tag),
          el('span', { className: 'news-time-ago' }, timeStr)
        ),
        el('a', {
          href: buildLink('/news/', { id: n.id }),
          className: 'news-feed-headline'
        }, n.title),
        el('span', { className: 'news-feed-source' }, n.source || 'Hockey365 • Новости')
      );
      container.appendChild(newsItem);
    }
  } catch (e) {
    if (card) card.style.display = 'none';
  }
}

async function loadSidebarStats(container, matchId) {
  if (!container || !matchId) return;
  const card = qs('#sidebar-stats-card');
  const nameSlot = qs('#sidebar-stats-match-name');

  try {
    const match = await getMatch(matchId);
    if (!match || !match.stats || !Array.isArray(match.stats.shotsOnGoal)) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = 'flex';

    const homeInfo = cachedTeamsMap[match.home.id] || { name: match.home.id.replace(/^(khl|nhl):/, '').toUpperCase() };
    const awayInfo = cachedTeamsMap[match.away.id] || { name: match.away.id.replace(/^(khl|nhl):/, '').toUpperCase() };

    if (nameSlot) {
      nameSlot.textContent = `${homeInfo.name} vs ${awayInfo.name}`;
    }

    const s = match.stats;
    const homeSog = s.shotsOnGoal[0];
    const awaySog = s.shotsOnGoal[1];
    const totalSog = homeSog + awaySog || 1;
    const homeSogPct = Math.round((homeSog / totalSog) * 100);
    const awaySogPct = 100 - homeSogPct;

    const homeFo = s.faceoffPct?.[0] ?? 50;
    const awayFo = s.faceoffPct?.[1] ?? 50;

    const homePP = s.powerPlay?.[0] ?? '1 / 4';
    const awayPP = s.powerPlay?.[1] ?? '0 / 3';

    const statMetric = (title, leftVal, rightVal, leftWidth, rightWidth) => el('div', { className: 'stat-metric-row' },
      el('div', { className: 'stat-labels-row' },
        el('span', { className: 'stat-val font-tabular' }, leftVal),
        el('span', { className: 'stat-title' }, title),
        el('span', { className: 'stat-val font-tabular' }, rightVal)
      ),
      el('div', { className: 'stat-dual-track' },
        el('div', { className: 'stat-fill-left', style: { width: `${leftWidth}%` } }),
        el('div', { className: 'stat-fill-right', style: { width: `${rightWidth}%` } })
      )
    );

    container.replaceChildren(el('div', { className: 'flex flex-col gap-12' },
      statMetric('Броски в створ', homeSog, awaySog, homeSogPct, awaySogPct),
      statMetric('Вбрасывания', `${homeFo}%`, `${awayFo}%`, homeFo, awayFo),
      statMetric('Реализация большинства', homePP, awayPP, 60, 40),
      el('a', {
        href: buildLink('/match/', { id: match.id, tab: 'stats' }),
        className: 'stat-full-report-btn'
      }, 'Полный статистический отчёт')
    ));
  } catch (err) {
    if (card) card.style.display = 'none';
  }
}
