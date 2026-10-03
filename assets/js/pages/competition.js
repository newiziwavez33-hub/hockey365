/**
 * Hockey365 Competition Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getCompetitions, getStandings, getPlayoffs, getLeaders, getMatchesByDate } from '../core/api.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { createStandingsTable } from '../components/standings-table.js';
import { createPlayoffBracket } from '../components/playoff-bracket.js';
import { createTabs } from '../components/tabs.js';
import { createMatchRow } from '../components/match-row.js';
import { getAssetUrl } from '../core/config.js';
import { getTodayISODate, formatSavePct, formatGAA } from '../core/format.js';

export async function initCompetitionPage() {
  const compId = getParam('id') || 'KHL';
  let activeTab = getParam('tab') || 'table';
  let activeSeason = getParam('season') || '2026/27';

  const titleSlot = qs('#comp-title-slot');
  const tabsSlot = qs('#comp-tabs-slot');
  const contentSlot = qs('#comp-content-slot');

  renderLoading(contentSlot, 4);

  let compInfo = null;
  try {
    const all = await getCompetitions();
    compInfo = all.find(c => c.id === compId) || all[0];
  } catch (e) {
    console.error(e);
  }

  if (!compInfo) {
    renderError(contentSlot, 'Соревнование не найдено');
    return;
  }

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
    renderLoading(contentSlot, 3);

    try {
      if (activeTab === 'table') {
        const standingsData = await getStandings(compId, activeSeason);
        contentSlot.innerHTML = '';
        if (!standingsData || !standingsData.groups || standingsData.groups.length === 0) {
          renderEmpty(contentSlot, 'Таблицы для данного турнира пока не сформированы.');
          return;
        }
        for (const grp of standingsData.groups) {
          contentSlot.appendChild(createStandingsTable(grp));
        }
      } else if (activeTab === 'playoff') {
        contentSlot.innerHTML = '';
        try {
          const poData = await getPlayoffs(compId, activeSeason);
          if (poData && poData.rounds && poData.rounds.length > 0) {
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
          renderLeaders(contentSlot, lData);
        } catch (e) {
          renderEmpty(contentSlot, 'Статистика лидеров обновляется.');
        }
      } else if (activeTab === 'calendar') {
        contentSlot.innerHTML = '';
        // Load today's matches as preview
        const matches = await getMatchesByDate(getTodayISODate());
        const compMatches = (matches || []).filter(m => m.compId === compId);
        if (compMatches.length === 0) {
          renderEmpty(contentSlot, 'Матчи на сегодня завершены или не запланированы.');
        } else {
          const list = el('div', { className: 'card' },
            el('div', { className: 'card-header' },
              el('h3', { className: 'card-title' }, `Матчи дня (${compInfo.name})`)
            ),
            el('div', { className: 'comp-matches-list' },
              compMatches.map(m => createMatchRow(m))
            )
          );
          contentSlot.appendChild(list);
        }
      }
    } catch (err) {
      renderError(contentSlot, 'Не удалось загрузить раздел турнира', () => loadTabContent());
    }
  }

  loadTabContent();
}

function renderLeaders(container, lData) {
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
          rows.map((r, idx) => el('tr', {},
            el('td', {}, idx + 1),
            el('td', { style: { textAlign: 'left' } },
              el('a', { href: buildLink('/player/', { id: r.playerId }), className: 'link-accent' }, r.playerName || r.playerId)
            ),
            el('td', { style: { textAlign: 'right', fontWeight: 'bold' } }, valFormatter ? valFormatter(r.value) : r.value)
          ))
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
