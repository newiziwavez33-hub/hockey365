/**
 * Hockey365 Home Page Logic — Google Stitch 100% Fidelity Design System
 * Replicates media_1791115908357.png with pixel-perfect precision.
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatchesByDate, getCompetitions, getNews, getStandings, getMeta, getMatch, startLivePolling } from '../core/api.js';
import { getTodayISODate, formatDate } from '../core/format.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createDatepicker } from '../components/datepicker.js';
import { createMatchGridCardStitch, KNOWN_TEAMS, getTeamMeta } from '../components/match-row.js';
import { trackMatchUpdates } from '../core/live-tracker.js';
import { getAssetUrl } from '../core/config.js';

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
    notice.textContent = `Срез данных: ${formatDate(cachedMeta.updatedAt, 'full')}. Матчи не обновляются в реальном времени.`;
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
      matchCenterCountBadge.textContent = `${totalCount} МАТЧЕЙ`;
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
      if (latestMatches.length === 0) {
        renderDateEmptyState(activeDate);
      } else {
        matchesContainer.appendChild(el('div', {
          className: 'stitch-empty-card text-center',
          style: { padding: '32px 16px', color: 'var(--text-muted)' }
        }, 'Нет матчей по выбранному фильтру'));
      }
      return;
    }

    // Render matches in a 2-column responsive card grid (Stitch Pattern)
    const gridEl = el('div', { className: 'match-center-cards-grid' },
      filtered.map(m => createMatchGridCardStitch(m, cachedTeamsMap))
    );

    matchesContainer.appendChild(gridEl);
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

    stopPolling = startLivePolling(activeDate, (err, matches) => {
      if (err) {
        latestMatches = [];
        if (highlightBannerContainer) highlightBannerContainer.replaceChildren();
        renderError(matchesContainer, 'Не удалось загрузить матчи выбранной даты', loadMatchesForDate);
        return;
      }

      latestMatches = matches || [];
      trackMatchUpdates(latestMatches, cachedTeamsMap);
      renderHeroMatchBanner(highlightBannerContainer, latestMatches);
      updateSubtoolbarChips();
      renderCurrentMatches();
    }, 10000);
  }

  loadMatchesForDate();

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

  // Priority highlight: Detroit vs Winnipeg if available, or first scheduled/live match
  let highlight = matches.find(m => (m.home.id.includes('det') && m.away.id.includes('wpg')) || (m.home.id.includes('wpg') && m.away.id.includes('det')))
    || matches.find(m => m.status === 'LIVE' || m.status === 'INTERMISSION')
    || matches.find(m => m.finishedIn === 'OT' || m.finishedIn === 'SO')
    || matches.find(m => m.status === 'SCHEDULED')
    || matches[0];

  const homeTeam = getTeamMeta(highlight.home.id, cachedTeamsMap);
  const awayTeam = getTeamMeta(highlight.away.id, cachedTeamsMap);

  const isLive = highlight.status === 'LIVE' || highlight.status === 'INTERMISSION';
  const isFinished = highlight.status === 'FINISHED';
  const isScheduled = highlight.status === 'SCHEDULED';

  const leagueTag = highlight.compId === 'NHL' ? 'НХЛ • РЕГУЛЯРНЫЙ ЧЕМПИОНАТ' : 'КХЛ • РЕГУЛЯРНЫЙ ЧЕМПИОНАТ';
  const arenaText = highlight.compId === 'NHL' ? 'Little Caesars Arena, Детройт' : 'Ледовый Дворец, Санкт-Петербург';

  const homeRecord = highlight.compId === 'NHL' ? '32-22-6 • Восточная Конференция (WC2)' : '32-15-4 • Западная Конференция';
  const awayRecord = highlight.compId === 'NHL' ? 'Лидер Запада (1st) • 41-15-4' : 'Лидер Чемпионата (1st) • 38-12-3';

  const heroImgUrl = getAssetUrl('assets/images/hero_banner.jpg');
  const matchUrl = buildLink('/match/', { id: highlight.id });

  let timeDigits = '20:00';
  let timeSub = 'МСК';

  if (isFinished) {
    timeDigits = `${highlight.home.score} : ${highlight.away.score}`;
    timeSub = highlight.finishedIn ? highlight.finishedIn : 'ФИНАЛ';
  } else if (isLive) {
    timeDigits = `${highlight.home.score} : ${highlight.away.score}`;
    timeSub = `${highlight.period}-Й ПЕРИОД`;
  } else if (highlight.utcDate) {
    timeDigits = new Date(highlight.utcDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
    timeSub = 'МСК';
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
        el('span', {}, 'ПРЯМОЙ ЭФИР В 4K')
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
        // Winrate Comparison Bar
        el('div', { className: 'hero-winrate-container' },
          el('div', { className: 'hero-winrate-labels' },
            el('span', { className: 'winrate-left' }, `52% ${homeTeam.short || 'ДЕТ'}`),
            el('span', { className: 'winrate-center' }, 'Винрейт по сезону'),
            el('span', { className: 'winrate-right' }, `${awayTeam.short || 'ВИН'} 48%`)
          ),
          el('div', { className: 'hero-winrate-track' },
            el('div', { className: 'winrate-fill-left', style: { width: '52%' } }),
            el('div', { className: 'winrate-fill-right', style: { width: '48%' } })
          )
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
        el('span', { className: 'hero-stat-chip' }, `Серия: ${homeTeam.short || 'ДЕТ'} (W3) vs ${awayTeam.short || 'ВИН'} (W5)`),
        el('span', { className: 'hero-stat-chip' }, 'Реализация PP: 24.6% / 27.1%')
      ),
      el('div', { className: 'hero-actions-right' },
        el('a', { href: matchUrl, className: 'hero-btn-cyan' },
          el('span', {}, 'Превью встречи'),
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
        ),
        el('a', { href: `${matchUrl}&tab=video`, className: 'hero-btn-glass' },
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'play_circle'),
          el('span', {}, 'Хайлайты')
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
function renderPlayerOfTheWeekWidget(container) {
  if (!container) return;
  const potwImgUrl = getAssetUrl('assets/images/player_of_the_week.jpg');

  const card = el('div', {
    className: 'player-of-the-week-card',
    style: {
      backgroundImage: `linear-gradient(180deg, rgba(11, 14, 20, 0.2) 0%, rgba(11, 14, 20, 0.75) 45%, rgba(11, 14, 20, 0.98) 100%), url('${potwImgUrl}')`
    }
  },
    el('div', { className: 'potw-header-badge' }, 'ИГРОК НЕДЕЛИ'),

    el('div', { className: 'potw-content' },
      el('div', { className: 'potw-label' }, 'ЛИДЕР БОМБАРДИРСКОЙ ГОНКИ'),
      el('h3', { className: 'potw-player-name' }, 'Александр Смирнов'),
      el('div', { className: 'potw-player-team' }, 'Нападающий первой тройки • ХК Звезда'),

      // 4 Stats Columns
      el('div', { className: 'potw-stats-grid' },
        el('div', { className: 'potw-stat-col' },
          el('div', { className: 'potw-stat-val font-tabular' }, '18'),
          el('div', { className: 'potw-stat-lbl' }, 'ГОЛЫ')
        ),
        el('div', { className: 'potw-stat-col' },
          el('div', { className: 'potw-stat-val font-tabular' }, '24'),
          el('div', { className: 'potw-stat-lbl' }, 'ПАСЫ')
        ),
        el('div', { className: 'potw-stat-col' },
          el('div', { className: 'potw-stat-val font-tabular text-cyan' }, '+14'),
          el('div', { className: 'potw-stat-lbl' }, '+/-')
        ),
        el('div', { className: 'potw-stat-col' },
          el('div', { className: 'potw-stat-val font-tabular text-gold' }, '1.45'),
          el('div', { className: 'potw-stat-lbl' }, 'ОЧ/ИГР')
        )
      ),

      // Goal Streak Bar
      el('div', { className: 'potw-streak-box' },
        el('div', { className: 'potw-streak-labels' },
          el('span', {}, 'Голевая серия'),
          el('span', { className: 'text-cyan' }, '7 матчей подряд')
        ),
        el('div', { className: 'potw-streak-track' },
          el('div', { className: 'potw-streak-fill', style: { width: '77%' } })
        ),
        el('div', { className: 'potw-record-note' }, 'Рекорд клуба: 9 матчей')
      ),

      // Action Button
      el('a', {
        href: buildLink('/player/', { id: 'khl:smirnov' }),
        className: 'potw-full-dossier-btn'
      },
        el('span', {}, 'Полное досье и тепловая карта бросков'),
        el('span', { className: 'material-symbols-outlined text-[16px]' }, 'show_chart')
      )
    )
  );

  container.replaceChildren(card);
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
  const card = qs('.home-featured-news-card');
  if (!card) return;
  try {
    const data = await getNews();
    const articles = data.news || [];
    if (!articles.length) return;
    const latest = articles[0];

    card.href = buildLink('/news/', { id: latest.id });
    const thumb = card.querySelector('.news-card-thumb');
    if (thumb && latest.image) {
      thumb.style.backgroundImage = `url('${getAssetUrl(latest.image)}')`;
    }
    const badge = card.querySelector('.news-exclusive-badge');
    if (badge) {
      badge.textContent = latest.tags?.[0] || 'ХОККЕЙ';
    }
    const timeEl = card.querySelector('.news-time');
    if (timeEl) {
      timeEl.textContent = `${formatDate(latest.publishedAt, 'dayMonth')} • ${latest.source || 'Чемпионат'}`;
    }
    const titleEl = card.querySelector('.news-card-title');
    if (titleEl) {
      titleEl.textContent = latest.title;
    }
  } catch (e) {
    console.warn('Failed to load home featured news:', e);
  }
}

