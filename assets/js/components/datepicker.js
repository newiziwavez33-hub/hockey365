/**
 * Hockey365 Date Ribbon Component (Google Stitch Design 100% Fidelity)
 */

import { el } from '../core/dom.js';
import { getTodayISODate } from '../core/format.js';

export function createDatepicker(currentDateStr, onDateSelect) {
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(currentDateStr || '') &&
    !Number.isNaN(Date.parse(`${currentDateStr}T12:00:00Z`))
    ? currentDateStr : getTodayISODate();
  const current = new Date(`${selected}T12:00:00Z`);

  // Generate 7 days centered on current date (-2 to +4 or -3 to +3)
  const days = [];
  for (let offset = -2; offset <= 4; offset++) {
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

  const prevDate = new Date(current);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(current);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  const prevIso = prevDate.toISOString().slice(0, 10);
  const nextIso = nextDate.toISOString().slice(0, 10);

  // Hidden date input for native picker
  const dateInput = el('input', {
    type: 'date',
    className: 'ribbon-calendar-input',
    value: selected,
    'aria-label': 'Выбрать дату в календаре',
    onChange: (e) => {
      if (e.target.value) {
        onDateSelect(e.target.value);
      }
    }
  });

  const dayButtons = days.map(d => {
    const dayNames = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    const name = d.isToday ? 'СЕГОДНЯ' : dayNames[d.date.getUTCDay()];
    const num = d.date.getUTCDate();

    return el('button', {
      type: 'button',
      className: `stitch-day-card ${d.isActive ? 'active' : ''}`,
      'aria-label': `${name} ${num}`,
      'aria-pressed': d.isActive ? 'true' : 'false',
      onClick: () => onDateSelect(d.iso)
    },
      el('span', { className: 'stitch-day-label' }, name),
      el('span', { className: 'stitch-day-num font-tabular' }, num)
    );
  });

  const ribbon = el('div', { className: 'stitch-datepicker-ribbon' },
    // Prev arrow
    el('button', {
      type: 'button',
      className: 'stitch-ribbon-arrow',
      'aria-label': 'Предыдущий день',
      title: 'Предыдущий день',
      onClick: () => onDateSelect(prevIso)
    },
      el('span', { className: 'material-symbols-outlined' }, 'chevron_left')
    ),

    // Days container
    el('div', { className: 'stitch-ribbon-days' }, dayButtons),

    // Next arrow
    el('button', {
      type: 'button',
      className: 'stitch-ribbon-arrow',
      'aria-label': 'Следующий день',
      title: 'Следующий день',
      onClick: () => onDateSelect(nextIso)
    },
      el('span', { className: 'material-symbols-outlined' }, 'chevron_right')
    ),

    dateInput
  );

  return ribbon;
}
