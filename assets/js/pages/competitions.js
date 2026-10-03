/**
 * Hockey365 Competitions Catalog Page Logic
 */

import { qs, el, renderLoading, renderError } from '../core/dom.js';
import { getCompetitions } from '../core/api.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

export async function initCompetitionsPage() {
  const container = qs('#competitions-grid');
  renderLoading(container, 3);

  try {
    const list = await getCompetitions();
    container.innerHTML = '';

    for (const comp of list) {
      const card = el('div', { className: 'card' },
        el('div', { className: 'card-header' },
          el('div', { className: 'flex items-center gap-12' },
            comp.emblem ? el('img', { src: getAssetUrl(comp.emblem), alt: comp.name, style: { width: '32px', height: '32px', objectFit: 'contain' } }) : null,
            el('div', {},
              el('h2', { className: 'card-title' },
                el('a', { href: buildLink('/competition/', { id: comp.id }), className: 'link-accent' }, comp.name)
              ),
              el('div', { className: 'text-xs text-muted' }, comp.nameEn || comp.id)
            )
          ),
          el('span', { className: 'badge badge-scheduled' }, comp.currentSeason || '2026/27')
        ),
        el('div', { className: 'card-body' },
          el('div', { className: 'flex-col gap-8 text-sm' },
            el('div', {},
              el('strong', {}, 'Страна: '),
              comp.country === 'RUS' ? 'Россия' : comp.country === 'USA' ? 'США / Канада' : comp.country
            ),
            el('div', {},
              el('strong', {}, 'Система очков: '),
              comp.pointsRule === '3-2-1-0' ? '3-2-1-0 (европейская)' : '2-1-0-ot (2 очка за победу, 1 за поражение в ОТ/Б)'
            ),
            comp.structure && comp.structure.conferences && comp.structure.conferences.length > 0 ? el('div', {},
              el('strong', {}, 'Конференции: '),
              comp.structure.conferences.join(', ')
            ) : null,
            comp.structure && comp.structure.divisions && comp.structure.divisions.length > 0 ? el('div', {},
              el('strong', {}, 'Дивизионы: '),
              comp.structure.divisions.join(', ')
            ) : null
          ),
          el('div', { className: 'flex gap-8', style: { marginTop: '16px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '12px' } },
            el('a', { href: buildLink('/competition/', { id: comp.id, tab: 'table' }), className: 'btn-primary text-xs' }, 'Турнирные таблицы'),
            el('a', { href: buildLink('/competition/', { id: comp.id, tab: 'playoff' }), className: 'tab-btn text-xs' }, 'Сетка плей-офф'),
            el('a', { href: buildLink('/competition/', { id: comp.id, tab: 'leaders' }), className: 'tab-btn text-xs' }, 'Бомбардиры')
          )
        )
      );

      container.appendChild(card);
    }
  } catch (e) {
    renderError(container, 'Не удалось загрузить список соревнований');
  }
}
