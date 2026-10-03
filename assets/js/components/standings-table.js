/**
 * Hockey365 Standings Table Component
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

export function createStandingsTable(group, teamsMap = {}) {
  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

  const table = el('table', { className: 'standings-table' },
    el('thead', {},
      el('tr', {},
        el('th', { className: 'col-pos' }, '№'),
        el('th', { style: { textAlign: 'left', paddingLeft: '16px' } }, 'Команда'),
        el('th', { title: 'Игры' }, 'И'),
        el('th', { title: 'Победы в основное время' }, 'В'),
        el('th', { title: 'Победы в овертайме' }, 'ВО'),
        el('th', { title: 'Победы по буллитам' }, 'ВБ'),
        el('th', { title: 'Поражения в овертайме' }, 'ПО'),
        el('th', { title: 'Поражения по буллитам' }, 'ПБ'),
        el('th', { title: 'Поражения в основное время' }, 'П'),
        el('th', { title: 'Шайбы' }, 'Шайбы'),
        el('th', { title: 'Разница шайб' }, '+/-'),
        el('th', { className: 'col-pts', title: 'Очки' }, 'О'),
        el('th', { title: 'Форма за последние 5 матчей' }, 'Форма')
      )
    ),
    el('tbody', {},
      group.rows.map(row => {
        const team = teamsMap[row.teamId] || { name: row.teamId, logo: '' };
        const isPO = row.zone === 'PO' || row.pos <= 8;

        // Render form pills
        const formPills = el('div', { className: 'form-pills' });
        if (row.form) {
          for (const char of row.form.slice(-5)) {
            const lower = char.toLowerCase();
            let label = char;
            let pillClass = 'w';
            if (lower === 'w') { label = 'В'; pillClass = 'w'; }
            else if (lower === 'l') { label = 'П'; pillClass = 'l'; }
            else if (lower === 'o') { label = 'О'; pillClass = 'o'; }
            formPills.appendChild(el('span', { className: `form-pill ${pillClass}` }, label));
          }
        }

        return el('tr', {
          className: isPO ? 'row-zone-playoff' : 'row-zone-out'
        },
          el('td', { className: 'col-pos' }, row.pos),
          el('td', { className: 'col-team' },
            el('img', {
              src: team.logo ? getAssetUrl(team.logo) : defaultLogo,
              alt: team.name,
              className: 'team-logo-small',
              loading: 'lazy',
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('a', {
              href: buildLink('/team/', { id: row.teamId }),
              className: 'link-accent'
            }, team.name)
          ),
          el('td', {}, row.gp),
          el('td', {}, row.w),
          el('td', {}, row.wOT || 0),
          el('td', {}, row.wSO || 0),
          el('td', {}, row.lOT || 0),
          el('td', {}, row.lSO || 0),
          el('td', {}, row.l),
          el('td', {}, `${row.gf}-${row.ga}`),
          el('td', {}, (row.gd > 0 ? `+${row.gd}` : row.gd)),
          el('td', { className: 'col-pts' }, row.pts),
          el('td', {}, formPills)
        );
      })
    )
  );

  return el('div', { className: 'standings-table-wrap card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, group.name)
    ),
    table
  );
}
