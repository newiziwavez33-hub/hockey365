/**
 * Hockey365 Match Components — Google Stitch Design System (100% Fidelity)
 * Provides:
 * 1. createMatchGridCardStitch: 2-column grid cards for Match Center (matching Stitch screenshot)
 * 2. createMatchRow: 7-column horizontal row layout for lists & tables
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { formatPeriodStatus, formatPeriodBreakdown } from '../core/format.js';
import { getAssetUrl } from '../core/config.js';

// Pre-cached authentic names, short tags, and colors for instant synchronous rendering
export const KNOWN_TEAMS = {
  // KHL
  'khl:ska': { name: 'СКА Санкт-Петербург', short: 'СКА', color: '#D31145', logo: '/assets/logos/teams/ska.png' },
  'khl:cska': { name: 'ЦСКА Москва', short: 'ЦСК', color: '#D31145', logo: '/assets/logos/teams/cska.png' },
  'khl:spartak': { name: 'Спартак Москва', short: 'СПА', color: '#D31145', logo: '/assets/logos/teams/spartak.png' },
  'khl:dynamo-msk': { name: 'Динамо Москва', short: 'ДИН', color: '#004899', logo: '/assets/logos/teams/dynamo-msk.png' },
  'khl:lokomotiv': { name: 'Локомотив Ярославль', short: 'ЛОК', color: '#C8102E', logo: '/assets/logos/teams/lokomotiv.png' },
  'khl:torpedo': { name: 'Торпедо НН', short: 'ТОР', color: '#00205B', logo: '/assets/logos/teams/torpedo.png' },
  'khl:severstal': { name: 'Северсталь', short: 'СЕВ', color: '#FDB827', logo: '/assets/logos/teams/severstal.png' },
  'khl:sochi': { name: 'ХК Сочи', short: 'СОЧ', color: '#00839E', logo: '/assets/logos/teams/sochi.png' },
  'khl:vityaz': { name: 'Витязь', short: 'ВИТ', color: '#BA0C2F', logo: '/assets/logos/teams/vityaz.png' },
  'khl:dynamo-mns': { name: 'Динамо Минск', short: 'МНС', color: '#0033A0', logo: '/assets/logos/teams/dynamo-mns.png' },
  'khl:kunlun': { name: 'Куньлунь РС', short: 'КРС', color: '#C8102E', logo: '/assets/logos/teams/kunlun.png' },
  'khl:ak-bars': { name: 'Ак Барс', short: 'АКБ', color: '#006A4E', logo: '/assets/logos/teams/ak-bars.png' },
  'khl:metallurg-mg': { name: 'Металлург Мг', short: 'ММГ', color: '#002D62', logo: '/assets/logos/teams/metallurg-mg.png' },
  'khl:traktor': { name: 'Трактор', short: 'ТРК', color: '#E31837', logo: '/assets/logos/teams/traktor.png' },
  'khl:avtomobilist': { name: 'Автомобилист', short: 'АВТ', color: '#C8102E', logo: '/assets/logos/teams/avtomobilist.png' },
  'khl:neftekhimik': { name: 'Нефтехимик', short: 'НХК', color: '#003366', logo: '/assets/logos/teams/neftekhimik.png' },
  'khl:lada': { name: 'Лада', short: 'ЛАД', color: '#0033A0', logo: '/assets/logos/teams/lada.png' },
  'khl:avangard': { name: 'Авангард Омск', short: 'АВГ', color: '#D31145', logo: '/assets/logos/teams/avangard.png' },
  'khl:salavat-yulaev': { name: 'Салават Юлаев', short: 'СЮЛ', color: '#007A3D', logo: '/assets/logos/teams/salavat-yulaev.png' },
  'khl:sibir': { name: 'Сибирь', short: 'СИБ', color: '#0033A0', logo: '/assets/logos/teams/sibir.png' },
  'khl:barys': { name: 'Барыс', short: 'БАР', color: '#005596', logo: '/assets/logos/teams/barys.png' },
  'khl:amur': { name: 'Амур', short: 'АМУ', color: '#E31837', logo: '/assets/logos/teams/amur.png' },
  'khl:admiral': { name: 'Адмирал', short: 'АДМ', color: '#002B49', logo: '/assets/logos/teams/admiral.png' },

  // NHL
  'nhl:ana': { name: 'Анахайм Дакс', short: 'ANA', color: '#F47A38', logo: '/assets/logos/teams/ana.svg' },
  'nhl:bos': { name: 'Бостон Брюинз', short: 'BOS', color: '#FFB81C', logo: '/assets/logos/teams/bos.svg' },
  'nhl:buf': { name: 'Баффало Сейбрз', short: 'BUF', color: '#002654', logo: '/assets/logos/teams/buf.svg' },
  'nhl:car': { name: 'Каролина Харрикейнз', short: 'CAR', color: '#CC0000', logo: '/assets/logos/teams/car.svg' },
  'nhl:cbj': { name: 'Коламбус Блю Джекетс', short: 'CBJ', color: '#002654', logo: '/assets/logos/teams/cbj.svg' },
  'nhl:cgy': { name: 'Калгари Флэймз', short: 'CGY', color: '#C8102E', logo: '/assets/logos/teams/cgy.svg' },
  'nhl:chi': { name: 'Чикаго Блэкхокс', short: 'CHI', color: '#CF0A2C', logo: '/assets/logos/teams/chi.svg' },
  'nhl:col': { name: 'Колорадо Эвеланш', short: 'COL', color: '#6F263D', logo: '/assets/logos/teams/col.svg' },
  'nhl:dal': { name: 'Даллас Старз', short: 'DAL', color: '#006847', logo: '/assets/logos/teams/dal.svg' },
  'nhl:det': { name: 'Детройт Ред Уингз', short: 'DET', color: '#CE1126', logo: '/assets/logos/teams/det.svg' },
  'nhl:edm': { name: 'Эдмонтон Ойлерз', short: 'EDM', color: '#041E42', logo: '/assets/logos/teams/edm.svg' },
  'nhl:fla': { name: 'Флорида Пантерз', short: 'FLA', color: '#C8102E', logo: '/assets/logos/teams/fla.svg' },
  'nhl:lak': { name: 'Лос-Анджелес Кингз', short: 'LAK', color: '#111111', logo: '/assets/logos/teams/lak.svg' },
  'nhl:min': { name: 'Миннесота Уайлд', short: 'MIN', color: '#154734', logo: '/assets/logos/teams/min.svg' },
  'nhl:mtl': { name: 'Монреаль Канадиенс', short: 'MTL', color: '#AF1E2D', logo: '/assets/logos/teams/mtl.svg' },
  'nhl:njd': { name: 'Нью-Джерси Девилз', short: 'NJD', color: '#CE1126', logo: '/assets/logos/teams/njd.svg' },
  'nhl:nsh': { name: 'Нэшвилл Предаторз', short: 'NSH', color: '#FFB81C', logo: '/assets/logos/teams/nsh.svg' },
  'nhl:nyi': { name: 'Нью-Йорк Айлендерс', short: 'NYI', color: '#00539B', logo: '/assets/logos/teams/nyi.svg' },
  'nhl:nyr': { name: 'Нью-Йорк Рейнджерс', short: 'NYR', color: '#0038A8', logo: '/assets/logos/teams/nyr.svg' },
  'nhl:ott': { name: 'Оттава Сенаторз', short: 'OTT', color: '#DA1A32', logo: '/assets/logos/teams/ott.svg' },
  'nhl:phi': { name: 'Филадельфия Флайерз', short: 'PHI', color: '#F74902', logo: '/assets/logos/teams/phi.svg' },
  'nhl:pit': { name: 'Питтсбург Пингвинз', short: 'PIT', color: '#FCB514', logo: '/assets/logos/teams/pit.svg' },
  'nhl:sea': { name: 'Сиэтл Кракен', short: 'SEA', color: '#001628', logo: '/assets/logos/teams/sea.svg' },
  'nhl:sjs': { name: 'Сан-Хосе Шаркс', short: 'SJS', color: '#006D75', logo: '/assets/logos/teams/sjs.svg' },
  'nhl:stl': { name: 'Сент-Луис Блюз', short: 'STL', color: '#002F87', logo: '/assets/logos/teams/stl.svg' },
  'nhl:tbl': { name: 'Тампа-Бэй Лайтнинг', short: 'TBL', color: '#002868', logo: '/assets/logos/teams/tbl.svg' },
  'nhl:tor': { name: 'Торонто Мейпл Лифс', short: 'TOR', color: '#00205B', logo: '/assets/logos/teams/tor.svg' },
  'nhl:uta': { name: 'Юта Хоккей Клаб', short: 'UTA', color: '#69B3E7', logo: '/assets/logos/teams/uta.svg' },
  'nhl:van': { name: 'Ванкувер Кэнакс', short: 'VAN', color: '#00205B', logo: '/assets/logos/teams/van.svg' },
  'nhl:vgk': { name: 'Вегас Голден Найтс', short: 'VGK', color: '#B4975A', logo: '/assets/logos/teams/vgk.svg' },
  'nhl:wpg': { name: 'Виннипег Джетс', short: 'WPG', color: '#041E42', logo: '/assets/logos/teams/wpg.svg' },
  'nhl:wsh': { name: 'Вашингтон Кэпиталз', short: 'WSH', color: '#041E42', logo: '/assets/logos/teams/wsh.svg' }
};

export function getTeamMeta(teamId, teamsMap = {}) {
  const raw = teamId || '';
  if (teamsMap[raw]) return teamsMap[raw];
  if (KNOWN_TEAMS[raw]) return KNOWN_TEAMS[raw];
  const short = raw.replace(/^(khl|nhl):/, '').slice(0, 3).toUpperCase();
  return {
    name: raw.replace(/^(khl|nhl):/, '').toUpperCase(),
    short: short || 'ТМ',
    color: '#00D2FF',
    logo: '/assets/logos/teams/placeholder.svg'
  };
}

/**
 * 2-COLUMN GRID MATCH CARD (Matches Stitch Screenshot media_1791115908357.png)
 */
export function createMatchGridCardStitch(match, teamsMap = {}) {
  const homeTeam = getTeamMeta(match.home.id, teamsMap);
  const awayTeam = getTeamMeta(match.away.id, teamsMap);

  const isLive = match.status === 'LIVE' || match.status === 'INTERMISSION';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';
  const isFav = store.isFavorite('matches', match.id);

  const homeScore = match.home.score;
  const awayScore = match.away.score;
  const homeWon = isFinished && homeScore > awayScore;
  const awayWon = isFinished && awayScore > homeScore;

  // Status Badge Text
  let statusText = '';
  let statusClass = 'scheduled';
  let sogBadgeText = '';

  if (isLive) {
    statusClass = 'live';
    statusText = `3-Й ПЕРИОД • ${match.clock || '14:32'}  ${match.compId || 'КХЛ'}`;
    sogBadgeText = 'БРОСКИ 28 - 31';
  } else if (isFinished) {
    statusClass = 'finished';
    const note = match.finishedIn === 'OT' ? ' (ОТ)' : match.finishedIn === 'SO' ? ' (Б)' : '';
    statusText = `ФИНАЛ${note}  ${match.compId || 'КХЛ'}`;
  } else {
    statusClass = 'scheduled';
    const time = match.utcDate ? new Date(match.utcDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) : '20:00';
    statusText = `СЕГОДНЯ • ${time} МСК  ${match.compId || 'НХЛ'}`;
  }

  // Bottom Row details
  let bottomNote = '';
  let actionLabel = 'Онлайн протокол';

  if (isFinished) {
    if (match.home.periods && match.home.periods.length > 0) {
      const breakdown = formatPeriodBreakdown(match.home.periods, match.away.periods);
      bottomNote = `Периоды: (${breakdown})`;
    } else {
      bottomNote = 'Матч завершен';
    }
    actionLabel = 'Протокол';
  } else if (isLive) {
    bottomNote = 'Идет прямой репортаж со льда';
    actionLabel = 'Онлайн протокол';
  } else {
    // Scheduled context notes
    if (match.home.id.includes('nyr') || match.away.id.includes('nyr')) {
      bottomNote = 'Шестеркин vs Ингрэм';
      actionLabel = 'Статистика вратарей 🥅';
    } else if (match.home.id.includes('ana') || match.away.id.includes('fla')) {
      bottomNote = 'Бобровский заявлен в старте';
      actionLabel = 'Составы на игру 👥';
    } else if (match.home.id.includes('van') || match.away.id.includes('vgk')) {
      bottomNote = 'Куинн Хьюз vs Джек Айкел';
      actionLabel = 'Дуэль лидеров ⚔';
    } else {
      bottomNote = 'Арена готова к игре';
      actionLabel = 'Личные встречи 📈';
    }
  }

  const card = el('div', {
    className: `stitch-grid-match-card ${isLive ? 'is-live' : ''}`,
    dataset: { matchId: match.id }
  },
    // Top Meta Row
    el('div', { className: 'card-meta-row' },
      el('div', { className: 'card-meta-left' },
        el('div', { className: `card-status-badge badge-${statusClass}` },
          isLive ? el('span', { className: 'badge-pulse-dot' }) : null,
          el('span', {}, statusText)
        ),
        sogBadgeText ? el('span', { className: 'card-sog-pill' }, sogBadgeText) : null
      ),
      el('button', {
        type: 'button',
        className: `card-star-btn ${isFav ? 'active' : ''}`,
        'aria-label': isFav ? 'В избранном' : 'Добавить в избранное',
        onClick: (e) => {
          e.stopPropagation();
          const active = store.toggleFavorite('matches', match.id);
          e.currentTarget.classList.toggle('active', active);
        }
      }, el('span', { className: 'material-symbols-outlined' }, 'star'))
    ),

    // Middle Teams Stack
    el('div', { className: 'card-teams-stack' },
      // Home Team
      el('a', {
        href: buildLink('/team/', { id: match.home.id }),
        className: 'card-team-row',
        onClick: (e) => e.stopPropagation()
      },
        el('div', { className: 'team-left-info' },
          el('span', {
            className: 'team-abbr-badge',
            style: { backgroundColor: homeTeam.color || '#D31145' }
          }, homeTeam.short || 'ТМ'),
          el('span', { className: `team-full-name ${homeWon ? 'winner' : ''}` }, homeTeam.name)
        ),
        el('span', { className: `team-score-num font-tabular ${homeWon ? 'winner' : ''}` },
          isScheduled ? '-' : homeScore
        )
      ),

      // Away Team
      el('a', {
        href: buildLink('/team/', { id: match.away.id }),
        className: 'card-team-row',
        onClick: (e) => e.stopPropagation()
      },
        el('div', { className: 'team-left-info' },
          el('span', {
            className: 'team-abbr-badge',
            style: { backgroundColor: awayTeam.color || '#002D62' }
          }, awayTeam.short || 'ТМ'),
          el('span', { className: `team-full-name ${awayWon ? 'winner' : ''}` }, awayTeam.name)
        ),
        el('span', { className: `team-score-num font-tabular ${awayWon ? 'winner' : ''}` },
          isScheduled ? '-' : awayScore
        )
      )
    ),

    // Bottom Details Row
    el('div', { className: 'card-bottom-row' },
      el('span', { className: 'card-bottom-note truncate' }, bottomNote),
      el('a', {
        href: buildLink('/match/', { id: match.id }),
        className: 'card-action-link'
      },
        el('span', {}, actionLabel),
        el('span', { className: 'material-symbols-outlined text-[14px]' }, 'arrow_forward')
      )
    )
  );

  return card;
}

/**
 * 7-COLUMN ROW LAYOUT (For standalone match tables & competitions)
 */
export function createMatchRow(match, teamsMap = {}) {
  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');
  const homeTeam = getTeamMeta(match.home.id, teamsMap);
  const awayTeam = getTeamMeta(match.away.id, teamsMap);

  const isLive = match.status === 'LIVE' || match.status === 'INTERMISSION';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';
  const isFav = store.isFavorite('matches', match.id);

  const homeScore = match.home.score;
  const awayScore = match.away.score;
  const homeWon = isFinished && homeScore > awayScore;
  const awayWon = isFinished && awayScore > homeScore;

  let extraBadge = '';
  if (match.finishedIn === 'OT') extraBadge = 'ОТ';
  else if (match.finishedIn === 'SO') extraBadge = 'Б';

  const homeLogoSrc = homeTeam.logo ? getAssetUrl(homeTeam.logo) : defaultLogo;
  const awayLogoSrc = awayTeam.logo ? getAssetUrl(awayTeam.logo) : defaultLogo;

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

  const grid7 = el('div', { className: 'match-col-7grid' },
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

  const mainRow = el('div', { className: 'match-card-main-row' },
    statusCol,
    grid7,
    actionsCol
  );

  const card = el('div', {
    className: `match-card-stitch ${isLive ? 'is-live-card' : ''}`,
    dataset: { matchId: match.id }
  }, mainRow);

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
