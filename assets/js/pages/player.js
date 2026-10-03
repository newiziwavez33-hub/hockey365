/**
 * Hockey365 Player Profile Page Logic
 */

import { qs, el, renderLoading, renderError } from '../core/dom.js';
import { getPlayer, getTeam } from '../core/api.js';
import { getParam, buildLink } from '../core/router.js';
import { formatPosition, formatSavePct, formatGAA } from '../core/format.js';
import { getAssetUrl } from '../core/config.js';

export async function initPlayerPage() {
  const playerId = getParam('id') || 'khl:p_nikishin';
  const container = qs('#player-profile-slot');

  renderLoading(container, 3);

  let player = null;
  let team = null;

  try {
    player = await getPlayer(playerId);
    try {
      team = await getTeam(player.teamId);
    } catch {
      team = { name: player.teamId, id: player.teamId };
    }
  } catch (err) {
    renderError(container, 'Игрок не найден');
    return;
  }

  const isGoalie = player.position === 'G';

  container.innerHTML = '';

  // 1. Player Profile Header Card
  const profileCard = el('div', { className: 'card' },
    el('div', { className: 'card-body flex items-center justify-between flex-wrap gap-16' },
      el('div', { className: 'flex items-center gap-16' },
        el('div', {
          className: 'flex items-center justify-center text-xl text-bold',
          style: {
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-accent-blue)',
            border: '2px solid var(--color-border)'
          }
        }, `#${player.number || '?'}`),
        el('div', {},
          el('h1', { className: 'text-2xl text-bold' }, player.name),
          el('div', { className: 'text-sm text-muted' },
            `${player.nameEn || ''} • ${formatPosition(player.position)}`
          ),
          team ? el('div', { className: 'text-xs text-secondary', style: { marginTop: '4px' } },
            'Клуб: ',
            el('a', { href: buildLink('/team/', { id: team.id }), className: 'link-accent' }, team.name)
          ) : null
        )
      ),

      // Physical / Bio Data
      el('div', { className: 'flex gap-16 text-xs text-secondary' },
        el('div', {},
          el('div', { className: 'text-muted' }, 'Хват'),
          el('div', { className: 'text-bold' }, player.shoots === 'L' ? 'Левый' : player.shoots === 'R' ? 'Правый' : '-')
        ),
        el('div', {},
          el('div', { className: 'text-muted' }, 'Рост / Вес'),
          el('div', { className: 'text-bold' }, `${player.heightCm || '-'} см / ${player.weightKg || '-'} кг`)
        ),
        el('div', {},
          el('div', { className: 'text-muted' }, 'Дата рожд.'),
          el('div', { className: 'text-bold' }, player.birthDate || '-')
        ),
        el('div', {},
          el('div', { className: 'text-muted' }, 'Гражданство'),
          el('div', { className: 'text-bold' }, player.nationality || 'RUS')
        )
      )
    )
  );

  container.appendChild(profileCard);

  // 2. Stats Block (Goalie vs Field Player)
  const statsCard = el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' },
        isGoalie ? 'Вратарская статистика по сезонам' : 'Статистика полевого игрока по сезонам'
      )
    ),
    el('div', { className: 'standings-table-wrap' },
      renderStatsTable(player, isGoalie)
    )
  );

  container.appendChild(statsCard);

  // 3. Career History
  if (player.career && player.career.length > 0) {
    const careerCard = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h3', { className: 'card-title' }, 'Карьера в клубах')
      ),
      el('div', { className: 'card-body' },
        el('ul', { className: 'flex-col gap-8' },
          player.career.map(c => el('li', { className: 'text-sm' },
            el('strong', {}, `${c.from}–${c.to}: `),
            c.teamName || c.teamId
          ))
        )
      )
    );
    container.appendChild(careerCard);
  }
}

function renderStatsTable(player, isGoalie) {
  const stats = player.stats || [];
  if (stats.length === 0) {
    return el('div', { className: 'card-body text-muted text-xs' }, 'Статистика отсутствует');
  }

  if (isGoalie) {
    // Goalie table
    return el('table', { className: 'standings-table' },
      el('thead', {},
        el('tr', {},
          el('th', {}, 'Сезон'),
          el('th', {}, 'Лига'),
          el('th', {}, 'И (GP)'),
          el('th', {}, 'В (W)'),
          el('th', {}, 'П (L)'),
          el('th', {}, 'ПО (OTL)'),
          el('th', {}, 'КН (GAA)'),
          el('th', {}, '%ОБ (SV%)'),
          el('th', {}, 'СМ (SO)'),
          el('th', {}, 'Время (TOI)')
        )
      ),
      el('tbody', {},
        stats.map(s => {
          const gk = s.gk || {};
          return el('tr', {},
            el('td', { style: { fontWeight: 'bold' } }, s.season),
            el('td', {}, s.compId),
            el('td', {}, s.gp),
            el('td', {}, gk.w ?? '-'),
            el('td', {}, gk.l ?? '-'),
            el('td', {}, gk.otl ?? '-'),
            el('td', { style: { fontWeight: 'bold' } }, formatGAA(gk.gaa)),
            el('td', { style: { fontWeight: 'bold' } }, formatSavePct(gk.svPct)),
            el('td', {}, gk.so ?? 0),
            el('td', {}, s.toi || '-')
          );
        })
      )
    );
  }

  // Field player table
  return el('table', { className: 'standings-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Сезон'),
        el('th', {}, 'Лига'),
        el('th', {}, 'И (GP)'),
        el('th', {}, 'Г (G)'),
        el('th', {}, 'П (A)'),
        el('th', { className: 'col-pts' }, 'О (PTS)'),
        el('th', {}, '+/-'),
        el('th', {}, 'Штр (PIM)'),
        el('th', {}, 'Броски'),
        el('th', {}, 'Время (TOI)')
      )
    ),
    el('tbody', {},
      stats.map(s => el('tr', {},
        el('td', { style: { fontWeight: 'bold' } }, s.season),
        el('td', {}, s.compId),
        el('td', {}, s.gp),
        el('td', {}, s.g ?? 0),
        el('td', {}, s.a ?? 0),
        el('td', { className: 'col-pts' }, s.pts ?? ((s.g || 0) + (s.a || 0))),
        el('td', {}, (s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus) ?? 0),
        el('td', {}, s.pim ?? 0),
        el('td', {}, s.shots ?? '-'),
        el('td', {}, s.toi || '-')
      ))
    )
  );
}
