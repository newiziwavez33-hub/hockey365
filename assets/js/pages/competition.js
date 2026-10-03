/**
 * Hockey365 Competition Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getCompetitions, getStandings, getPlayoffs, getLeaders, getMatchesByDate, getMeta } from '../core/api.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createStandingsTable } from '../components/standings-table.js';
import { createPlayoffBracket } from '../components/playoff-bracket.js';
import { createTabs } from '../components/tabs.js';
import { createMatchRow, KNOWN_TEAMS } from '../components/match-row.js';
import { getAssetUrl } from '../core/config.js';
import { getTodayISODate, formatSavePct, formatGAA } from '../core/format.js';
import { availablePlayerIds, playerName } from '../core/profile-links.js';
import { createDatepicker } from '../components/datepicker.js';

export async function initCompetitionPage() {
  const compId = getParam('id') || 'KHL';
  let activeTab = getParam('tab') || 'table';
  let activeSeason = getParam('season') || '2026/27';
  let calendarDate = getParam('date');
  let tabRequest = 0;
  if (!['table', 'playoff', 'leaders', 'calendar'].includes(activeTab)) activeTab = 'table';

  const titleSlot = qs('#comp-title-slot');
  const tabsSlot = qs('#comp-tabs-slot');
  const contentSlot = qs('#comp-content-slot');

  renderLoading(contentSlot, 4);

  let compInfo = null;
  try {
    const all = await getCompetitions();
    compInfo = all.find(c => c.id === compId);
  } catch (e) {
    console.error(e);
  }

  if (!compInfo) {
    renderError(contentSlot, 'Соревнование не найдено');
    return;
  }
  const meta = await getMeta().catch(() => null);
  const unavailableSource = meta?.unverifiedCompetitions?.includes(compId);
  if (!compInfo.seasons?.includes(activeSeason)) activeSeason = compInfo.currentSeason;

  // Render Comp Header
  titleSlot.innerHTML = '';
  titleSlot.appendChild(
    el('div', { className: 'flex items-center justify-between flex-wrap gap-12' },
      el('div', { className: 'flex items-center gap-12' },
        compInfo.emblem ? el('img', { src: getAssetUrl(compInfo.emblem), alt: compInfo.name, style: { width: '44px', height: '44px', objectFit: 'contain' } }) : null,
        el('div', {},
          el('h1', { className: 'text-2xl text-bold' }, compInfo.name),
          el('div', { className: 'text-xs text-muted' }, `${compInfo.nameEn || ''} • Сезон ${activeSeason}`)
        )
      ),
      el('div', { className: 'badge badge-scheduled' },
        `Правила: ${compInfo.pointsRule}`
      )
    )
  );
  if (unavailableSource) titleSlot.appendChild(el('p', { className: 'card text-muted', style: { padding: '12px' } },
    'Результаты и статистика этой лиги скрыты: проверенный источник данных пока не подключён.'));

  const tabsConfig = [
    { id: 'table', label: 'Таблицы' },
    { id: 'playoff', label: 'Сетка плей-офф' },
    { id: 'leaders', label: 'Бомбардиры и вратари' },
    { id: 'calendar', label: 'Календарь матчей' }
  ];

  function renderTabNav() {
    tabsSlot.innerHTML = '';
    tabsSlot.appendChild(createTabs(tabsConfig, activeTab, (newTab) => {
      activeTab = newTab;
      setParam('tab', activeTab, true);
      renderTabNav();
      loadTabContent();
    }));
  }

  renderTabNav();

  async function loadTabContent() {
    const request = ++tabRequest;
    renderLoading(contentSlot, 3);
    contentSlot.id = `tab-pane-${activeTab}`;
    contentSlot.setAttribute('role', 'tabpanel');
    contentSlot.setAttribute('aria-labelledby', `tab-btn-${activeTab}`);

    try {
      if (activeTab === 'table') {
        const standingsData = await getStandings(compId, activeSeason);
        if (request !== tabRequest) return;
        contentSlot.innerHTML = '';
        if (!standingsData || !standingsData.groups || standingsData.groups.length === 0) {
          renderEmpty(contentSlot, unavailableSource ? 'Таблицы скрыты до подключения проверенного источника.' : 'Таблицы для данного турнира пока не сформированы.');
          return;
        }
        for (const grp of standingsData.groups) {
          contentSlot.appendChild(createStandingsTable(grp));
        }
      } else if (activeTab === 'playoff') {
        contentSlot.innerHTML = '';
        try {
          const poData = await getPlayoffs(compId, activeSeason);
          if (request !== tabRequest) return;
          if (poData && poData.rounds && poData.rounds.length > 0) {
            contentSlot.appendChild(el('p', { className: 'text-xs text-muted' }, 'Сетка из сохранённого статического файла; актуальность результатов не подтверждена прямой трансляцией.'));
            contentSlot.appendChild(createPlayoffBracket(poData));
          } else {
            renderEmpty(contentSlot, 'Сетка плей-офф еще не стартовала.');
          }
        } catch (e) {
          renderEmpty(contentSlot, 'Сетка плей-офф еще не сформирована.');
        }
      } else if (activeTab === 'leaders') {
        contentSlot.innerHTML = '';
        try {
          const lData = await getLeaders(compId, activeSeason);
          const available = await availablePlayerIds();
          if (request !== tabRequest) return;
          renderLeaders(contentSlot, lData, available);
        } catch (e) {
          renderEmpty(contentSlot, 'Статистика лидеров обновляется.');
        }
      } else if (activeTab === 'calendar') {
        contentSlot.innerHTML = '';
        let targetDate = calendarDate || getTodayISODate();
        let dates = [];
        try {
          const meta = await getMeta();
          dates = meta?.availableDates || [];
          if (!calendarDate && !dates.includes(targetDate)) targetDate = meta.activeDate || dates[0] || targetDate;
        } catch (e) {}
        if (request !== tabRequest) return;
        const dateSlot = el('div', {}, createDatepicker(targetDate, date => {
          calendarDate = date;
          setParam('date', date, true);
          loadTabContent();
        }));
        contentSlot.appendChild(dateSlot);
        if (!dates.includes(targetDate)) {
          contentSlot.appendChild(el('p', { className: 'card text-muted' }, `За ${targetDate} сохранённого игрового дня нет. Доступные даты: ${dates.join(', ') || 'не указаны'}.`));
          return;
        }
        const matches = await getMatchesByDate(targetDate);
        if (request !== tabRequest) return;

        const compMatches = (matches || []).filter(m => m.compId === compId);
        if (compMatches.length === 0) {
          contentSlot.appendChild(el('p', { className: 'card text-muted' }, `На ${targetDate} матчей ${compInfo.name} в сохранённом срезе нет.`));
        } else {
          const list = el('div', { className: 'card' },
            el('div', { className: 'card-header' },
              el('h3', { className: 'card-title' }, `Матчи ${compInfo.name} за ${targetDate}`)
            ),
            el('div', { className: 'comp-matches-list' },
              compMatches.map(m => createMatchRow(m))
            )
          );
          contentSlot.appendChild(list);
        }
      }
    } catch (err) {
      if (request === tabRequest) renderError(contentSlot, 'Не удалось загрузить раздел турнира', loadTabContent);
    }
  }

  loadTabContent();
}

function renderLeaders(container, lData, available) {
  if (!lData || !lData.categories) {
    renderEmpty(container, 'Данные лидеров отсутствуют');
    return;
  }

  const grid = el('div', { className: 'layout-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } });

  function renderCategoryCard(title, rows, valFormatter) {
    if (!rows || rows.length === 0) return null;
    const card = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h4', { className: 'card-title' }, title)
      ),
      el('table', { className: 'standings-table text-xs' },
        el('thead', {},
          el('tr', {},
            el('th', { style: { width: '28px' } }, '№'),
            el('th', { style: { textAlign: 'left' } }, 'Игрок'),
            el('th', { style: { textAlign: 'right' } }, 'Показ.')
          )
        ),
        el('tbody', {},
          rows.map((r, idx) => {
            const team = KNOWN_TEAMS[r.teamId] || {};
            return el('tr', {},
              el('td', { style: { color: 'var(--text-muted)' } }, idx + 1),
              el('td', { style: { textAlign: 'left' } },
                el('div', { className: 'flex items-center gap-8' },
                  team.logo ? el('img', { 
                    src: getAssetUrl(team.logo), 
                    alt: team.name || '', 
                    style: { width: '18px', height: '18px', objectFit: 'contain', flexShrink: '0' } 
                  }) : null,
                  playerName(r.playerId, r.playerName, available),
                  team.short ? el('span', { className: 'text-xs text-muted' }, team.short) : null
                )
              ),
              el('td', { style: { textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-light)' } }, valFormatter ? valFormatter(r.value) : r.value)
            );
          })
        )
      )
    );
    return card;
  }

  const ptsCard = renderCategoryCard('Бомбардиры (Очки: Г+П)', lData.categories.points);
  const goalsCard = renderCategoryCard('Снайперы (Голы)', lData.categories.goals);
  const assistsCard = renderCategoryCard('Ассистенты (Передачи)', lData.categories.assists);
  const gaaCard = renderCategoryCard('Вратари: Коэфф. надёжности (КН)', lData.categories.gaa, formatGAA);
  const svCard = renderCategoryCard('Вратари: % отражённых бросков', lData.categories.svPct, formatSavePct);

  if (ptsCard) grid.appendChild(ptsCard);
  if (goalsCard) grid.appendChild(goalsCard);
  if (assistsCard) grid.appendChild(assistsCard);
  if (gaaCard) grid.appendChild(gaaCard);
  if (svCard) grid.appendChild(svCard);

  container.appendChild(grid);
}
