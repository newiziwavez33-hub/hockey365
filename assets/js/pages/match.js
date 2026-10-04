/**
 * Hockey365 Match Details Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getMatch, getTeam, startMatchPolling } from '../core/api.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createTabs } from '../components/tabs.js';
import { createLinesBoard } from '../components/lines-board.js';
import { createRinkSvg } from '../components/rink-svg.js';
import { getAssetUrl } from '../core/config.js';
import { formatScore, formatPeriodStatus, formatDate } from '../core/format.js';
import { availablePlayerIds, playerName } from '../core/profile-links.js';
import { playGoalHorn } from '../core/sound.js';
import { showGoalToast } from '../core/live-tracker.js';
import { KNOWN_TEAMS, getTeamMeta } from '../components/match-row.js';

export async function initMatchPage() {
  const matchId = getParam('id');
  let activeTab = getParam('tab') || 'events';
  if (!['events', 'lineups', 'stats', 'rink', 'info'].includes(activeTab)) activeTab = 'events';

  const headerSlot = qs('#match-header-slot');
  const tabsSlot = qs('#match-tabs-slot');
  const contentSlot = qs('#match-tab-content-slot');

  if (!matchId) {
    renderError(contentSlot, 'Идентификатор матча не указан');
    return;
  }

  renderLoading(headerSlot, 2);
  renderLoading(contentSlot, 4);

  let match = null;
  let homeTeam = null;
  let awayTeam = null;

  try {
    match = await getMatch(matchId);
    try {
      homeTeam = await getTeam(match.home.id);
    } catch {
      homeTeam = getTeamMeta(match.home.id);
    }
    try {
      awayTeam = await getTeam(match.away.id);
    } catch {
      awayTeam = getTeamMeta(match.away.id);
    }
    const homeMeta = getTeamMeta(match.home.id);
    const awayMeta = getTeamMeta(match.away.id);
    if (!homeTeam.logo) homeTeam.logo = homeMeta.logo;
    if (!awayTeam.logo) awayTeam.logo = awayMeta.logo;
    if (!homeTeam.name || homeTeam.name === match.home.id) homeTeam.name = homeMeta.name;
    if (!awayTeam.name || awayTeam.name === match.away.id) awayTeam.name = awayMeta.name;
    if (!homeTeam.short) homeTeam.short = homeMeta.short;
    if (!awayTeam.short) awayTeam.short = awayMeta.short;
  } catch (err) {
    renderError(contentSlot, 'Не удалось загрузить данные матча');
    return;
  }

  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');
  const available = await availablePlayerIds();

  function renderMatchHeader() {
    headerSlot.innerHTML = '';
    const arenaBg = getAssetUrl('assets/images/hero_banner.jpg');
    const isLive = match.status === 'LIVE' || match.status === 'INTERMISSION';
    const isFinished = match.status === 'FINISHED';
    const isScheduled = match.status === 'SCHEDULED';

    // Comp badge text
    const compText = match.compId === 'NHL' ? 'НХЛ • РЕГУЛЯРНЫЙ СЕЗОН' :
                     match.compId === 'KHL' ? 'КХЛ • РЕГУЛЯРНЫЙ ЧЕМПИОНАТ' :
                     `${match.compId || 'ХОККЕЙ'} • РЕГУЛЯРНЫЙ СЕЗОН`;

    // Status Pill
    let statusClass = 'status-scheduled';
    let statusLabel = '';
    if (isLive) {
      statusClass = 'status-live';
      statusLabel = formatPeriodStatus(match);
    } else if (isFinished) {
      statusClass = 'status-finished';
      const note = match.finishedIn === 'OT' ? ' (ОТ)' : match.finishedIn === 'SO' ? ' (Б)' : '';
      statusLabel = `МАТЧ ЗАВЕРШЕН${note}`;
    } else {
      statusClass = 'status-scheduled';
      const timeStr = match.utcDate
        ? new Date(match.utcDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
        : '20:00';
      statusLabel = `НАЧАЛО В ${timeStr} МСК`;
    }

    const arenaName = match.arena || (match.compId === 'NHL' ? 'Little Caesars Arena, Детройт' : 'Ледовая Арена');

    // Center display
    const centerLabel = isScheduled ? 'СТАРТОВОЕ ВБРАСЫВАНИЕ' : (isLive ? 'ТЕКУЩИЙ СЧЕТ' : 'ИТОГОВЫЙ СЧЕТ');
    const homeScoreVal = isScheduled ? '-' : (match.home.score ?? 0);
    const awayScoreVal = isScheduled ? '-' : (match.away.score ?? 0);
    const dateSubText = match.utcDate ? `${formatDate(match.utcDate, 'full')} • ${new Date(match.utcDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })} МСК` : 'Сегодня • 20:00 МСК';

    // Subtitles (e.g. "Detroit • Red Wings" or city)
    const homeSub = homeTeam.nameEn || homeTeam.city || (homeTeam.short || '');
    const awaySub = awayTeam.nameEn || awayTeam.city || (awayTeam.short || '');

    const headerCard = el('div', {
      className: 'match-hero-card',
      style: {
        backgroundImage: `linear-gradient(180deg, rgba(20, 26, 35, 0.88) 0%, rgba(11, 14, 20, 0.98) 100%), url('${arenaBg}')`
      }
    },
      // Top League & Meta Bar
      el('div', { className: 'match-hero-topbar' },
        el('div', { className: 'match-hero-badges' },
          el('span', { className: 'match-comp-pill' }, compText),
          el('span', { className: 'match-arena-pill' },
            el('span', { className: 'material-symbols-outlined' }, 'location_on'),
            arenaName
          )
        ),
        el('div', { className: 'match-hero-status' },
          el('span', { className: `hero-status-pill ${statusClass}` },
            el('span', { className: 'status-indicator-dot' }),
            statusLabel
          )
        )
      ),

      // Teams Showcase
      el('div', { className: 'match-hero-showcase' },
        // Home Team
        el('a', {
          href: buildLink('/team/', { id: match.home.id }),
          className: 'match-hero-team team-home'
        },
          el('div', { className: 'hero-team-emblem-wrap' },
            el('img', {
              src: homeTeam.logo ? getAssetUrl(homeTeam.logo) : defaultLogo,
              alt: homeTeam.name,
              className: 'hero-team-logo',
              loading: 'lazy',
              onerror: (e) => { e.target.src = defaultLogo; }
            })
          ),
          el('div', { className: 'hero-team-info' },
            el('h1', { className: 'hero-team-title' }, homeTeam.name),
            el('span', { className: 'hero-team-city' }, homeSub)
          )
        ),

        // Center Score / Faceoff Hub
        el('div', { className: 'match-hero-center' },
          el('div', { className: 'hero-center-label' }, centerLabel),
          el('div', { className: 'hero-center-score font-tabular' },
            el('span', { className: 'score-num' }, homeScoreVal),
            el('span', { className: 'score-colon' }, ':'),
            el('span', { className: 'score-num' }, awayScoreVal)
          ),
          el('div', { className: 'hero-date-sub' }, dateSubText)
        ),

        // Away Team
        el('a', {
          href: buildLink('/team/', { id: match.away.id }),
          className: 'match-hero-team team-away'
        },
          el('div', { className: 'hero-team-info text-right' },
            el('h1', { className: 'hero-team-title' }, awayTeam.name),
            el('span', { className: 'hero-team-city' }, awaySub)
          ),
          el('div', { className: 'hero-team-emblem-wrap' },
            el('img', {
              src: awayTeam.logo ? getAssetUrl(awayTeam.logo) : defaultLogo,
              alt: awayTeam.name,
              className: 'hero-team-logo',
              loading: 'lazy',
              onerror: (e) => { e.target.src = defaultLogo; }
            })
          )
        )
      ),

      // Period Breakdown Table (if available)
      renderPeriodBreakdownTable(match, homeTeam, awayTeam)
    );

    headerSlot.appendChild(headerCard);
  }

  renderMatchHeader();

  // Tabs
  const tabsConfig = [
    { id: 'events', label: 'Обзор и события' },
    { id: 'lineups', label: 'Составы (Пятёрки)' },
    { id: 'stats', label: 'Статистика матча' },
    { id: 'rink', label: 'Площадка' },
    { id: 'info', label: 'Судьи и арена' }
  ];

  function switchTab(newTab) {
    activeTab = newTab;
    setParam('tab', activeTab, true);
    renderTabNav();
    renderTabBody();
  }

  function renderTabNav() {
    tabsSlot.innerHTML = '';
    tabsSlot.appendChild(createTabs(tabsConfig, activeTab, switchTab));
  }

  renderTabNav();

  function renderTabBody() {
    contentSlot.innerHTML = '';
    contentSlot.id = `tab-pane-${activeTab}`;
    contentSlot.setAttribute('role', 'tabpanel');
    contentSlot.setAttribute('aria-labelledby', `tab-btn-${activeTab}`);

    if (activeTab === 'events') {
      renderEventsTab(contentSlot, match, available, switchTab);
    } else if (activeTab === 'lineups') {
      renderLineupsTab(contentSlot, match, homeTeam, awayTeam, available);
    } else if (activeTab === 'stats') {
      renderStatsTab(contentSlot, match, homeTeam, awayTeam);
    } else if (activeTab === 'rink') {
      contentSlot.appendChild(createRinkSvg(match.events || []));
    } else if (activeTab === 'info') {
      renderInfoTab(contentSlot, match);
    }
  }

  renderTabBody();

  // Real-time live polling for active/scheduled matches
  if (match.status !== 'FINISHED') {
    const stopPolling = startMatchPolling(matchId, (err, updated) => {
      if (err || !updated) return;

      const oldHome = Number(match.home?.score ?? 0);
      const oldAway = Number(match.away?.score ?? 0);
      const newHome = Number(updated.home?.score ?? 0);
      const newAway = Number(updated.away?.score ?? 0);

      if (newHome > oldHome || newAway > oldAway) {
        playGoalHorn();
        showGoalToast({
          match: updated,
          teamScored: newHome > oldHome ? homeTeam.name : awayTeam.name,
          homeScore: newHome,
          awayScore: newAway,
          homeName: homeTeam.name,
          awayName: awayTeam.name
        });
      }

      match = updated;
      renderMatchHeader();
      renderTabBody();
    }, 10000);

    window.addEventListener('beforeunload', () => stopPolling());
  }
}

function renderPeriodBreakdownTable(match, homeTeam, awayTeam) {
  const hPeriods = match.home?.periods || [];
  const aPeriods = match.away?.periods || [];
  if (hPeriods.length === 0) return null;

  const count = Math.max(hPeriods.length, aPeriods.length);
  const thCols = [];
  const tdHome = [];
  const tdAway = [];

  for (let i = 0; i < count; i++) {
    const periodName = i === 3 ? 'ОТ' : i === 4 ? 'Б' : `${i + 1}`;
    thCols.push(el('th', {}, periodName));
    tdHome.push(el('td', {}, hPeriods[i] ?? '-'));
    tdAway.push(el('td', {}, aPeriods[i] ?? '-'));
  }

  return el('div', {
    className: 'match-periods-wrap',
    style: {
      marginTop: '20px',
      background: 'rgba(20, 26, 35, 0.65)',
      borderRadius: '12px',
      border: '1px solid var(--border-glass)',
      overflow: 'hidden'
    }
  },
    el('table', { className: 'period-table' },
      el('thead', {},
        el('tr', {},
          el('th', { style: { textAlign: 'left' } }, 'Период'),
          thCols,
          el('th', { style: { fontWeight: 'bold' } }, 'Всего')
        )
      ),
      el('tbody', {},
        el('tr', {},
          el('td', { style: { textAlign: 'left', fontWeight: '600' } }, homeTeam.short || homeTeam.name),
          tdHome,
          el('td', { style: { fontWeight: 'bold', color: 'var(--text-primary)' } }, match.home?.score ?? '-')
        ),
        el('tr', {},
          el('td', { style: { textAlign: 'left', fontWeight: '600' } }, awayTeam.short || awayTeam.name),
          tdAway,
          el('td', { style: { fontWeight: 'bold', color: 'var(--text-primary)' } }, match.away?.score ?? '-')
        )
      )
    )
  );
}

function renderEventsTab(container, match, available, switchTab = null) {
  if (!match.events || match.events.length === 0) {
    const timeStr = match.utcDate
      ? new Date(match.utcDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
      : '20:00';
    const arenaStr = match.arena || (match.compId === 'NHL' ? 'Little Caesars Arena, Детройт' : 'Ледовая Арена');
    const compName = match.compId || 'КХЛ / НХЛ';

    const hub = el('div', { className: 'prematch-hub-card' },
      // Glowing Ice Icon Ring
      el('div', { className: 'prematch-icon-halo' },
        el('span', { className: 'material-symbols-outlined' }, 'schedule')
      ),

      // Pre-Match Status Heading
      el('div', { className: 'prematch-header-block' },
        el('div', { className: 'prematch-live-tag' },
          el('span', { className: 'prematch-pulse-dot' }),
          el('span', {}, 'ОЖИДАНИЕ СТАРТОВОГО ВБРАСЫВАНИЯ')
        ),
        el('h3', { className: 'prematch-title' }, `Матч начнется в ${timeStr} по московскому времени`),
        el('p', { className: 'prematch-description' },
          'События появятся здесь в реальном времени сразу после стартового свистка. Арена ',
          el('span', { className: 'highlight-text' }, arenaStr),
          ' готова к игре, команды завершают разминку на льду.'
        )
      ),

      // Contextual Pre-Match Badges Grid
      el('div', { className: 'prematch-details-grid' },
        el('div', { className: 'prematch-detail-box' },
          el('span', { className: 'material-symbols-outlined' }, 'stadium'),
          el('div', { className: 'detail-texts' },
            el('span', { className: 'detail-label' }, 'Место проведения'),
            el('span', { className: 'detail-value' }, arenaStr)
          )
        ),
        el('div', { className: 'prematch-detail-box' },
          el('span', { className: 'material-symbols-outlined' }, 'gavel'),
          el('div', { className: 'detail-texts' },
            el('span', { className: 'detail-label' }, 'Судейская бригада'),
            el('span', { className: 'detail-value' }, `Назначена • Официальный протокол ${compName}`)
          )
        ),
        el('div', { className: 'prematch-detail-box' },
          el('span', { className: 'material-symbols-outlined' }, 'sensors'),
          el('div', { className: 'detail-texts' },
            el('span', { className: 'detail-label' }, 'Телеметрия матча'),
            el('span', { className: 'detail-value text-cyan' }, 'Live-трекинг бросков активен')
          )
        )
      ),

      // Action CTAs for Instant Pre-Game Exploration
      el('div', { className: 'prematch-actions-row' },
        el('button', {
          type: 'button',
          className: 'prematch-action-btn',
          onClick: () => switchTab && switchTab('lineups')
        },
          el('span', { className: 'material-symbols-outlined' }, 'groups'),
          el('span', {}, 'Посмотреть составы (Пятёрки)')
        ),
        el('button', {
          type: 'button',
          className: 'prematch-action-btn',
          onClick: () => switchTab && switchTab('stats')
        },
          el('span', { className: 'material-symbols-outlined' }, 'analytics'),
          el('span', {}, 'H2H и статистика сезона')
        ),
        el('button', {
          type: 'button',
          className: 'prematch-action-btn',
          onClick: () => switchTab && switchTab('rink')
        },
          el('span', { className: 'material-symbols-outlined' }, 'sports_hockey'),
          el('span', {}, 'Схема ледовой площадки')
        )
      )
    );

    container.appendChild(hub);
    return;
  }

  const card = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, 'Хроника событий матча')
    ),
    el('div', { className: 'card-body' },
      el('div', { className: 'flex-col gap-12' },
        match.events.map(ev => {
          const isGoal = ev.type === 'GOAL';
          const isPenalty = ev.type === 'PENALTY';
          const isShootout = ev.type === 'SHOOTOUT';

          let typeBadgeClass = 'badge-scheduled';
          let typeLabel = ev.type;
          if (isGoal) {
            typeBadgeClass = 'badge-live';
            typeLabel = `ГОЛ (${ev.strength || 'EV'})`;
          } else if (isPenalty) {
            typeBadgeClass = 'badge-finished';
            typeLabel = `УДАЛЕНИЕ (${ev.minutes || 2} мин)`;
          } else if (isShootout) {
            typeBadgeClass = 'badge-scheduled';
            typeLabel = 'БУЛЛИТ';
          }

          return el('div', {
            className: 'flex items-center justify-between gap-12',
            style: { padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }
          },
            el('div', { className: 'flex items-center gap-12' },
              el('span', { className: 'text-xs text-muted text-bold', style: { width: '45px' } },
                ev.period ? `${ev.period}п ${ev.time || ''}` : ev.time || ''
              ),
              el('span', { className: `badge ${typeBadgeClass}` }, typeLabel),
              el('div', {},
                el('div', { className: 'text-sm text-bold' },
                  playerName(ev.playerId, ev.playerName, available),
                  ev.score ? ` — ${ev.score}` : ''
                ),
                ev.assists && ev.assists.length > 0 ? el('div', { className: 'text-xs text-muted' },
                  `Передачи: ${ev.assists.join(', ')}`
                ) : null,
                ev.reason ? el('div', { className: 'text-xs text-muted' }, `Причина: ${ev.reason}`) : null
              )
            ),
            el('div', { className: 'text-xs text-secondary text-bold' },
              ev.team ? ev.team.toUpperCase() : ''
            )
          );
        })
      )
    )
  );

  container.appendChild(card);
}

function renderLineupsTab(container, match, homeTeam, awayTeam, available) {
  if (!match.lineups || (!match.lineups.home && !match.lineups.away)) {
    renderEmpty(container, 'Составы на этот матч пока не объявлены.');
    return;
  }

  const grid = el('div', { className: 'layout-grid' });
  if (match.lineups.home) {
    grid.appendChild(createLinesBoard(homeTeam.name, match.lineups.home, available));
  }
  if (match.lineups.away) {
    grid.appendChild(createLinesBoard(awayTeam.name, match.lineups.away, available));
  }
  container.appendChild(grid);
}

function renderStatsTab(container, match, homeTeam, awayTeam) {
  if (!match.stats) {
    renderEmpty(container, 'Статистика матча еще формируется.');
    return;
  }

  const s = match.stats;
  const statDefs = [
    { label: 'Броски по воротам', key: 'shots' },
    { label: 'Броски в створ', key: 'shotsOnGoal' },
    { label: 'Силовые приёмы (Хиты)', key: 'hits' },
    { label: 'Блокированные броски', key: 'blocks' },
    { label: 'Вбрасывания (%)', key: 'faceoffPct', isPct: true },
    { label: 'Штрафное время (мин)', key: 'pim' },
    { label: 'Реализация большинства', key: 'powerPlay', isText: true },
    { label: 'Перехваты', key: 'takeaways' },
    { label: 'Потери', key: 'giveaways' }
  ];

  const statRows = statDefs.map(def => {
    const val = s[def.key];
    if (!val || val.length < 2) return null;

    const valHome = val[0];
    const valAway = val[1];

    let fillHome = 50;
    let fillAway = 50;
    if (!def.isText) {
      const sum = Number(valHome) + Number(valAway);
      if (sum > 0) {
        fillHome = (Number(valHome) / sum) * 100;
        fillAway = (Number(valAway) / sum) * 100;
      }
    }

    return el('div', { className: 'stat-row' },
      el('div', { className: 'stat-labels' },
        el('span', {}, String(valHome) + (def.isPct ? '%' : '')),
        el('span', { className: 'text-muted' }, def.label),
        el('span', {}, String(valAway) + (def.isPct ? '%' : ''))
      ),
      !def.isText ? el('div', { className: 'stat-bar-track' },
        el('div', { className: 'stat-fill-home', style: { width: `${fillHome}%` } }),
        el('div', { className: 'stat-fill-away', style: { width: `${fillAway}%` } })
      ) : null
    );
  }).filter(Boolean);

  const card = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, 'Командная статистика матча')
    ),
    el('div', { className: 'card-body' }, statRows)
  );

  container.appendChild(card);
}

function renderInfoTab(container, match) {
  const officials = match.officials || {};
  const refs = officials.referees || [];
  const linesmen = officials.linesmen || [];

  const card = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, 'Информация о матче')
    ),
    el('div', { className: 'card-body flex-col gap-12 text-sm' },
      el('div', {}, el('strong', {}, 'Арена: '), match.arena || 'Не указана'),
      el('div', {}, el('strong', {}, 'Главные судьи: '), refs.length > 0 ? refs.join(', ') : 'Не назначены'),
      el('div', {}, el('strong', {}, 'Линейные судьи: '), linesmen.length > 0 ? linesmen.join(', ') : 'Не назначены'),
      el('div', {}, el('strong', {}, 'Турнир: '), match.compId, ` (${match.season})`)
    )
  );
  container.appendChild(card);
}
