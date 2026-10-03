/**
 * Hockey365 Real-Time Live Tracker & Goal Notifier
 */

import { playGoalHorn, playChime } from './sound.js';
import { el } from './dom.js';

let previousScores = new Map(); // matchId -> { home: number, away: number, status: string, period: number }
let isInitialized = false;

/**
 * Toast Container for Goal and Match Events
 */
function getToastContainer() {
  let container = document.getElementById('hockey365-toast-container');
  if (!container) {
    container = el('div', {
      id: 'hockey365-toast-container',
      className: 'goal-toast-container',
      'aria-live': 'polite'
    });
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a floating goal alert toast
 */
export function showGoalToast({ match, teamScored, homeScore, awayScore, homeName, awayName }) {
  const container = getToastContainer();
  const toast = el('div', { className: 'goal-toast' },
    el('div', { className: 'goal-toast-badge' }, '🚨 ГОЛ!'),
    el('div', { className: 'goal-toast-body' },
      el('div', { className: 'goal-toast-title' },
        `${homeName} ${homeScore} : ${awayScore} ${awayName}`
      ),
      el('div', { className: 'goal-toast-sub' },
        `Забросила команда: ${teamScored}`
      )
    )
  );

  container.appendChild(toast);

  // Auto-remove toast after 5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }, 5000);
}

/**
 * Compare new matches list with previous state, detect goals & status changes
 */
export function trackMatchUpdates(matches, teamsMap = {}) {
  if (!matches || !Array.isArray(matches)) return [];

  const events = [];

  for (const match of matches) {
    const prev = previousScores.get(match.id);
    const currHome = Number(match.home?.score ?? 0);
    const currAway = Number(match.away?.score ?? 0);

    if (prev && isInitialized) {
      const homeName = teamsMap[match.home?.id]?.name || match.home?.id?.replace(/^(khl|nhl):/, '').toUpperCase() || 'Хозяева';
      const awayName = teamsMap[match.away?.id]?.name || match.away?.id?.replace(/^(khl|nhl):/, '').toUpperCase() || 'Гости';

      // Home goal
      if (currHome > prev.home) {
        events.push({
          type: 'GOAL',
          matchId: match.id,
          teamScored: homeName,
          homeScore: currHome,
          awayScore: currAway,
          homeName,
          awayName
        });
      }
      // Away goal
      else if (currAway > prev.away) {
        events.push({
          type: 'GOAL',
          matchId: match.id,
          teamScored: awayName,
          homeScore: currHome,
          awayScore: currAway,
          homeName,
          awayName
        });
      }
      // Status change (e.g. Started, Period change, Finished)
      else if (match.status !== prev.status && match.status === 'FINISHED') {
        events.push({
          type: 'FINISHED',
          matchId: match.id,
          homeName,
          awayName,
          homeScore: currHome,
          awayScore: currAway
        });
      }
    }

    // Save snapshot
    previousScores.set(match.id, {
      home: currHome,
      away: currAway,
      status: match.status,
      period: match.period
    });
  }

  isInitialized = true;

  // Dispatch detected events
  for (const ev of events) {
    if (ev.type === 'GOAL') {
      playGoalHorn();
      showGoalToast(ev);
      flashMatchRow(ev.matchId);
    } else if (ev.type === 'FINISHED') {
      playChime();
    }
  }

  return events;
}

/**
 * Flash match row in the DOM on goal
 */
export function flashMatchRow(matchId) {
  const row = document.querySelector(`[data-match-id="${matchId}"]`);
  if (!row) return;

  row.classList.remove('goal-flash');
  void row.offsetWidth; // Force reflow
  row.classList.add('goal-flash');

  setTimeout(() => {
    row.classList.remove('goal-flash');
  }, 4000);
}
