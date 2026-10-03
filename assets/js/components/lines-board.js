/**
 * Hockey365 Hockey Lines Board (Пятёрки звеньев и вратари)
 */

import { el } from '../core/dom.js';
import { playerName } from '../core/profile-links.js';

export function createLinesBoard(teamName, lineupData, available = new Set(), playersMap = {}) {
  const container = el('div', { className: 'lines-board' });

  // 1. Goalies
  if (lineupData.goalies && lineupData.goalies.length > 0) {
    const goaliesUnit = el('div', { className: 'line-unit' },
      el('div', { className: 'line-unit-title' }, 'Вратари'),
      el('div', { className: 'flex gap-8' },
        lineupData.goalies.map((g, idx) => {
          const pInfo = playersMap[g.playerId] || { name: g.name || g.playerId, number: g.number };
          return el('div', { className: 'player-chip flex-1' },
            el('span', { className: 'num' }, `#${pInfo.number || '-'}`),
            playerName(g.playerId, pInfo.name, available),
            el('span', { className: 'text-xs text-muted', style: { marginLeft: '4px' } },
              idx === 0 ? '(Старт)' : '(Запас)'
            )
          );
        })
      )
    );
    container.appendChild(goaliesUnit);
  }

  // 2. Lines (1-4)
  if (lineupData.lines && lineupData.lines.length > 0) {
    lineupData.lines.forEach((line, idx) => {
      const lineUnit = el('div', { className: 'line-unit' },
        el('div', { className: 'line-unit-title' }, `${idx + 1}-е звено`),
        // Forwards (LW, C, RW)
        el('div', { className: 'line-players' },
          ['LW', 'C', 'RW'].map(pos => {
            const playerId = line[pos];
            const pInfo = playersMap[playerId] || { name: line[`${pos}_name`] || playerId || '-', number: '' };
            return el('div', { className: 'player-chip' },
              el('div', { className: 'text-xs text-muted' }, pos),
              pInfo.number ? el('span', { className: 'num' }, `#${pInfo.number}`) : null,
              playerId ? playerName(playerId, pInfo.name, available) : el('span', {}, '-')
            );
          })
        ),
        // Defense (LD, RD)
        el('div', { className: 'line-defense' },
          ['LD', 'RD', 'D1', 'D2'].filter(p => line[p] !== undefined).slice(0, 2).map((pos, pIdx) => {
            const playerId = line[pos];
            const pInfo = playersMap[playerId] || { name: line[`${pos}_name`] || playerId || '-', number: '' };
            return el('div', { className: 'player-chip' },
              el('div', { className: 'text-xs text-muted' }, pIdx === 0 ? 'LD' : 'RD'),
              pInfo.number ? el('span', { className: 'num' }, `#${pInfo.number}`) : null,
              playerId ? playerName(playerId, pInfo.name, available) : el('span', {}, '-')
            );
          })
        )
      );
      container.appendChild(lineUnit);
    });
  }

  return el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h4', { className: 'card-title' }, `Состав: ${teamName}`)
    ),
    el('div', { className: 'card-body' }, container)
  );
}
