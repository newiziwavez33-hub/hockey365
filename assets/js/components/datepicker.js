/**
 * Hockey365 Date Ribbon Component (Google Stitch Design)
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
    const dayNames = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    const name = d.isToday ? 'СЕГОДНЯ' : dayNames[d.date.getUTCDay()];
    const num = d.date.getUTCDate();

    return el('button', {
      className: `day-btn ${d.isActive ? 'active' : ''}`,
      'aria-label': `${name} ${num}`,
      'aria-pressed': d.isActive ? 'true' : 'false',
      onClick: () => onDateSelect(d.iso)
    },
      el('span', { className: 'day-name' }, name),
      el('span', { className: 'day-num font-tabular' }, num)
    );
  });

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

  const ribbon = el('div', { className: 'date-ribbon' },
    // Prev arrow
    el('button', {
      className: 'ribbon-arrow',
      'aria-label': 'Предыдущий день',
      title: 'Предыдущий день',
      onClick: () => onDateSelect(prevIso)
    },
      el('span', { className: 'material-symbols-outlined' }, 'chevron_left')
    ),

    // Days container
    el('div', { className: 'ribbon-days' }, dayButtons),

    // Next arrow
    el('button', {
      className: 'ribbon-arrow',
      'aria-label': 'Следующий день',
      title: 'Следующий день',
      onClick: () => onDateSelect(nextIso)
    },
      el('span', { className: 'material-symbols-outlined' }, 'chevron_right')
    ),

    // Stitch Calendar Trigger Button
    el('div', { className: 'calendar-trigger-wrap' },
      el('button', {
        type: 'button',
        className: 'calendar-trigger-btn',
        'aria-label': 'Открыть календарь',
        onClick: () => {
          if (typeof dateInput.showPicker === 'function') {
            dateInput.showPicker();
          } else {
            dateInput.focus();
            dateInput.click();
          }
        }
      },
        el('span', { className: 'material-symbols-outlined' }, 'calendar_month'),
        el('span', { className: 'calendar-text' }, 'Календарь')
      ),
      dateInput
    )
  );

  return ribbon;
}

