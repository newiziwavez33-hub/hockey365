/**
 * Hockey365 Date Ribbon Component
 */

import { el } from '../core/dom.js';
import { getTodayISODate } from '../core/format.js';

export function createDatepicker(currentDateStr, onDateSelect) {
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(currentDateStr || '') &&
    !Number.isNaN(Date.parse(`${currentDateStr}T12:00:00Z`))
    ? currentDateStr : getTodayISODate();
  const current = new Date(`${selected}T12:00:00Z`);

  // Generate 7 days centered on current date (-3 to +3)
  const days = [];
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(current);
    d.setUTCDate(d.getUTCDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: d,
      iso,
      isToday: iso === getTodayISODate(),
      isActive: iso === selected
    });
  }

  const dayButtons = days.map(d => {
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const name = d.isToday ? 'СЕГОДНЯ' : dayNames[d.date.getUTCDay()];
    const num = d.date.getUTCDate();

    return el('button', {
      className: `day-btn ${d.isActive ? 'active' : ''}`,
      'aria-label': d.iso,
      'aria-pressed': d.isActive ? 'true' : 'false',
      onClick: () => onDateSelect(d.iso)
    },
      el('span', { className: 'day-name' }, name),
      el('span', { className: 'day-num' }, num)
    );
  });

  const prevDate = new Date(current);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(current);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

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
      value: selected,
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
