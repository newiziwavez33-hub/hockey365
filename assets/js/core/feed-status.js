// A successful fetch of an old snapshot is NOT a successful live update.
export function getFeedStatus(value) {
  if (value?.feed) return value.feed;
  const matches = Array.isArray(value) ? value : [value];
  const sources = matches.map(match => match?.source).filter(Boolean);
  const mode = sources.some(source => source.delivery === 'live') ? 'live'
    : sources.some(source => source.delivery === 'schedule') ? 'partial'
    : sources.some(source => source.delivery === 'snapshot') ? 'snapshot' : 'unknown';
  const timestamps = sources.map(source => source.fetchedAt).filter(Boolean).sort();
  return { mode, updatedAt: timestamps[timestamps.length - 1] || null };
}

export function formatFeedStatus(value) {
  const feed = getFeedStatus(value);
  if (feed.feeds) {
    return Object.entries(feed.feeds).map(([league, info]) => {
      const stamp = formatTimestamp(info.updatedAt);
      const label = info.mode === 'live' ? 'официальный API · опрос 10 с'
        : info.mode === 'partial' ? 'расписание · live-протокол недоступен'
          : info.mode === 'snapshot' ? 'сохранённый срез (не LIVE)' : 'источник недоступен';
      return `${league}: ${label} · ${stamp}`;
    }).join(' | ');
  }
  const provider = Array.isArray(value) ? 'официальный источник' : value?.source?.provider || 'официальный источник';
  const timestamp = formatTimestamp(feed.updatedAt);
  if (feed.mode === 'live') return `${provider} · получено ${timestamp} · опрос 10 с`;
  if (feed.mode === 'partial') return `Официальное расписание · live-протокол недоступен · ${timestamp}`;
  if (feed.mode === 'snapshot') return `Сохранённый срез · ${timestamp}. LIVE не подключён: сеть, CORS или прокси недоступны.`;
  return 'Актуальность счёта не подтверждена; ожидается проверка источника.';
}

function formatTimestamp(value) {
  const date = new Date(value || NaN);
  return Number.isNaN(date.getTime()) ? 'время источника неизвестно'
    : date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' МСК';
}
