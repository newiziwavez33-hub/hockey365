/**
 * Hockey365 Search Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getSearchIndex } from '../core/api.js';
import { getParam, setParam, buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

export async function initSearchPage() {
  const input = qs('#search-page-input');
  const resultsSlot = qs('#search-results-slot');
  const statusSlot = qs('#search-status-slot');

  let searchIndex = [];
  renderLoading(resultsSlot, 4);

  try {
    searchIndex = await getSearchIndex();
  } catch (err) {
    renderError(resultsSlot, 'Не удалось загрузить поисковый индекс');
    return;
  }

  const initialQuery = getParam('q') || '';
  if (input) {
    input.value = initialQuery;
    input.focus();
    input.addEventListener('input', (e) => {
      const q = e.target.value;
      setParam('q', q, true);
      executeSearch(q);
    });
  }

  function executeSearch(query) {
    const qClean = (query || '').toLowerCase().replace(/ё/g, 'е').trim();
    if (!qClean) {
      statusSlot.textContent = 'Введите запрос для поиска команд, игроков или лиг';
      resultsSlot.innerHTML = '';
      return;
    }

    const matches = searchIndex.filter(item => {
      const tokens = (item.tokens || '').toLowerCase().replace(/ё/g, 'е');
      const title = (item.title || '').toLowerCase().replace(/ё/g, 'е');
      return tokens.includes(qClean) || title.includes(qClean);
    });

    statusSlot.textContent = `Найдено результатов: ${matches.length}`;
    resultsSlot.innerHTML = '';

    if (matches.length === 0) {
      renderEmpty(resultsSlot, `По запросу «${query}» ничего не найдено. Попробуйте изменить формулировку или использовать латиницу.`);
      return;
    }

    const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

    const card = el('div', { className: 'card' },
      el('div', { className: 'card-body flex-col gap-12' },
        matches.map(m => {
          let typeLabel = 'Сущность';
          if (m.type === 'team') typeLabel = 'Клуб';
          else if (m.type === 'player') typeLabel = 'Игрок';
          else if (m.type === 'competition') typeLabel = 'Лига';
          else if (m.type === 'news') typeLabel = 'Новость';

          return el('div', {
            className: 'flex items-center justify-between gap-12',
            style: { padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }
          },
            el('div', { className: 'flex items-center gap-12' },
              m.logo ? el('img', {
                src: getAssetUrl(m.logo),
                alt: m.title,
                className: 'team-logo-small',
                onerror: (e) => { e.target.src = defaultLogo; }
              }) : null,
              el('div', {},
                el('a', { href: buildLink(m.url), className: 'text-base text-bold link-accent' }, m.title),
                el('div', { className: 'text-xs text-muted' }, m.subtitle || '')
              )
            ),
            el('span', { className: 'badge badge-scheduled' }, typeLabel)
          );
        })
      )
    );

    resultsSlot.appendChild(card);
  }

  if (initialQuery) {
    executeSearch(initialQuery);
  } else {
    statusSlot.textContent = 'Введите запрос для поиска команд, игроков или лиг';
    resultsSlot.innerHTML = '';
  }
}
