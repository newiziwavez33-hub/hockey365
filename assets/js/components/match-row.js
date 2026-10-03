/**
 * Hockey365 Match Row Component (Soccer365 UX Style)
 */

import { el } from '../core/dom.js';
import { buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { formatPeriodStatus, formatScore, formatPeriodBreakdown } from '../core/format.js';
import { getAssetUrl } from '../core/config.js';

export function createMatchRow(match, teamsMap = {}) {
  const homeTeam = teamsMap[match.home.id] || { name: match.home.id, short: match.home.id, logo: '' };
  const awayTeam = teamsMap[match.away.id] || { name: match.away.id, short: match.away.id, logo: '' };

  const isLive = match.status === 'LIVE' || match.status === 'INTERMISSION';
  const isFinished = match.status === 'FINISHED';
  const isFav = store.isFavorite('matches', match.id);

  const homeScore = match.home.score;
  const awayScore = match.away.score;

  const homeWon = isFinished && homeScore > awayScore;
  const awayWon = isFinished && awayScore > homeScore;

  // Extra note: OT or SO (буллиты)
  let extraNote = '';
  if (match.finishedIn === 'OT') extraNote = 'ОТ';
  else if (match.finishedIn === 'SO') extraNote = 'Б';

  const defaultLogo = getAssetUrl('assets/logos/teams/placeholder.svg');

  const row = el('div', {
    className: `match-row ${isLive ? 'is-live-row' : ''}`,
    dataset: { matchId: match.id }
  },
    // Column 1: Time / Status
    el('div', { className: `match-time-status ${isLive ? 'is-live' : ''}` },
      isLive ? el('span', { className: 'badge badge-live' },
        el('span', { className: 'live-dot' }),
        formatPeriodStatus(match)
      ) : el('span', {}, formatPeriodStatus(match))
    ),

    // Column 2: Home Team (Right-aligned)
    el('a', {
      href: buildLink('/team/', { id: match.home.id }),
      className: 'match-team team-home',
      onClick: (e) => e.stopPropagation()
    },
      el('span', { className: `match-team-name ${homeWon ? 'is-winner' : ''}` }, homeTeam.name),
      el('img', {
        src: homeTeam.logo ? getAssetUrl(homeTeam.logo) : defaultLogo,
        alt: homeTeam.name,
        className: 'team-logo-small',
        loading: 'lazy',
        onerror: (e) => { e.target.src = defaultLogo; }
      })
    ),

    // Column 3: Score / Match Link
    el('a', {
      href: buildLink('/match/', { id: match.id }),
      className: `match-score-box ${isLive ? 'is-live' : ''}`,
      title: 'Открыть детали матча'
    },
      el('span', {}, formatScore(homeScore, awayScore, match.status)),
      extraNote ? el('span', { className: 'match-extra-note' }, extraNote) : null
    ),

    // Column 4: Away Team (Left-aligned)
    el('a', {
      href: buildLink('/team/', { id: match.away.id }),
      className: 'match-team team-away',
      onClick: (e) => e.stopPropagation()
    },
      el('img', {
        src: awayTeam.logo ? getAssetUrl(awayTeam.logo) : defaultLogo,
        alt: awayTeam.name,
        className: 'team-logo-small',
        loading: 'lazy',
        onerror: (e) => { e.target.src = defaultLogo; }
      }),
      el('span', { className: `match-team-name ${awayWon ? 'is-winner' : ''}` }, awayTeam.name)
    ),

    // Column 5: Favorite star
    el('button', {
      className: `match-fav-star ${isFav ? 'active' : ''}`,
      'aria-label': 'Добавить в избранное',
      title: 'В избранное',
      onClick: (e) => {
        e.stopPropagation();
        const active = store.toggleFavorite('matches', match.id);
        if (active) {
          e.currentTarget.classList.add('active');
        } else {
          e.currentTarget.classList.remove('active');
        }
      }
    },
      el('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: isFav ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
      )
    )
  );

  // If match has period scores, render period breakdown below
  if (match.home.periods && match.home.periods.length > 0) {
    const breakdown = formatPeriodBreakdown(match.home.periods, match.away.periods);
    if (breakdown) {
      const breakdownEl = el('div', { className: 'periods-breakdown' },
        `Счёт по периодам: ${breakdown}`
      );
      row.appendChild(breakdownEl);
    }
  }

  return row;
}
