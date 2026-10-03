/**
 * Hockey365 Date Ribbon Component
 */

import { el } from '../core/dom.js';
import { getTodayISODate } from '../core/format.js';

export function createDatepicker(currentDateStr, onDateSelect) {
  const current = new Date(currentDateStr || getTodayISODate());

  // Generate 7 days centered on current date (-3 to +3)
  const days = [];
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(current);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: d,
      iso,
      isToday: iso === getTodayISODate(),
      isActive: iso === currentDateStr
    });
  }

  const dayButtons = days.map(d => {
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const name = d.isToday ? 'СЕГОДНЯ' : dayNames[d.date.getDay()];
    const num = d.date.getDate();

    return el('button', {
      className: `day-btn ${d.isActive ? 'active' : ''}`,
      onClick: () => onDateSelect(d.iso)
    },
      el('span', { className: 'day-name' }, name),
      el('span', { className: 'day-num' }, num)
    );
  });

  const prevDate = new Date(current);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(current);
  nextDate.setDate(nextDate.getDate() + 1);

  const prevIso = prevDate.toISOString().slice(0, 10);
  const nextIso = nextDate.toISOString().slice(0, 10);

  const ribbon = el('div', { className: 'date-ribbon' },
    // Prev arrow
    el('button', {
      className: 'ribbon-arrow',
      'aria-label': 'Предыдущий день',
      onClick: () => onDateSelect(prevIso)
    },
      el('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('polyline', { points: '15 18 9 12 15 6' })
      )
    ),

    // Days container
    el('div', { className: 'ribbon-days' }, dayButtons),

    // Next arrow
    el('button', {
      className: 'ribbon-arrow',
      'aria-label': 'Следующий день',
      onClick: () => onDateSelect(nextIso)
    },
      el('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('polyline', { points: '9 18 15 12 9 6' })
      )
    ),

    // Calendar input
    el('input', {
      type: 'date',
      className: 'ribbon-calendar-input',
      value: currentDateStr,
      'aria-label': 'Выбрать дату в календаре',
      onChange: (e) => {
        if (e.target.value) {
          onDateSelect(e.target.value);
        }
      }
    })
  );

  return ribbon;
}
