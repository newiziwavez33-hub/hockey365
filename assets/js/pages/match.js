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
      homeTeam = { name: match.home.id, short: match.home.id, logo: '' };
    }
    try {
      awayTeam = await getTeam(match.away.id);
    } catch {
      awayTeam = { name: match.away.id, short: match.away.id, logo: '' };
    }
  } catch (err) {
    renderError(contentSlot, 'Не удалось загрузить данные матча');
    return;
  }

  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');
  const available = await availablePlayerIds();

  function renderMatchHeader() {
    headerSlot.innerHTML = '';
    const arenaBg = getAssetUrl('assets/images/hero_banner.jpg');
    const headerCard = el('div', {
      className: 'card overflow-hidden',
      style: {
        backgroundImage: `linear-gradient(180deg, rgba(20, 26, 35, 0.9) 0%, rgba(11, 14, 20, 0.97) 100%), url('${arenaBg}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 35%'
      }
    },
      // Meta bar
      el('div', { className: 'card-header' },
        el('span', { className: 'text-xs text-muted' },
          `${match.compId} • ${formatDate(match.utcDate, 'full')} • ${match.arena || 'Арена'}`
        ),
        el('div', { className: 'flex items-center gap-8' },
          match.status === 'LIVE' ? el('span', { className: 'badge badge-live' }, el('span', { className: 'live-dot' }), formatPeriodStatus(match)) :
          el('span', { className: `badge ${match.status === 'FINISHED' ? 'badge-finished' : 'badge-scheduled'}` }, formatPeriodStatus(match))
        )
      ),
      // Teams and Score
      el('div', { className: 'card-body', style: { padding: '24px 16px' } },
        el('div', { className: 'flex items-center justify-between gap-16' },
          // Home Team
          el('div', { className: 'flex flex-col items-center flex-1 text-center' },
            el('img', {
              src: homeTeam.logo ? getAssetUrl(homeTeam.logo) : defaultLogo,
              alt: homeTeam.name,
              style: { width: '64px', height: '64px', objectFit: 'contain', marginBottom: '8px' },
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('a', { href: buildLink('/team/', { id: match.home.id }), className: 'text-lg text-bold link-accent' },
              homeTeam.name
            ),
            el('div', { className: 'text-xs text-muted' }, homeTeam.city || '')
          ),

          // Big Score
          el('div', { className: 'flex flex-col items-center justify-center' },
            el('div', { className: 'text-3xl text-bold', style: { letterSpacing: '2px' } },
              formatScore(match.home.score, match.away.score, match.status)
            ),
            match.finishedIn ? el('div', { className: 'badge badge-scheduled', style: { marginTop: '6px' } },
              match.finishedIn === 'OT' ? 'Овертайм' : match.finishedIn === 'SO' ? 'Буллиты' : ''
            ) : null
          ),

          // Away Team
          el('div', { className: 'flex flex-col items-center flex-1 text-center' },
            el('img', {
              src: awayTeam.logo ? getAssetUrl(awayTeam.logo) : defaultLogo,
              alt: awayTeam.name,
              style: { width: '64px', height: '64px', objectFit: 'contain', marginBottom: '8px' },
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('a', { href: buildLink('/team/', { id: match.away.id }), className: 'text-lg text-bold link-accent' },
              awayTeam.name
            ),
            el('div', { className: 'text-xs text-muted' }, awayTeam.city || '')
          )
        ),

        // Period Scores Table
        renderPeriodBreakdownTable(match, homeTeam, awayTeam)
      )
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

  function renderTabNav() {
    tabsSlot.innerHTML = '';
    tabsSlot.appendChild(createTabs(tabsConfig, activeTab, (newTab) => {
      activeTab = newTab;
      setParam('tab', activeTab, true);
      renderTabNav();
      renderTabBody();
    }));
  }

  renderTabNav();

  function renderTabBody() {
    contentSlot.innerHTML = '';
    contentSlot.id = `tab-pane-${activeTab}`;
    contentSlot.setAttribute('role', 'tabpanel');
    contentSlot.setAttribute('aria-labelledby', `tab-btn-${activeTab}`);

    if (activeTab === 'events') {
      renderEventsTab(contentSlot, match, available);
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
  const hPeriods = match.home.periods || [];
  const aPeriods = match.away.periods || [];
  if (hPeriods.length === 0) return el('div');

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

  return el('div', { className: 'card', style: { marginTop: '16px', border: 'none', background: 'var(--color-bg-secondary)' } },
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
          el('td', { style: { textAlign: 'left', fontWeight: '500' } }, homeTeam.short || homeTeam.name),
          tdHome,
          el('td', { style: { fontWeight: 'bold' } }, match.home.score ?? '-')
        ),
        el('tr', {},
          el('td', { style: { textAlign: 'left', fontWeight: '500' } }, awayTeam.short || awayTeam.name),
          tdAway,
          el('td', { style: { fontWeight: 'bold' } }, match.away.score ?? '-')
        )
      )
    )
  );
}

function renderEventsTab(container, match, available) {
  if (!match.events || match.events.length === 0) {
    renderEmpty(container, 'События в матче пока отсутствуют.');
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
