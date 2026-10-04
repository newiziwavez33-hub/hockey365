/**
 * Hockey365 Home Page Logic
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
let activeFilter = 'all'; // 'all', 'live', 'KHL', 'NHL'
let stopPolling = null;

let cachedCompetitions = [];
let cachedTeamsMap = { ...KNOWN_TEAMS };
let cachedMeta = null;

export async function initHomePage() {
  const datepickerContainer = qs('#datepicker-slot');
  const highlightBannerContainer = qs('#highlight-banner-slot');
  const matchesContainer = qs('#matches-slot');
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
  if (notice && cachedMeta?.updatedAt) notice.textContent = `Срез данных: ${formatDate(cachedMeta.updatedAt, 'full')}. Матчи не обновляются в реальном времени. КХЛ скрыта до подключения проверенного источника.`;

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
  window.addEventListener('popstate', () => {
    activeDate = getParam('date') || defaultDate;
    updateDateRibbon();
    loadMatchesForDate();
  });

  // Setup Filter Buttons
  const filterBtns = qs('#filter-pills');
  if (filterBtns) {
    filterBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      filterBtns.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
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

    for (const compId of Object.keys(grouped)) {
      const compInfo = cachedCompetitions.find(c => c.id === compId) || { name: compId, emblem: '' };
      const compMatches = grouped[compId];
      const compLetter = compId === 'KHL' ? 'К' : compId === 'NHL' ? 'N' : compId[0];

      const compCard = el('div', { className: 'comp-group-stitch' },
        el('div', { className: 'comp-header-stitch' },
          el('div', { className: 'comp-header-left' },
            el('div', { className: 'comp-badge-box' }, compLetter),
            el('div', {},
              el('div', { className: 'flex items-center gap-8' },
                el('h2', { className: 'comp-title-stitch' }, compInfo.name),
                el('span', { className: 'comp-sub-badge' }, 'Регулярный сезон')
              ),
              el('span', { className: 'comp-matches-count text-xs text-muted' }, `${compMatches.length} матчей в программе дня`)
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
        el('div', { className: 'comp-matches-list-stitch' },
          compMatches.map(m => createMatchRow(m, cachedTeamsMap))
        )
      );

      matchesContainer.appendChild(compCard);
    }
  }

  function renderDateEmptyState(date) {
    matchesContainer.innerHTML = '';
    const dateCounts = cachedMeta?.dateCounts || {};
    const card = el('div', { className: 'stitch-widget-card text-center', style: { padding: 'var(--space-32)' } },
      el('div', { className: 'text-lg font-headline', style: { marginBottom: 'var(--space-8)', color: 'var(--text-primary)' } }, `На дату ${date} матчи не запланированы`),
      el('p', { className: 'text-sm text-muted', style: { marginBottom: 'var(--space-16)' } }, 'Выберите игровой день с доступными матчами:'),
      el('div', { className: 'flex flex-wrap gap-8 justify-center' },
        availableDates.map(d => {
          const count = dateCounts[d] ? ` (${dateCounts[d]} игр)` : '';
          return el('button', {
            className: `day-btn ${d === activeDate ? 'active' : ''}`,
            style: { minWidth: '120px', padding: '8px 12px' },
            onClick: () => {
              activeDate = d;
              setParam('date', activeDate, true);
              updateDateRibbon();
              loadMatchesForDate();
            }
          },
            el('span', { className: 'day-name' }, 'ИГРОВОЙ ДЕНЬ'),
            el('span', { className: 'day-num font-tabular' }, `${d}${count}`)
          );
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
        latestMatches = [];
        if (highlightBannerContainer) highlightBannerContainer.replaceChildren();
        renderError(matchesContainer, 'Не удалось загрузить матчи выбранной даты', loadMatchesForDate);
        return;
      }

      latestMatches = matches || [];
      trackMatchUpdates(latestMatches, cachedTeamsMap);
      renderHighlightBanner(highlightBannerContainer, latestMatches);
      renderCurrentMatches();

      // Find suitable match for Daily Stats widget
      const statsCandidate = latestMatches.find(m => m.status === 'FINISHED' && m.stats) || latestMatches.find(m => m.stats);
      if (statsCandidate) {
        loadSidebarStats(sidebarStatsContainer, statsCandidate.id);
      } else {
        const card = qs('#sidebar-stats-card');
        if (card) card.style.display = 'none';
      }
    }, 10000);
  }

  loadMatchesForDate();

  // Load Sidebar Content
  loadSidebarNews(sidebarNewsContainer);
  loadSidebarStandings(sidebarStandingsContainer);
}

function renderHighlightBanner(container, matches) {
  if (!container) return;
  if (!matches || matches.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Find candidate: 1) LIVE, 2) OT/SO thriller, 3) FINISHED with most goals, 4) first match
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

  let badgeText = 'МАТЧ ДНЯ';
  let badgeClass = 'banner-badge-live';
  let statusDetail = '';
  let actionLabel = 'Смотреть протокол встречи';

  if (highlight.status === 'LIVE' || highlight.status === 'INTERMISSION') {
    badgeText = '🔴 LIVE МАТЧ В ИГРЕ';
    badgeClass = 'banner-badge-live';
    statusDetail = `${highlight.period}-й период (${highlight.clock || ''})`;
    actionLabel = 'Следить за матчем Live';
  } else if (highlight.status === 'FINISHED') {
    badgeText = highlight.finishedIn ? `МАТЧ ДНЯ (${highlight.finishedIn})` : 'МАТЧ ДНЯ ЗАВЕРШЕН';
    badgeClass = 'banner-badge-finished';
    statusDetail = highlight.finishedIn === 'OT' ? 'Победа в овертайме' : highlight.finishedIn === 'SO' ? 'Победа по буллитам' : 'Основное время';
  } else {
    badgeText = 'ГЛАВНЫЙ МАТЧ ДНЯ';
    badgeClass = 'banner-badge-scheduled';
    statusDetail = `Начало в ${formatDate(highlight.utcDate, 'time')}`;
    actionLabel = 'Превью встречи';
  }

  const scoreText = (highlight.status === 'SCHEDULED')
    ? 'vs'
    : `${highlight.home.score} : ${highlight.away.score}${highlight.finishedIn ? ' ' + highlight.finishedIn : ''}`;

  const heroImgUrl = getAssetUrl('assets/images/hero_banner.jpg');
  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

  container.replaceChildren(el('div', {
    className: 'highlight-banner-stitch',
    style: {
      backgroundImage: `linear-gradient(90deg, rgba(11, 14, 20, 0.94) 0%, rgba(20, 26, 35, 0.84) 55%, rgba(11, 14, 20, 0.72) 100%), url('${heroImgUrl}')`
    }
  },
    el('div', { className: 'banner-content-row' },
      el('div', { className: 'banner-left-wrap' },
        el('div', { className: `banner-badge ${badgeClass}` },
          badgeClass === 'banner-badge-live' ? el('span', { className: 'live-dot-pulse' }) : null,
          badgeText
        ),
        el('div', { className: 'flex items-center gap-12' },
          el('div', { className: 'banner-teams-logos flex items-center' },
            el('img', {
              src: homeInfo.logo ? getAssetUrl(homeInfo.logo) : defaultLogo,
              alt: homeInfo.name,
              className: 'banner-team-logo',
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('span', { className: 'text-xs text-muted mx-1' }, 'vs'),
            el('img', {
              src: awayInfo.logo ? getAssetUrl(awayInfo.logo) : defaultLogo,
              alt: awayInfo.name,
              className: 'banner-team-logo',
              onerror: (e) => { e.target.src = defaultLogo; }
            })
          ),
          el('p', { className: 'banner-headline' },
            `${homeInfo.name} `,
            highlight.status === 'SCHEDULED' ? 'против ' : '— ',
            `${awayInfo.name}: `,
            el('span', { className: 'banner-score font-tabular' }, scoreText)
          )
        )
      ),
      el('div', { className: 'banner-right-wrap' },
        el('span', { className: 'banner-status-detail text-muted text-xs' }, statusDetail),
        el('a', { href: buildLink('/match/', { id: highlight.id }), className: 'banner-action-link' },
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'play_circle'),
          el('span', {}, actionLabel),
          el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
        )
      )
    )
  ));
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

    if (card) card.style.display = 'block';

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

    const homeFo = s.faceoffPct?.[0];
    const awayFo = s.faceoffPct?.[1];

    const homePP = s.powerPlay?.[0] ?? '-';
    const awayPP = s.powerPlay?.[1] ?? '-';

    const statRow = (label, home, away, homeWidth, awayWidth) => el('div', { className: 'stat-metric-row' },
      el('div', { className: 'flex justify-between text-xs text-muted mb-1' },
        el('span', { className: 'font-bold text-text-primary' }, home),
        el('span', {}, label),
        el('span', { className: 'font-bold text-text-primary' }, away)
      ),
      homeWidth == null ? null : el('div', { className: 'stat-bar-track' },
        el('div', { className: 'stat-bar-fill-home', style: { width: `${homeWidth}%` } }),
        el('div', { className: 'stat-bar-fill-away', style: { width: `${awayWidth}%` } })
      )
    );

    container.replaceChildren(el('div', { className: 'flex flex-col gap-12' },
      statRow('Броски в створ', homeSog, awaySog, homeSogPct, awaySogPct),
      homeFo != null && awayFo != null ? statRow('Вбрасывания', `${homeFo}%`, `${awayFo}%`, homeFo, awayFo) : null,
      homePP !== '-' || awayPP !== '-' ? statRow('Реализация большинства', homePP, awayPP, 50, 50) : null,
      el('a', {
        href: buildLink('/match/', { id: match.id, tab: 'stats' }),
        className: 'stat-report-btn'
      }, 'Полный статистический отчёт')
    ));
  } catch (err) {
    if (card) card.style.display = 'none';
  }
}

async function loadSidebarNews(container) {
  if (!container) return;
  try {
    const data = await getNews();
    container.innerHTML = '';
    const items = (data.news || []).slice(0, 5);
    if (!items.length) {
      container.appendChild(el('p', { className: 'text-xs text-muted' }, 'Подтверждённых новостей пока нет.'));
      return;
    }
    for (const n of items) {
      const item = el('article', { className: 'news-item-stitch' },
        n.image ? el('a', { href: buildLink('/news/', { id: n.id }), className: 'news-item-thumb-wrap' },
          el('img', {
            src: getAssetUrl(n.image),
            alt: n.title,
            className: 'news-item-thumb',
            loading: 'lazy',
            onerror: (e) => { e.target.closest('.news-item-thumb-wrap')?.remove(); }
          })
        ) : null,
        el('div', { className: 'news-item-content' },
          el('div', { className: 'flex items-center gap-6 mb-1' },
            el('span', { className: 'news-badge-cat' }, n.tags?.[0] || 'КХЛ'),
            el('span', { className: 'text-xs text-muted' }, formatDate(n.publishedAt, 'timeAgo'))
          ),
          el('a', { href: buildLink('/news/', { id: n.id }), className: 'news-item-title' }, n.title),
          el('div', { className: 'news-item-source text-xs text-muted mt-1' }, n.source || 'Hockey365 • Новости')
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

    const miniTable = el('table', { className: 'standings-table-stitch w-full text-left' },
      el('thead', {},
        el('tr', { className: 'text-muted text-xs uppercase' },
          el('th', { className: 'py-1 text-center w-6' }, '№'),
          el('th', { className: 'py-1 pl-2' }, 'Команда'),
          el('th', { className: 'py-1 text-center w-6' }, 'И'),
          el('th', { className: 'py-1 text-center w-6' }, 'В'),
          el('th', { className: 'py-1 text-center w-6' }, 'П'),
          el('th', { className: 'py-1 text-right pr-1 w-8 font-bold' }, 'О')
        )
      ),
      el('tbody', { className: 'text-xs' },
        topRows.map((r, idx) => {
          const isTop = idx === 0;
          return el('tr', { className: 'hover:bg-surface-elevated transition-colors' },
            el('td', { className: 'py-2 text-center' },
              el('span', { className: isTop ? 'pos-badge-1 font-tabular' : 'pos-badge-default font-tabular' }, r.pos)
            ),
            el('td', { className: 'py-2 pl-2' },
              el('div', { className: 'flex items-center gap-6' },
                el('span', { className: 'playoff-dot' }),
                el('a', {
                  href: buildLink('/team/', { id: r.teamId }),
                  className: 'font-semibold text-text-primary hover:text-primary transition-colors'
                }, r.teamId.replace('khl:', '').toUpperCase())
              )
            ),
            el('td', { className: 'py-2 text-center text-text-secondary font-tabular' }, r.gp),
            el('td', { className: 'py-2 text-center text-muted font-tabular' }, r.w),
            el('td', { className: 'py-2 text-center text-muted font-tabular' }, r.l),
            el('td', { className: 'py-2 text-right pr-1 font-bold text-text-primary font-headline font-tabular' }, r.pts)
          );
        })
      )
    );

    const legend = el('div', { className: 'flex items-center justify-between text-xs text-muted mt-2 pt-2 border-t border-border-subtle' },
      el('div', { className: 'flex items-center gap-4' },
        el('span', { className: 'playoff-dot' }),
        el('span', {}, 'Зона плей-офф')
      ),
      el('a', { href: buildLink('/competition/', { id: 'KHL', tab: 'table' }), className: 'text-primary hover:underline' }, 'Вся таблица →')
    );

    container.appendChild(miniTable);
    container.appendChild(legend);
  } catch (e) {
    container.innerHTML = '<div class="text-xs text-muted">Таблица недоступна</div>';
  }
}

