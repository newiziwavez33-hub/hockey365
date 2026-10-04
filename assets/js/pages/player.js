/**
 * Hockey365 Player Profile Page Logic
 */

import { qs, el, renderLoading, renderError } from '../core/dom.js';
import { getPlayer, getTeam } from '../core/api.js';
import { getParam, buildLink } from '../core/router.js';
import { formatPosition, formatSavePct, formatGAA } from '../core/format.js';
import { getAssetUrl } from '../core/config.js';

export async function initPlayerPage() {
  const playerId = getParam('id');
  const container = qs('#player-profile-slot');

  if (!playerId) {
    renderError(container, 'Выберите игрока через поиск или страницу клуба');
    return;
  }

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

  // 1. Player Profile Hero Card
  const profileCard = el('div', { className: 'player-hero-card' },
    el('div', { className: 'player-hero-flex' },
      // Left Cluster: Portrait + Identity
      el('div', { className: 'flex items-center gap-20' },
        el('div', { className: 'player-portrait-halo' },
          player.photo
            ? el('img', {
                src: getAssetUrl(player.photo),
                alt: player.name,
                className: 'player-headshot-img',
                loading: 'eager',
                onError: (e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                }
              })
            : null,
          el('div', {
            className: 'player-jersey-fallback',
            style: { display: player.photo ? 'none' : 'flex' }
          },
            el('span', { className: 'player-jersey-number font-tabular' }, `#${player.number || '?'}`),
            el('span', { className: 'player-jersey-sub' }, formatPosition(player.position))
          )
        ),
        el('div', { className: 'player-title-cluster' },
          el('h1', { className: 'player-main-name' }, player.name),
          el('div', { className: 'player-meta-line' },
            player.nameEn ? el('span', {}, player.nameEn) : null,
            el('span', { className: 'text-muted' }, '•'),
            el('span', { className: 'font-tabular' }, `#${player.number || '?'}`),
            el('span', { className: 'text-muted' }, '•'),
            el('span', {}, formatPosition(player.position)),
            team ? el('a', {
              href: buildLink('/team/', { id: team.id }),
              className: 'player-club-badge'
            },
              team.logo ? el('img', { src: getAssetUrl(team.logo), alt: team.name, className: 'player-club-logo' }) : null,
              el('span', {}, team.name)
            ) : null
          )
        )
      ),

      // Right Cluster: Vitals Grid
      el('div', { className: 'player-vitals-grid' },
        el('div', { className: 'vital-box' },
          el('div', { className: 'vital-lbl' }, 'Хват'),
          el('div', { className: 'vital-val' }, player.shoots === 'L' ? 'Левый' : player.shoots === 'R' ? 'Правый' : '—')
        ),
        el('div', { className: 'vital-box' },
          el('div', { className: 'vital-lbl' }, 'Рост / Вес'),
          el('div', { className: 'vital-val font-tabular' }, `${player.heightCm || '-'} см / ${player.weightKg || '-'} кг`)
        ),
        el('div', { className: 'vital-box' },
          el('div', { className: 'vital-lbl' }, 'Дата рожд.'),
          el('div', { className: 'vital-val font-tabular' }, player.birthDate || '—')
        ),
        el('div', { className: 'vital-box' },
          el('div', { className: 'vital-lbl' }, 'Гражданство'),
          el('div', { className: 'vital-val' }, player.nationality || '—')
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
          const isCurrent = s.season === '2026/27';
          return el('tr', { className: isCurrent ? 'current-season-row' : '' },
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
      stats.map(s => {
        const isCurrent = s.season === '2026/27';
        return el('tr', { className: isCurrent ? 'current-season-row' : '' },
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
        );
      })
    )
  );
}
