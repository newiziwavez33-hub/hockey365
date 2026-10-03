/**
 * Hockey365 i18n & Hockey Terminology Dictionary
 */

export const I18N = {
  ru: {
    common: {
      all: 'Все',
      today: 'Сегодня',
      yesterday: 'Вчера',
      tomorrow: 'Завтра',
      live: 'LIVE',
      scheduled: 'Запланирован',
      finished: 'Завершен',
      intermission: 'Перерыв',
      overtime: 'ОТ',
      shootout: 'Буллиты',
      period: 'Период',
      score: 'Счет',
      table: 'Таблица',
      calendar: 'Календарь',
      playoff: 'Плей-офф',
      leaders: 'Лидеры',
      teams: 'Команды',
      players: 'Игроки',
      matches: 'Матчи',
      news: 'Новости',
      transfers: 'Трансферы',
      favorites: 'Избранное',
      myFeed: 'Моя лента',
      search: 'Поиск',
      settings: 'Настройки',
      empty: 'Нет данных',
      loading: 'Загрузка...'
    },
    positions: {
      G: 'Вратарь',
      D: 'Защитник',
      LW: 'Левый нападающий',
      C: 'Центральный нападающий',
      RW: 'Правый нападающий'
    },
    stats: {
      gp: 'И',
      g: 'Ш',
      a: 'П',
      pts: 'О',
      plusMinus: '+/-',
      pim: 'Штр',
      shots: 'Броски',
      sog: 'Броски в створ',
      toi: 'Время',
      gaa: 'КН',
      svPct: '%ОБ',
      so: 'СМ',
      w: 'В',
      l: 'П',
      otl: 'ПО'
    },
    strengths: {
      EV: 'Равные составы',
      PP: 'В большинстве',
      SH: 'В меньшинстве',
      EN: 'В пустые ворота',
      PS: 'Штрафной бросок'
    }
  }
};

export function t(path, lang = 'ru') {
  const parts = path.split('.');
  let current = I18N[lang] || I18N.ru;
  for (const part of parts) {
    if (!current || current[part] === undefined) return path;
    current = current[part];
  }
  return current;
}
