/**
 * Hockey365 Data Formatters (Hockey Domain & Timezone Logic)
 */

import { store } from './store.js';

export function formatDate(isoString, formatType = 'short') {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const tz = store.getTimezone();
  const timeZoneOption = tz === 'local' ? undefined : tz;

  if (formatType === 'time') {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZoneOption
    }).format(date);
  }

  if (formatType === 'dayMonth') {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      timeZone: timeZoneOption
    }).format(date);
  }

  if (formatType === 'full') {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZoneOption
    }).format(date);
  }

  // Default YYYY-MM-DD in selected timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timeZoneOption
  }).formatToParts(date);

  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function formatPeriodStatus(match) {
  if (!match) return '';
  const { status, period, clock, finishedIn } = match;

  if (status === 'SCHEDULED') {
    return formatDate(match.utcDate, 'time');
  }

  if (status === 'FINISHED') {
    if (finishedIn === 'OT') return 'Завершен (ОТ)';
    if (finishedIn === 'SO') return 'Завершен (Б)';
    return 'Завершен';
  }

  if (status === 'INTERMISSION') {
    return `Перерыв (${period || 1})`;
  }

  if (status === 'LIVE') {
    const periodLabel = period === 4 ? 'ОТ' : `${period}-й период`;
    return `${periodLabel} ${clock || ''}`.trim();
  }

  if (status === 'POSTPONED') return 'Перенесен';
  if (status === 'CANCELLED') return 'Отменен';

  return status;
}

export function formatScore(homeScore, awayScore, status) {
  if (status === 'SCHEDULED') return '- : -';
  if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
    return '- : -';
  }
  return `${homeScore} : ${awayScore}`;
}

export function formatPeriodBreakdown(periodsHome = [], periodsAway = []) {
  if (!periodsHome || !periodsAway || periodsHome.length === 0) return '';
  const parts = [];
  const len = Math.max(periodsHome.length, periodsAway.length);
  for (let i = 0; i < len; i++) {
    const h = periodsHome[i] ?? '-';
    const a = periodsAway[i] ?? '-';
    parts.push(`${h}:${a}`);
  }
  return `(${parts.join(', ')})`;
}

export function formatSavePct(svPct) {
  if (svPct === null || svPct === undefined) return '-';
  const num = typeof svPct === 'string' ? parseFloat(svPct) : svPct;
  if (isNaN(num)) return '-';
  // If svPct is decimal 0.925 -> 92.5%
  const val = num <= 1 ? (num * 100).toFixed(1) : num.toFixed(1);
  return `${val}%`;
}

export function formatGAA(gaa) {
  if (gaa === null || gaa === undefined) return '-';
  const num = typeof gaa === 'string' ? parseFloat(gaa) : gaa;
  if (isNaN(num)) return '-';
  return num.toFixed(2);
}

export function formatPosition(pos) {
  const map = {
    G: 'Вратарь',
    D: 'Защитник',
    LD: 'Левый защитник',
    RD: 'Правый защитник',
    LW: 'Левый нападающий',
    C: 'Центральный нападающий',
    RW: 'Правый нападающий'
  };
  return map[pos] || pos || '';
}

export function getTodayISODate() {
  const tz = store.getTimezone();
  const timeZoneOption = tz === 'local' ? undefined : tz;
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timeZoneOption
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}
