/**
 * Hockey365 Match Row Component (High-Density Soccer365 / Flashscore Style)
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { formatPeriodStatus, formatScore, formatPeriodBreakdown } from '../core/format.js';
import { getAssetUrl } from '../core/config.js';

// Pre-cached authentic names and logos for instant synchronous rendering
export const KNOWN_TEAMS = {
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

export function createMatchRow(match, teamsMap = {}) {
  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

  const homeRaw = match.home.id;
  const awayRaw = match.away.id;

  const homeTeam = teamsMap[homeRaw] || KNOWN_TEAMS[homeRaw] || {
    name: homeRaw.replace(/^(khl|nhl):/, '').toUpperCase(),
    short: homeRaw.replace(/^(khl|nhl):/, '').slice(0, 3).toUpperCase(),
    logo: homeRaw.startsWith('khl:') ? `/assets/logos/teams/${homeRaw.split(':')[1]}.png` : `/assets/logos/teams/${homeRaw.split(':')[1]}.svg`
  };

  const awayTeam = teamsMap[awayRaw] || KNOWN_TEAMS[awayRaw] || {
    name: awayRaw.replace(/^(khl|nhl):/, '').toUpperCase(),
    short: awayRaw.replace(/^(khl|nhl):/, '').slice(0, 3).toUpperCase(),
    logo: awayRaw.startsWith('khl:') ? `/assets/logos/teams/${awayRaw.split(':')[1]}.png` : `/assets/logos/teams/${awayRaw.split(':')[1]}.svg`
  };

  const isLive = match.status === 'LIVE' || match.status === 'INTERMISSION';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';
  const isFav = store.isFavorite('matches', match.id);

  const homeScore = match.home.score;
  const awayScore = match.away.score;

  const homeWon = isFinished && homeScore > awayScore;
  const awayWon = isFinished && awayScore > homeScore;

  // Extra note: OT or SO (буллиты)
  let extraNote = '';
  if (match.finishedIn === 'OT') extraNote = 'ОТ';
  else if (match.finishedIn === 'SO') extraNote = 'Б';

  const homeLogoSrc = homeTeam.logo ? getAssetUrl(homeTeam.logo) : defaultLogo;
  const awayLogoSrc = awayTeam.logo ? getAssetUrl(awayTeam.logo) : defaultLogo;

  // Status block content
  let statusBadgeEl = null;
  let statusSubText = '';

  if (isLive) {
    statusBadgeEl = el('span', { className: 'stitch-status-live' },
      el('span', { className: 'live-dot-pulse' }),
      'LIVE'
    );
    statusSubText = match.clock ? `${match.period}-й (${match.clock})` : `${match.period}-й период`;
  } else if (isFinished) {
    statusBadgeEl = el('span', { className: 'stitch-status-finished' },
      el('span', { className: 'finished-dot' }),
      'Завершен'
    );
    statusSubText = extraNote === 'ОТ' ? 'Овертайм (ОТ)' : extraNote === 'Б' ? 'Буллиты (Б)' : 'Основное время';
  } else {
    const timeStr = formatPeriodStatus(match);
    statusBadgeEl = el('span', { className: 'stitch-status-time font-tabular' }, timeStr);
    statusSubText = 'Запланирован';
  }

  const row = el('div', {
    className: `match-row-stitch ${isLive ? 'is-live-card' : ''}`,
    dataset: { matchId: match.id }
  },
    // Top Row: Status, Teams & Score, Actions
    el('div', { className: 'match-main-line' },
      // Left: Status Column
      el('div', { className: 'match-col-status' },
        statusBadgeEl,
        el('span', { className: 'match-status-sub' }, statusSubText)
      ),

      // Center: Teams & Scoreboard
      el('div', { className: 'match-col-teams' },
        // Home Team
        el('a', {
          href: buildLink('/team/', { id: match.home.id }),
          className: 'match-team-stitch team-home',
          onClick: (e) => e.stopPropagation()
        },
          el('span', { className: `team-name-stitch ${homeWon ? 'winner-bold' : ''}` }, homeTeam.name),
          el('div', { className: 'team-logo-wrap' },
            el('img', {
              src: homeLogoSrc,
              alt: homeTeam.name,
              className: 'team-logo-stitch',
              loading: 'lazy',
              onerror: (e) => { e.target.src = defaultLogo; }
            })
          )
        ),

        // Scoreboard Box
        el('a', {
          href: buildLink('/match/', { id: match.id }),
          className: 'match-score-stitch',
          title: 'Открыть протокол встречи'
        },
          el('div', { className: 'score-pill' },
            el('span', { className: 'score-val font-tabular' }, isScheduled ? '-' : homeScore),
            el('span', { className: 'score-sep' }, ':'),
            el('span', { className: 'score-val font-tabular' }, isScheduled ? '-' : awayScore)
          ),
          extraNote ? el('span', { className: 'score-extra-badge' }, extraNote) : null
        ),

        // Away Team
        el('a', {
          href: buildLink('/team/', { id: match.away.id }),
          className: 'match-team-stitch team-away',
          onClick: (e) => e.stopPropagation()
        },
          el('div', { className: 'team-logo-wrap' },
            el('img', {
              src: awayLogoSrc,
              alt: awayTeam.name,
              className: 'team-logo-stitch',
              loading: 'lazy',
              onerror: (e) => { e.target.src = defaultLogo; }
            })
          ),
          el('span', { className: `team-name-stitch ${awayWon ? 'winner-bold' : ''}` }, awayTeam.name)
        )
      ),

      // Right: Actions (Favorite Star + Protocol Button)
      el('div', { className: 'match-col-actions' },
        el('button', {
          className: `fav-star-btn ${isFav ? 'is-fav' : ''}`,
          'aria-label': isFav ? 'Удалить из избранного' : 'Добавить в избранное',
          'aria-pressed': isFav ? 'true' : 'false',
          title: isFav ? 'В избранном' : 'Добавить в избранное',
          onClick: (e) => {
            e.stopPropagation();
            const active = store.toggleFavorite('matches', match.id);
            if (active) {
              e.currentTarget.classList.add('is-fav');
            } else {
              e.currentTarget.classList.remove('is-fav');
            }
            e.currentTarget.setAttribute('aria-pressed', String(active));
          }
        },
          el('span', { className: 'material-symbols-outlined' }, 'star')
        ),
        el('a', {
          href: buildLink('/match/', { id: match.id }),
          className: 'protocol-btn-stitch'
        }, 'Протокол')
      )
    )
  );

  // Bottom Sub-strip: Period Breakdown and Key Scorers
  if (match.home.periods && match.home.periods.length > 0) {
    const breakdown = formatPeriodBreakdown(match.home.periods, match.away.periods);
    if (breakdown) {
      // Find goal events if available
      let keyEventText = '';
      if (Array.isArray(match.events) && match.events.length > 0) {
        const goalEvents = match.events.filter(ev => ev.type === 'GOAL').slice(-2);
        if (goalEvents.length > 0) {
          keyEventText = 'Голы: ' + goalEvents.map(g => `${g.player} ${g.minute || ''}'`).join(', ');
        }
      }

      const substrip = el('div', { className: 'match-substrip-stitch' },
        el('div', { className: 'substrip-left' },
          el('span', { className: 'substrip-label' }, 'Периоды:'),
          el('span', { className: 'substrip-breakdown font-tabular' }, `(${breakdown})`)
        ),
        keyEventText ? el('div', { className: 'substrip-summary' }, keyEventText) : null
      );
      row.appendChild(substrip);
    }
  }

  return row;
}
