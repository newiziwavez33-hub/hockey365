/**
 * Hockey365 Home Page Logic — Google Stitch 100% Fidelity Design System
 * Replicates media_1791115908357.png with pixel-perfect precision.
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getNews, getStandings, getMeta, getMatch, getLeaders, getPlayer, startLivePolling } from '../core/api.js';
import { getFeedStatus, formatFeedStatus } from '../core/feed-status.js';
import { getTodayISODate, formatDate, formatScore, formatPosition, formatPeriodStatus } from '../core/format.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createDatepicker } from '../components/datepicker.js';
import { createMatchRow, createMatchGridCardStitch, KNOWN_TEAMS, getTeamMeta } from '../components/match-row.js';
import { trackMatchUpdates } from '../core/live-tracker.js';
import { getAssetUrl } from '../core/config.js';
import { store } from '../core/store.js';

let activeDate = getParam('date');
let activeFilter = getParam('filter') || 'all'; // 'all', 'live', 'KHL', 'NHL', 'MHL'
let stopPolling = null;

let cachedCompetitions = [];
let cachedTeamsMap = { ...KNOWN_TEAMS };
let cachedMeta = null;

export async function initHomePage() {
  const datepickerContainer = qs('#header-datepicker-slot') || qs('#datepicker-slot');
  const highlightBannerContainer = qs('#highlight-banner-slot');
  const matchesContainer = qs('#matches-slot');
  const matchCenterCountBadge = qs('#match-center-count');
  const subtoolbarChipsContainer = qs('#subtoolbar-chips');
  const sidebarPotwContainer = qs('#sidebar-potw-slot');
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
    notice.textContent = 'Проверяется подключение к официальному источнику NHL…';
  }

  // Smart date fallback
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
    const khlCount = latestMatches.filter(m => m.compId === 'KHL').length;

    if (matchCenterCountBadge) {
      if (totalCount > 0) {
        matchCenterCountBadge.style.display = 'inline-flex';
        const mod10 = totalCount % 10;
        const mod100 = totalCount % 100;
        const word = (mod10 === 1 && mod100 !== 11) ? 'МАТЧ'
          : ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) ? 'МАТЧА'
          : 'МАТЧЕЙ';
        matchCenterCountBadge.textContent = `${totalCount} ${word}`;
      } else {
        matchCenterCountBadge.style.display = 'none';
      }
    }

    subtoolbarChipsContainer.innerHTML = '';

    const chips = [
      { filter: 'all', label: 'Все лиги' },
      { filter: 'KHL', label: `КХЛ (${khlCount})` },
      { filter: 'NHL', label: `НХЛ (${nhlCount})` }
    ];

    chips.forEach(c => {
      const isActive = activeFilter === c.filter;
      const chipBtn = el('button', {
        type: 'button',
        className: `stream-filter-tab ${isActive ? 'active' : ''}`,
        onClick: () => {
          activeFilter = c.filter;
          setParam('filter', activeFilter === 'all' ? null : activeFilter, true);
          syncFilterButtons();
          renderCurrentMatches();
        }
      }, c.label);
      subtoolbarChipsContainer.appendChild(chipBtn);
    });

    const liveBadge = el('div', { className: 'live-pulse-badge', style: { marginLeft: 'auto' } },
      el('span', { className: 'pulse-dot' }),
      el('span', {}, getFeedStatus(latestMatches).mode === 'live' ? 'NHL · опрос 10 с' : 'Счёт: сохранённый срез / проверка')
    );
    subtoolbarChipsContainer.appendChild(liveBadge);
  }

  function renderCurrentMatches() {
    if (!matchesContainer) return;
    matchesContainer.innerHTML = '';

    let filtered = [...latestMatches];
    if (activeFilter === 'live') {
      filtered = filtered.filter(m => m.status === 'LIVE' || m.status === 'INTERMISSION');
    } else if (activeFilter && activeFilter !== 'all') {
      filtered = filtered.filter(m => m.compId === activeFilter);
    }

    if (filtered.length === 0) {
      if (activeFilter === 'KHL') {
        matchesContainer.appendChild(el('div', {
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
      } else if (latestMatches.length === 0) {
        renderDateEmptyState(activeDate);
      } else {
        matchesContainer.appendChild(el('div', {
          className: 'stitch-empty-card text-center',
          style: { padding: '32px 16px', color: 'var(--text-muted)' }
        }, 'Нет матчей по выбранному фильтру'));
      }
      return;
    }

    // Group matches by tournament/competition (Stitch Design Pattern)
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
      const compMeta = cachedCompetitions.find(c => c.id === compId);
      const compName = compMeta?.name || (compId === 'NHL' ? 'НХЛ' : compId === 'KHL' ? 'КХЛ' : compId);
      const letter = compId === 'NHL' ? 'N' : compId === 'KHL' ? 'К' : compId.charAt(0).toUpperCase();
      const stageName = compMeta?.season ? `Регулярный сезон ${compMeta.season}` : 'Регулярный сезон 2026/27';

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
        groupMatches.map(m => createMatchRow(m, cachedTeamsMap))
      );

      const sectionEl = el('div', { className: 'comp-group-stitch' },
        compHeader,
        matchesList
      );

      matchesContainer.appendChild(sectionEl);
    }
  }

  function renderDateEmptyState(date) {
    if (!matchesContainer) return;
    matchesContainer.innerHTML = '';
    const dateCounts = cachedMeta?.dateCounts || {};
    const card = el('div', { className: 'stitch-widget-card text-center', style: { padding: '32px' } },
      el('div', { className: 'text-lg font-headline', style: { marginBottom: '8px', color: 'var(--text-primary)' } }, `На дату ${date} матчи не запланированы`),
      el('p', { className: 'text-sm text-muted', style: { marginBottom: '16px' } }, 'Выберите игровой день с доступными матчами:'),
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
    latestMatches = [];

    stopPolling = startLivePolling(activeDate, (err, matches) => {
      if (err) {
        if (notice) notice.textContent = 'Обновление не удалось; ранее полученные данные могут устареть.';
        if (!latestMatches.length) renderError(matchesContainer, 'Не удалось загрузить матчи выбранной даты', loadMatchesForDate);
        return;
      }

      latestMatches = matches || [];
      if (notice) notice.textContent = formatFeedStatus(latestMatches);
      trackMatchUpdates(latestMatches, cachedTeamsMap);
      renderHeroMatchBanner(highlightBannerContainer, latestMatches);
      updateSubtoolbarChips();
      renderCurrentMatches();
    }, 10000);
  }

  loadMatchesForDate();

  window.addEventListener('pagehide', () => stopPolling?.(), { once: true });

  // Load Right Rail Widgets and Featured News
  renderPlayerOfTheWeekWidget(sidebarPotwContainer);
  loadSidebarStandings(sidebarStandingsContainer);
  loadHomeFeaturedNews();
}

/**
 * HERO BANNER («ГЛАВНЫЙ МАТЧ ДНЯ») — Matching media_1791115908357.png
 */
function renderHeroMatchBanner(container, matches) {
  if (!container) return;
  if (!matches || matches.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Prefer a live game, then the next scheduled game. Never promote a
  // hard-coded matchup: the feed is the only source of truth.
  let highlight = matches.find(m => m.status === 'LIVE' || m.status === 'INTERMISSION')
    || matches.find(m => m.finishedIn === 'OT' || m.finishedIn === 'SO')
    || matches.find(m => m.status === 'SCHEDULED')
    || matches[0];

  const homeTeam = getTeamMeta(highlight.home.id, cachedTeamsMap);
  const awayTeam = getTeamMeta(highlight.away.id, cachedTeamsMap);

  const isLive = highlight.status === 'LIVE' || highlight.status === 'INTERMISSION';
  const isFinished = highlight.status === 'FINISHED';
  const isScheduled = highlight.status === 'SCHEDULED';

  const leagueTag = highlight.compId ? `${highlight.compId} • официальный срез` : 'ХОККЕЙ • официальный срез';
  const arenaText = highlight.arena || 'Арена не указана в источнике';
  const homeRecord = 'Сезонная форма не опубликована';
  const awayRecord = 'Сезонная форма не опубликована';

  const heroImgUrl = getAssetUrl('assets/images/hero_banner.jpg');
  const matchUrl = buildLink('/match/', { id: highlight.id });

  let timeDigits = '—';
  let timeSub = 'ВРЕМЯ НЕ УКАЗАНО';

  if (isFinished) {
    timeDigits = formatScore(highlight.home.score, highlight.away.score, highlight.status);
    timeSub = highlight.finishedIn === 'OT' ? 'ОТ' : highlight.finishedIn === 'SO' ? 'БУЛЛИТЫ' : 'ФИНАЛ';
  } else if (isLive) {
    timeDigits = formatScore(highlight.home.score, highlight.away.score, highlight.status);
    timeSub = highlight.status === 'INTERMISSION' ? 'ПЕРЕРЫВ'
      : Number.isInteger(highlight.period) ? formatPeriodStatus(highlight) : 'МАТЧ ИДЕТ';
  } else if (highlight.utcDate) {
    timeDigits = formatDate(highlight.utcDate, 'time');
    timeSub = `${formatDate(highlight.utcDate, 'dayMonth')} • ${store.getTimezone() === 'Europe/Moscow' ? 'МСК' : store.getTimezone()}`;
  }

  const heroCard = el('div', {
    className: 'hero-stitch-banner',
    style: {
      backgroundImage: `linear-gradient(180deg, rgba(11, 14, 20, 0.45) 0%, rgba(11, 14, 20, 0.75) 50%, rgba(11, 14, 20, 0.96) 100%), url('${heroImgUrl}')`
    }
  },
    // Top Bar
    el('div', { className: 'hero-top-bar' },
      el('div', { className: 'hero-badges-left' },
        el('span', { className: 'hero-badge-cyan' }, 'ГЛАВНЫЙ МАТЧ ДНЯ'),
        el('span', { className: 'hero-badge-glass' }, leagueTag)
      ),
      el('div', { className: 'hero-arena-info' },
        el('span', { className: 'material-symbols-outlined text-[14px]' }, 'location_on'),
        el('span', {}, arenaText),
        el('span', { className: 'hero-arena-divider' }, '/'),
        el('span', { className: 'material-symbols-outlined text-[14px]' }, 'live_tv'),
        el('span', {}, formatPeriodStatus(highlight) || 'СТАТУС НЕ УКАЗАН')
      )
    ),

    // Matchup Grid
    el('div', { className: 'hero-matchup-grid' },
      // Home Team (Detroit / Left)
      el('div', { className: 'hero-team-block hero-team-home' },
        el('div', {
          className: 'hero-team-emblem',
          style: { backgroundColor: homeTeam.color || 'var(--surface-highlight)' }
        },
          el('img', {
            src: getAssetUrl(homeTeam.logo),
            alt: homeTeam.name,
            className: 'hero-team-logo-img',
            loading: 'lazy',
            onerror: (e) => {
              e.target.style.display = 'none';
              e.target.parentElement.textContent = homeTeam.short || 'ТМ';
            }
          })
        ),
        el('div', { className: 'hero-team-details' },
          el('h2', { className: 'hero-team-name' }, homeTeam.name),
          el('span', { className: 'hero-team-sub' }, homeRecord)
        )
      ),

      // Center Time & Faceoff Display
      el('div', { className: 'hero-center-faceoff' },
        el('span', { className: 'hero-faceoff-label' }, isScheduled ? 'СТАРТОВОЕ ВБРАСЫВАНИЕ' : 'ТЕКУЩИЙ СЧЕТ'),
        el('div', { className: 'hero-time-display font-tabular' },
          el('span', { className: 'hero-time-digits' }, timeDigits),
          el('span', { className: 'hero-time-tz' }, timeSub)
        ),
        // No prediction or fabricated win-rate is shown without verified
        // season aggregates for both teams.
        el('div', { className: 'hero-winrate-container' },
          el('span', {}, 'Сезонная статистика команд недоступна в этом срезе')
        )
      ),

      // Away Team (Winnipeg / Right)
      el('div', { className: 'hero-team-block hero-team-away' },
        el('div', { className: 'hero-team-details text-right' },
          el('h2', { className: 'hero-team-name' }, awayTeam.name),
          el('span', { className: 'hero-team-sub' }, awayRecord)
        ),
        el('div', {
          className: 'hero-team-emblem',
          style: { backgroundColor: awayTeam.color || 'var(--surface-highlight)' }
        },
          el('img', {
            src: getAssetUrl(awayTeam.logo),
            alt: awayTeam.name,
            className: 'hero-team-logo-img',
            loading: 'lazy',
            onerror: (e) => {
              e.target.style.display = 'none';
              e.target.parentElement.textContent = awayTeam.short || 'ТМ';
            }
          })
        )
      )
    ),

    // Bottom Action Bar
    el('div', { className: 'hero-bottom-bar' },
      el('div', { className: 'hero-chips-left' },
        el('span', { className: 'hero-stat-chip' }, `Площадка: ${arenaText}`),
        el('span', { className: 'hero-stat-chip' }, `События в срезе: ${Array.isArray(highlight.events) ? highlight.events.length : 0}`)
      ),
      el('div', { className: 'hero-actions-right' },
        el('a', { href: matchUrl, className: 'hero-btn-cyan' },
          el('span', {}, 'Превью встречи'),
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
        ),
        el('a', { href: `${matchUrl}&tab=video`, className: 'hero-btn-glass' },
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'play_circle'),
          el('span', {}, 'Трансляция')
        ),
        el('button', {
          type: 'button',
          className: 'hero-btn-star',
          'aria-label': 'В избранное',
          onClick: (e) => {
            const active = store.toggleFavorite('matches', highlight.id);
            e.currentTarget.classList.toggle('active', active);
          }
        }, el('span', { className: 'material-symbols-outlined text-[18px]' }, 'star'))
      )
    )
  );

  container.replaceChildren(heroCard);
}

/**
 * WIDGET 1: «ИГРОК НЕДЕЛИ» (Player of the Week) — Matching media_1791115908357.png
 */
async function renderPlayerOfTheWeekWidget(container) {
  if (!container) return;
  try {
    const leaders = await getLeaders('NHL');
    const leader = leaders?.categories?.points?.[0];
    if (!leader?.playerId) throw new Error('Official NHL leader is unavailable');

    const player = await getPlayer(leader.playerId);
    const team = getTeamMeta(player.teamId, cachedTeamsMap);
    const current = player.stats?.find(stat => stat.season === leaders.season) || player.stats?.[0] || {};
    const photo = player.photo ? getAssetUrl(player.photo) : '';
    const stat = (value, label) => el('div', { className: 'potw-stat-col' },
      el('div', { className: 'potw-stat-val font-tabular' }, value ?? '—'),
      el('div', { className: 'potw-stat-lbl' }, label)
    );

    const card = el('div', {
      className: 'player-of-the-week-card',
      style: photo ? {
        backgroundImage: `linear-gradient(180deg, rgba(11, 14, 20, 0.25) 0%, rgba(11, 14, 20, 0.75) 45%, rgba(11, 14, 20, 0.98) 100%), url('${photo}')`
      } : {}
    },
      el('div', { className: 'potw-header-row' },
        el('span', { className: 'potw-header-badge' }, 'ЛИДЕР НХЛ ПО ОЧКАМ'),
        el('div', { className: 'potw-team-pill' },
          el('span', {}, team.short || player.teamId || 'NHL')
        )
      ),
      el('div', { className: 'potw-content' },
        el('div', { className: 'potw-label' }, 'ОФИЦИАЛЬНЫЕ ДАННЫЕ NHL'),
        el('h3', { className: 'potw-player-name' }, player.name),
        el('div', { className: 'potw-player-team' }, `${formatPosition(player.position)} • ${team.name}`),
        el('div', { className: 'potw-stats-grid' },
          stat(current.g, 'ГОЛЫ'),
          stat(current.a, 'ПАСЫ'),
          stat(current.pts ?? leader.value, 'ОЧКИ'),
          stat(current.gp, 'ИГРЫ')
        ),
        el('div', { className: 'potw-streak-box' },
          el('div', { className: 'potw-streak-labels' },
            el('span', {}, `Сезон ${leaders.season || 'текущий'}`),
            el('span', { className: 'text-cyan font-tabular' }, 'NHL Web API')
          ),
          el('div', { className: 'potw-record-note' }, 'Без неподтверждённых прогнозов и ручных показателей')
        ),
        el('a', {
          href: buildLink('/player/', { id: player.id }),
          className: 'potw-full-dossier-btn'
        },
          el('span', {}, 'Открыть официальное досье'),
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
        )
      )
    );
    container.replaceChildren(card);
  } catch (error) {
    console.warn('Official NHL player widget unavailable:', error);
    container.replaceChildren(el('div', { className: 'text-sm text-muted p-4' }, 'Официальные данные игрока временно недоступны'));
  }
}

/**
 * WIDGET 2: «Лидеры КХЛ» (Standings Table) — Matching media_1791115908357.png
 */
async function loadSidebarStandings(container) {
  if (!container) return;
  try {
    const stKHL = await getStandings('KHL');
    const firstGroup = stKHL?.groups?.[0];
    if (!firstGroup || !firstGroup.rows?.length) {
      container.innerHTML = '<div class="text-sm text-muted p-4">Таблица обновляется...</div>';
      return;
    }

    const rows = firstGroup.rows.slice(0, 5);

    const table = el('table', { className: 'standings-mini-table' },
      el('thead', {},
        el('tr', {},
          el('th', { className: 'rank-th' }, '#'),
          el('th', {}, 'КОМАНДА'),
          el('th', { className: 'text-center' }, 'И'),
          el('th', { className: 'text-center' }, 'В'),
          el('th', { className: 'text-right' }, 'ОЧКИ')
        )
      ),
      el('tbody', {},
        rows.map((row, idx) => {
          const rank = idx + 1;
          const isTop2 = rank <= 2;
          const pts = row.pts !== undefined ? row.pts : (row.points || 0);
          const team = getTeamMeta(row.teamId, cachedTeamsMap);

          return el('tr', {},
            el('td', { className: 'rank-td font-tabular' }, rank),
            el('td', { className: 'team-td' },
              el('a', { href: buildLink('/team/', { id: row.teamId }), className: 'team-standings-link' },
                el('span', { className: `playoff-dot ${isTop2 ? 'cyan-dot' : ''}` }, '●'),
                el('img', {
                  src: getAssetUrl(team.logo),
                  alt: team.name,
                  className: 'table-team-logo',
                  loading: 'lazy',
                  onerror: (e) => { e.target.style.display = 'none'; }
                }),
                el('span', { className: 'team-table-name truncate' }, team.name || row.teamName || row.teamId)
              )
            ),
            el('td', { className: 'text-center font-tabular text-muted' }, row.gp || 0),
            el('td', { className: 'text-center font-tabular text-muted' }, row.w || 0),
            el('td', { className: 'text-right font-tabular pts-cell' }, pts)
          );
        })
      )
    );

    container.replaceChildren(table);
  } catch (err) {
    console.warn('Standings load error', err);
    container.innerHTML = '<div class="text-sm text-muted p-4">Таблица временно недоступна</div>';
  }
}

/**
 * Hydrates the featured news card on the home page with the latest verified news article
 */
async function loadHomeFeaturedNews() {
  const slot = qs('#home-featured-news-slot') || qs('.home-featured-news-card')?.parentElement;
  if (!slot) return;
  try {
    const data = await getNews();
    const articles = data.news || [];
    if (!articles.length) return;
    const latest = articles[0];

    const card = el('a', {
      href: buildLink('/news/', { id: latest.id }),
      className: 'home-featured-news-card'
    },
      el('div', {
        className: 'news-card-thumb',
        style: latest.image ? { backgroundImage: `url('${getAssetUrl(latest.image)}')` } : {}
      }),
      el('div', { className: 'news-card-content' },
        el('div', { className: 'news-meta-row' },
          el('span', { className: 'news-exclusive-badge' }, latest.tags?.[0] || 'ХОККЕЙ'),
          el('span', { className: 'news-time' }, `${formatDate(latest.publishedAt, 'dayMonth')} • ${latest.source || 'Чемпионат'}`)
        ),
        el('h3', { className: 'news-card-title' }, latest.title)
      )
    );

    slot.replaceChildren(card);
  } catch (e) {
    console.warn('Failed to load home featured news:', e);
  }
}
