/**
 * Hockey365 Playoff Bracket Component
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

// Pre-cached authentic names and logos
const KNOWN_TEAMS = {
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
  'khl:admiral': { name: 'Адмирал', short: 'АДМ', logo: '/assets/logos/teams/admiral.png' }
};

export function createPlayoffBracket(bracketData, teamsMap = {}) {
  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

  const container = el('div', { className: 'playoff-container' });

  for (const round of bracketData.rounds) {
    const roundCol = el('div', { className: 'playoff-round' },
      el('div', { className: 'playoff-round-title' }, round.roundName)
    );

    for (const series of round.series) {
      const home = teamsMap[series.homeTeamId] || KNOWN_TEAMS[series.homeTeamId] || { name: series.homeTeamId, short: series.homeTeamId, logo: '' };
      const away = teamsMap[series.awayTeamId] || KNOWN_TEAMS[series.awayTeamId] || { name: series.awayTeamId, short: series.awayTeamId, logo: '' };

      const homeWins = series.wins[0];
      const awayWins = series.wins[1];
      const homeWon = homeWins >= Math.ceil(series.bestOf / 2);
      const awayWon = awayWins >= Math.ceil(series.bestOf / 2);

      const homeLogoSrc = home.logo ? getAssetUrl(home.logo) : defaultLogo;
      const awayLogoSrc = away.logo ? getAssetUrl(away.logo) : defaultLogo;

      const seriesCard = el('div', { className: 'playoff-series-card' },
        // Home Team Row
        el('div', { className: `series-team-row ${homeWon ? 'is-winner' : ''}` },
          el('div', { className: 'flex items-center gap-8' },
            el('img', {
              src: homeLogoSrc,
              alt: home.name,
              className: 'team-logo-small',
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('a', { href: buildLink('/team/', { id: series.homeTeamId }), className: 'link-accent' }, home.short || home.name)
          ),
          el('span', { className: 'series-score' }, homeWins)
        ),
        // Away Team Row
        el('div', { className: `series-team-row ${awayWon ? 'is-winner' : ''}` },
          el('div', { className: 'flex items-center gap-8' },
            el('img', {
              src: awayLogoSrc,
              alt: away.name,
              className: 'team-logo-small',
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('a', { href: buildLink('/team/', { id: series.awayTeamId }), className: 'link-accent' }, away.short || away.name)
          ),
          el('span', { className: 'series-score' }, awayWins)
        ),
        // Series Status / Best-of
        el('div', { className: 'text-xs text-muted text-center', style: { marginTop: '6px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '4px' } },
          series.status === 'FINISHED' ? 'Серия завершена' : `Серия до ${series.bestOf} побед`
        )
      );

      roundCol.appendChild(seriesCard);
    }

    container.appendChild(roundCol);
  }

  return el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, 'Сетка плей-офф (Кубок Гагарина)')
    ),
    el('div', { className: 'card-body', style: { overflowX: 'auto' } }, container)
  );
}
