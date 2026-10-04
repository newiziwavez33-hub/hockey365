/**
 * Hockey365 Match Row Component — Google Stitch Design System
 * Features exact 7-column grid layout, status column, score pill, action buttons,
 * and recessed period breakdown sub-strip.
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { formatPeriodStatus, formatPeriodBreakdown } from '../core/format.js';
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
  let extraBadge = '';
  if (match.finishedIn === 'OT') extraBadge = 'ОТ';
  else if (match.finishedIn === 'SO') extraBadge = 'Б';
  else if (isFinished && !extraBadge) extraBadge = '';

  const homeLogoSrc = homeTeam.logo ? getAssetUrl(homeTeam.logo) : defaultLogo;
  const awayLogoSrc = awayTeam.logo ? getAssetUrl(awayTeam.logo) : defaultLogo;

  // 1. Status Column (112px)
  let statusIndicatorEl = null;
  let statusSubText = '';

  if (isLive) {
    statusIndicatorEl = el('span', { className: 'status-indicator status-live' },
      el('span', { className: 'indicator-dot' }),
      'LIVE'
    );
    statusSubText = match.clock ? `${match.period}-й (${match.clock})` : `${match.period}-й период`;
  } else if (isFinished) {
    statusIndicatorEl = el('span', { className: 'status-indicator status-finished' },
      el('span', { className: 'indicator-dot' }),
      'Завершен'
    );
    statusSubText = extraBadge === 'ОТ' ? 'Овертайм (ОТ)' : extraBadge === 'Б' ? 'Буллиты (Б)' : 'Основное время';
  } else {
    const timeStr = formatPeriodStatus(match);
    statusIndicatorEl = el('span', { className: 'status-indicator status-scheduled font-tabular' }, timeStr);
    statusSubText = 'Запланирован';
  }

  const statusCol = el('div', { className: 'match-col-status' },
    statusIndicatorEl,
    el('span', { className: 'status-sub-info' }, statusSubText)
  );

  // 2. Center 7-Column Grid
  const grid7 = el('div', { className: 'match-col-7grid' },
    // Home Team (col-span-3, right-aligned)
    el('a', {
      href: buildLink('/team/', { id: match.home.id }),
      className: 'match-team-block team-home',
      onClick: (e) => e.stopPropagation()
    },
      el('span', { className: `match-team-name ${homeWon ? 'winner' : ''}` }, homeTeam.name),
      el('div', { className: 'team-emblem-circle' },
        el('img', {
          src: homeLogoSrc,
          alt: homeTeam.name,
          className: 'team-emblem-img',
          loading: 'lazy',
          onerror: (e) => { e.target.src = defaultLogo; }
        })
      )
    ),

    // Score Box Center (col-span-1, centered)
    el('a', {
      href: buildLink('/match/', { id: match.id }),
      className: 'match-score-center',
      title: 'Открыть протокол встречи'
    },
      el('div', { className: 'score-pill-box' },
        el('span', { className: 'score-digit font-tabular' }, isScheduled ? '-' : homeScore),
        el('span', { className: 'score-separator' }, ':'),
        el('span', { className: 'score-digit font-tabular' }, isScheduled ? '-' : awayScore)
      ),
      extraBadge ? el('span', { className: 'score-overtime-pill font-label-sm' }, extraBadge) : null
    ),

    // Away Team (col-span-3, left-aligned)
    el('a', {
      href: buildLink('/team/', { id: match.away.id }),
      className: 'match-team-block team-away',
      onClick: (e) => e.stopPropagation()
    },
      el('div', { className: 'team-emblem-circle' },
        el('img', {
          src: awayLogoSrc,
          alt: awayTeam.name,
          className: 'team-emblem-img',
          loading: 'lazy',
          onerror: (e) => { e.target.src = defaultLogo; }
        })
      ),
      el('span', { className: `match-team-name ${awayWon ? 'winner' : ''}` }, awayTeam.name)
    )
  );

  // 3. Actions Column Right
  const actionsCol = el('div', { className: 'match-col-actions' },
    el('button', {
      type: 'button',
      className: `fav-action-btn ${isFav ? 'is-fav' : ''}`,
      'aria-label': isFav ? 'Удалить из избранного' : 'Добавить в избранное',
      'aria-pressed': isFav ? 'true' : 'false',
      title: isFav ? 'В избранном' : 'Добавить в избранное',
      onClick: (e) => {
        e.stopPropagation();
        const active = store.toggleFavorite('matches', match.id);
        e.currentTarget.classList.toggle('is-fav', active);
        e.currentTarget.setAttribute('aria-pressed', String(active));
      }
    },
      el('span', { className: 'material-symbols-outlined' }, 'star')
    ),
    el('a', {
      href: buildLink('/match/', { id: match.id }),
      className: 'protocol-action-btn'
    }, 'Протокол')
  );

  // Main Card Row
  const mainRow = el('div', { className: 'match-card-main-row' },
    statusCol,
    grid7,
    actionsCol
  );

  const card = el('div', {
    className: `match-card-stitch ${isLive ? 'is-live-card' : ''}`,
    dataset: { matchId: match.id }
  }, mainRow);

  // 4. Period Breakdown Sub-strip
  if (match.home.periods && match.home.periods.length > 0) {
    const breakdown = formatPeriodBreakdown(match.home.periods, match.away.periods);
    if (breakdown) {
      let scorerText = '';
      if (Array.isArray(match.events) && match.events.length > 0) {
        const goalEvents = match.events.filter(ev => ev.type === 'GOAL');
        if (goalEvents.length > 0) {
          scorerText = 'Шайбы: ' + goalEvents.slice(0, 4).map(g => `${g.player} ${g.minute || ''}'`).join(', ');
        }
      }
      if (!scorerText && match.finishedIn === 'SO') {
        scorerText = 'Победный буллит';
      }

      const substrip = el('div', { className: 'match-substrip-recessed' },
        el('div', { className: 'substrip-periods' },
          el('span', { className: 'substrip-tag' }, 'Периоды:'),
          el('span', { className: 'substrip-scores font-tabular' }, `(${breakdown})`)
        ),
        scorerText ? el('div', { className: 'substrip-scorers' }, scorerText) : null
      );
      card.appendChild(substrip);
    }
  }

  return card;
}
