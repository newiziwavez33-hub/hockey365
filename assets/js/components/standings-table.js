/**
 * Hockey365 Standings Table Component
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

// Pre-cached authentic names and logos for instant synchronous rendering
const KNOWN_TEAMS = {
  // KHL
  'khl:ska': { name: 'СКА', short: 'СКА', logo: '/assets/logos/teams/ska.png' },
  'khl:cska': { name: 'ЦСКА', short: 'ЦСК', logo: '/assets/logos/teams/cska.png' },
  'khl:spartak': { name: 'Спартак', short: 'СПА', logo: '/assets/logos/teams/spartak.png' },
  'khl:dynamo-msk': { name: 'Динамо М', short: 'ДИН', logo: '/assets/logos/teams/dynamo-msk.png' },
  'khl:lokomotiv': { name: 'Локомотив', short: 'ЛОК', logo: '/assets/logos/teams/lokomotiv.png' },
  'khl:torpedo': { name: 'Торпедо', short: 'ТОР', logo: '/assets/logos/teams/torpedo.png' },
  'khl:severstal': { name: 'Северсталь', short: 'СЕВ', logo: '/assets/logos/teams/severstal.png' },
  'khl:sochi': { name: 'ХК Сочи', short: 'СОЧ', logo: '/assets/logos/teams/sochi.png' },
  'khl:vityaz': { name: 'Витязь', short: 'ВИТ', logo: '/assets/logos/teams/vityaz.png' },
  'khl:dynamo-mns': { name: 'Динамо Мн', short: 'МНС', logo: '/assets/logos/teams/dynamo-mns.png' },
  'khl:kunlun': { name: 'Куньлунь РС', short: 'КРС', logo: '/assets/logos/teams/kunlun.png' },
  'khl:ak-bars': { name: 'Ак Барс', short: 'АКБ', logo: '/assets/logos/teams/ak-bars.png' },
  'khl:metallurg-mg': { name: 'Металлург Мг', short: 'ММГ', logo: '/assets/logos/teams/metallurg-mg.png' },
  'khl:traktor': { name: 'Трактор', short: 'ТРК', logo: '/assets/logos/teams/traktor.png' },
  'khl:avtomobilist': { name: 'Автомобилист', short: 'АВТ', logo: '/assets/logos/teams/avtomobilist.png' },
  'khl:neftekhimik': { name: 'Нефтехимик', short: 'НХК', logo: '/assets/logos/teams/neftekhimik.png' },
  'khl:lada': { name: 'Лада', short: 'ЛАД', logo: '/assets/logos/teams/lada.png' },
  'khl:avangard': { name: 'Авангард', short: 'АВГ', logo: '/assets/logos/teams/avangard.png' },
  'khl:salavat-yulaev': { name: 'Салават Юлаев', short: 'СЮЛ', logo: '/assets/logos/teams/salavat-yulaev.png' },
  'khl:sibir': { name: 'Сибирь', short: 'СИБ', logo: '/assets/logos/teams/sibir.png' },
  'khl:barys': { name: 'Барыс', short: 'БАР', logo: '/assets/logos/teams/barys.png' },
  'khl:amur': { name: 'Амур', short: 'АМУ', logo: '/assets/logos/teams/amur.png' },
  'khl:admiral': { name: 'Адмирал', short: 'АДМ', logo: '/assets/logos/teams/admiral.png' },

  // NHL
  'nhl:ana': { name: 'Анахайм Дакс', short: 'ANA', logo: '/assets/logos/teams/ana.svg' },
  'nhl:bos': { name: 'Бостон Брюинз', short: 'BOS', logo: '/assets/logos/teams/bos.svg' },
  'nhl:buf': { name: 'Баффало Сейбрз', short: 'BUF', logo: '/assets/logos/teams/buf.svg' },
  'nhl:car': { name: 'Каролина Харрикейнз', short: 'CAR', logo: '/assets/logos/teams/car.svg' },
  'nhl:cbj': { name: 'Коламбус Блю Джекетс', short: 'CBJ', logo: '/assets/logos/teams/cbj.svg' },
  'nhl:cgy': { name: 'Калгари Флэймз', short: 'CGY', logo: '/assets/logos/teams/cgy.svg' },
  'nhl:chi': { name: 'Чикаго Блэкхокс', short: 'CHI', logo: '/assets/logos/teams/chi.svg' },
  'nhl:col': { name: 'Колорадо Эвеланш', short: 'COL', logo: '/assets/logos/teams/col.svg' },
  'nhl:dal': { name: 'Даллас Старз', short: 'DAL', logo: '/assets/logos/teams/dal.svg' },
  'nhl:det': { name: 'Детройт Ред Уингз', short: 'DET', logo: '/assets/logos/teams/det.svg' },
  'nhl:edm': { name: 'Эдмонтон Ойлерз', short: 'EDM', logo: '/assets/logos/teams/edm.svg' },
  'nhl:fla': { name: 'Флорида Пантерз', short: 'FLA', logo: '/assets/logos/teams/fla.svg' },
  'nhl:lak': { name: 'Лос-Анджелес Кингз', short: 'LAK', logo: '/assets/logos/teams/lak.svg' },
  'nhl:min': { name: 'Миннесота Уайлд', short: 'MIN', logo: '/assets/logos/teams/min.svg' },
  'nhl:mtl': { name: 'Монреаль Канадиенс', short: 'MTL', logo: '/assets/logos/teams/mtl.svg' },
  'nhl:njd': { name: 'Нью-Джерси Девилз', short: 'NJD', logo: '/assets/logos/teams/njd.svg' },
  'nhl:nsh': { name: 'Нэшвилл Предаторз', short: 'NSH', logo: '/assets/logos/teams/nsh.svg' },
  'nhl:nyi': { name: 'Нью-Йорк Айлендерс', short: 'NYI', logo: '/assets/logos/teams/nyi.svg' },
  'nhl:nyr': { name: 'Нью-Йорк Рейнджерс', short: 'NYR', logo: '/assets/logos/teams/nyr.svg' },
  'nhl:ott': { name: 'Оттава Сенаторз', short: 'OTT', logo: '/assets/logos/teams/ott.svg' },
  'nhl:phi': { name: 'Филадельфия Флайерз', short: 'PHI', logo: '/assets/logos/teams/phi.svg' },
  'nhl:pit': { name: 'Питтсбург Пингвинз', short: 'PIT', logo: '/assets/logos/teams/pit.svg' },
  'nhl:sea': { name: 'Сиэтл Кракен', short: 'SEA', logo: '/assets/logos/teams/sea.svg' },
  'nhl:sjs': { name: 'Сан-Хосе Шаркс', short: 'SJS', logo: '/assets/logos/teams/sjs.svg' },
  'nhl:stl': { name: 'Сент-Луис Блюз', short: 'STL', logo: '/assets/logos/teams/stl.svg' },
  'nhl:tbl': { name: 'Тампа-Бэй Лайтнинг', short: 'TBL', logo: '/assets/logos/teams/tbl.svg' },
  'nhl:tor': { name: 'Торонто Мейпл Лифс', short: 'TOR', logo: '/assets/logos/teams/tor.svg' },
  'nhl:uta': { name: 'Юта Хоккей Клаб', short: 'UTA', logo: '/assets/logos/teams/uta.svg' },
  'nhl:van': { name: 'Ванкувер Кэнакс', short: 'VAN', logo: '/assets/logos/teams/van.svg' },
  'nhl:vgk': { name: 'Вегас Голден Найтс', short: 'VGK', logo: '/assets/logos/teams/vgk.svg' },
  'nhl:wpg': { name: 'Виннипег Джетс', short: 'WPG', logo: '/assets/logos/teams/wpg.svg' },
  'nhl:wsh': { name: 'Вашингтон Кэпиталз', short: 'WSH', logo: '/assets/logos/teams/wsh.svg' }
};

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
        el('th', { title: 'Шайбы (Забито - Пропущено)' }, 'Шайбы'),
        el('th', { title: 'Разница шайб' }, '+/-'),
        el('th', { className: 'col-pts', title: 'Очки' }, 'О'),
        el('th', { title: 'Форма за последние 5 матчей' }, 'Форма')
      )
    ),
    el('tbody', {},
      group.rows.map(row => {
        const team = teamsMap[row.teamId] || KNOWN_TEAMS[row.teamId] || {
          name: row.teamId.replace(/^(khl|nhl):/, '').toUpperCase(),
          logo: row.teamId.startsWith('khl:') ? `/assets/logos/teams/${row.teamId.split(':')[1]}.png` : `/assets/logos/teams/${row.teamId.split(':')[1]}.svg`
        };

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

        const teamLogoSrc = team.logo ? getAssetUrl(team.logo) : defaultLogo;

        return el('tr', {
          className: isPO ? 'row-zone-playoff' : 'row-zone-out'
        },
          el('td', { className: 'col-pos' }, row.pos),
          el('td', { className: 'col-team' },
            el('img', {
              src: teamLogoSrc,
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
