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
  let badgeClass = 'badge-live';
  let statusDetail = '';
  let actionLabel = 'Открыть протокол матча →';

  if (highlight.status === 'LIVE' || highlight.status === 'INTERMISSION') {
    badgeText = 'В ИГРЕ НА МОМЕНТ СРЕЗА';
    statusDetail = `${highlight.period}-й период (${highlight.clock || ''})`;
    actionLabel = 'Открыть протокол матча →';
  } else if (highlight.status === 'FINISHED') {
    badgeText = highlight.finishedIn ? `МАТЧ ДНЯ (${highlight.finishedIn})` : 'МАТЧ ДНЯ ЗАВЕРШЕН';
    badgeClass = 'badge-finished';
    statusDetail = highlight.finishedIn === 'OT' ? 'Овертайм' : highlight.finishedIn === 'SO' ? 'Буллиты' : 'Финальная сирена';
  } else {
    badgeText = 'ГЛАВНЫЙ МАТЧ ДНЯ';
    badgeClass = 'badge-scheduled';
    statusDetail = `Начало в ${formatDate(highlight.utcDate, 'time')}`;
    actionLabel = 'Превью встречи →';
  }

  const scoreText = (highlight.status === 'SCHEDULED')
    ? 'vs'
    : `${highlight.home.score} : ${highlight.away.score}${highlight.finishedIn ? ' ' + highlight.finishedIn : ''}`;

  container.replaceChildren(el('div', { className: 'highlight-banner' },
    el('div', { className: 'flex flex-col md:flex-row md:items-center justify-between gap-12', style: { position: 'relative', zIndex: '2' } },
      el('div', { className: 'flex items-center gap-12 flex-wrap' },
        el('span', { className: `badge ${badgeClass}` }, badgeText),
        el('strong', {}, homeInfo.name, ` ${scoreText} `, awayInfo.name),
        el('span', { className: 'text-xs text-muted' }, `(${statusDetail})`)
      ),
      el('a', { href: buildLink('/match/', { id: highlight.id }), className: 'link-accent text-sm' }, actionLabel)
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

    const statRow = (label, home, away, homeWidth, awayWidth) => el('div', {},
      el('div', { className: 'flex justify-between text-xs text-muted' },
        el('span', { className: 'text-primary text-bold' }, home),
        el('span', {}, label),
        el('span', { className: 'text-primary text-bold' }, away)
      ),
      homeWidth == null ? null : el('div', { className: 'stat-bar-track' },
        el('div', { className: 'stat-bar-fill-home', style: { width: `${homeWidth}%` } }),
        el('div', { className: 'stat-bar-fill-away', style: { width: `${awayWidth}%` } })
      )
    );
    container.replaceChildren(el('div', { className: 'flex flex-col gap-16' },
      statRow('Броски в створ', homeSog, awaySog, homeSogPct, awaySogPct),
      homeFo != null && awayFo != null ? statRow('Вбрасывания', `${homeFo}%`, `${awayFo}%`, homeFo, awayFo) : null,
      homePP !== '-' || awayPP !== '-' ? statRow('Реализация большинства', homePP, awayPP) : null,
      el('a', { href: buildLink('/match/', { id: match.id, tab: 'stats' }), className: 'btn-primary text-xs' }, 'Полный статистический отчёт →')
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
