/**
 * Hockey365 Transfers & Trades Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getTransfers } from '../core/api.js';
import { buildLink } from '../core/router.js';

export async function initTransfersPage() {
  const container = qs('#transfers-slot');
  renderLoading(container, 3);

  try {
    const data = await getTransfers('2026-2027');
    const transfers = data.transfers || [];
    container.innerHTML = '';

    if (transfers.length === 0) {
      renderEmpty(container, 'Данные по трансферам отсутствуют');
      return;
    }

    const card = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h1', { className: 'card-title' }, `Таблица переходов и обменов (${data.season || '2026/27'})`)
      ),
      el('div', { className: 'standings-table-wrap' },
        el('table', { className: 'standings-table text-xs' },
          el('thead', {},
            el('tr', {},
              el('th', { style: { textAlign: 'left' } }, 'Дата'),
              el('th', { style: { textAlign: 'left' } }, 'Игрок'),
              el('th', { style: { textAlign: 'left' } }, 'Откуда'),
              el('th', { style: { textAlign: 'left' } }, 'Куда'),
              el('th', {}, 'Тип сделки'),
              el('th', { style: { textAlign: 'left' } }, 'Условия')
            )
          ),
          el('tbody', {},
            transfers.map(t => {
              let typeLabel = t.type;
              if (t.type === 'signing') typeLabel = 'Подписание';
              else if (t.type === 'trade') typeLabel = 'Обмен';
              else if (t.type === 'extension') typeLabel = 'Продление';
              else if (t.type === 'waiver') typeLabel = 'Драфт отказов';

              return el('tr', {},
                el('td', { style: { textAlign: 'left', color: 'var(--color-text-muted)' } }, t.date),
                el('td', { style: { textAlign: 'left', fontWeight: 'bold' } },
                  el('a', { href: buildLink('/player/', { id: t.playerId }), className: 'link-accent' }, t.playerName)
                ),
                el('td', { style: { textAlign: 'left' } },
                  t.fromTeamId ? el('a', { href: buildLink('/team/', { id: t.fromTeamId }), className: 'link-accent' }, t.fromTeamName || t.fromTeamId) : 'Свободный агент'
                ),
                el('td', { style: { textAlign: 'left' } },
                  t.toTeamId ? el('a', { href: buildLink('/team/', { id: t.toTeamId }), className: 'link-accent' }, t.toTeamName || t.toTeamId) : '-'
                ),
                el('td', {},
                  el('span', { className: 'badge badge-scheduled' }, typeLabel)
                ),
                el('td', { style: { textAlign: 'left', color: 'var(--color-text-secondary)' } }, t.terms || '-')
              );
            })
          )
        )
      )
    );

    container.appendChild(card);
  } catch (err) {
    renderError(container, 'Не удалось загрузить таблицу переходов');
  }
}
