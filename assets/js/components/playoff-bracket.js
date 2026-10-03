/**
 * Hockey365 Playoff Bracket Component
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { getAssetUrl } from '../core/config.js';

export function createPlayoffBracket(bracketData, teamsMap = {}) {
  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

  const container = el('div', { className: 'playoff-container' });

  for (const round of bracketData.rounds) {
    const roundCol = el('div', { className: 'playoff-round' },
      el('div', { className: 'playoff-round-title' }, round.roundName)
    );

    for (const series of round.series) {
      const home = teamsMap[series.homeTeamId] || { name: series.homeTeamId, short: series.homeTeamId, logo: '' };
      const away = teamsMap[series.awayTeamId] || { name: series.awayTeamId, short: series.awayTeamId, logo: '' };

      const homeWins = series.wins[0];
      const awayWins = series.wins[1];
      const homeWon = homeWins >= Math.ceil(series.bestOf / 2);
      const awayWon = awayWins >= Math.ceil(series.bestOf / 2);

      const seriesCard = el('div', { className: 'playoff-series-card' },
        // Home Team Row
        el('div', { className: `series-team-row ${homeWon ? 'is-winner' : ''}` },
          el('div', { className: 'flex items-center gap-6' },
            el('img', {
              src: home.logo ? getAssetUrl(home.logo) : defaultLogo,
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
          el('div', { className: 'flex items-center gap-6' },
            el('img', {
              src: away.logo ? getAssetUrl(away.logo) : defaultLogo,
              alt: away.name,
              className: 'team-logo-small',
              onerror: (e) => { e.target.src = defaultLogo; }
            }),
            el('a', { href: buildLink('/team/', { id: series.awayTeamId }), className: 'link-accent' }, away.short || away.name)
          ),
          el('span', { className: 'series-score' }, awayWins)
        ),
        // Series Status / Best-of
        el('div', { className: 'text-xs text-muted text-center', style: { marginTop: '4px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '2px' } },
          series.status === 'FINISHED' ? 'Серия завершена' : `Серия до ${series.bestOf} побед`
        )
      );

      roundCol.appendChild(seriesCard);
    }

    container.appendChild(roundCol);
  }

  return el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h3', { className: 'card-title' }, 'Сетка плей-офф')
    ),
    el('div', { className: 'card-body', style: { overflowX: 'auto' } }, container)
  );
}
