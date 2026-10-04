# 🏒 Hockey365 — Хоккейный портал онлайн

> Независимый статический спортивный портал по аналогии с Soccer365.ru, полностью адаптированный под специфику хоккея с шайбой (**КХЛ, НХЛ, ВХЛ, МХЛ**).

[![Deploy to GitHub Pages](https://github.com/newiziwavez33-hub/hockey365/actions/workflows/deploy.yml/badge.svg)](https://github.com/newiziwavez33-hub/hockey365/actions/workflows/deploy.yml)
[![CI Validation and Tests](https://github.com/newiziwavez33-hub/hockey365/actions/workflows/ci.yml/badge.svg)](https://github.com/newiziwavez33-hub/hockey365/actions/workflows/ci.yml)

🌐 **Живой сайт:** [https://newiziwavez33-hub.github.io/hockey365/](https://newiziwavez33-hub.github.io/hockey365/)

---

## ⚡ Ключевые особенности и архитектура

* **Zero-Build & Zero-Node:** Публикуемая часть сайта не требует Vite, Node.js, npm, Webpack или backend runtime. Браузер исполняет нативные ES-модули JavaScript.
* **Репозиторий = База Данных:** Все сущности хранятся в виде структурированных статических JSON-файлов в `/data`.
* **Хостинг:** любой статический хостинг: GitHub Pages, Netlify, Cloudflare Pages, S3/nginx или shared hosting. Поддерживается публикация из корня и из подпапки.
* **Автоматизация данных:** GitHub Actions + Python 3 скрипты сбора НХЛ, индексации и валидации по расписанию cron. Для КХЛ проверенный поставщик пока не подключён: прежние демонстрационные результаты скрыты в интерфейсе.
* **Специфика хоккея:**
  * Счёт по 3 периодам + Овертайм (3х3) + серия буллитов.
  * Точные формулы начисления очков по регламенту лиг (`2-1-0-ot` для современной КХЛ и НХЛ, `3-2-1-0` для классической системы).
  * Конференции и дивизионы (Боброва, Тарасова, Харламова, Чернышёва / Атлантический, Столичный, Центральный, Тихоокеанский).
  * Интерактивная сетка плей-офф (Кубок Гагарина и Кубок Стэнли, серии до 4 побед).
  * Пятёрки звеньев (LW - C - RW, LD - RD) и вратарские пары на странице матча.
  * Интерактивная векторная ледовая площадка SVG.
  * Раздельная статистика: полевые игроки (Г+П, +/-, Штр, SOG, TOI) и вратари (%ОБ, КН, СМ, W/L/OTL).
* **PWA & Offline:** Service Worker кэширует оболочку и последние загруженные матчи.
* **Персонализация:** Избранные клубы и «Моя лента», тёмная тема («Ледовая Арена») и светлая тема («Сталь и Лёд»), выбор часового пояса (Europe/Moscow, местное браузера, UTC).
* **Трансляции:** во вкладке «Трансляция» публикуются только подтверждённые ссылки правообладателей. Для НХЛ текущий сборщик добавляет официальный NHL Gamecenter; встроенные HTTPS-плееры загружаются только после клика и проходят allowlist-проверку. Пиратские и неподтверждённые ссылки не показываются.

> `server/` — необязательный Node/Hono-прокси для SSE live-режима. Статический сайт без него запускается и публикуется полностью; при недоступности прокси используется Python-собранный JSON snapshot. Node/Vite не нужны для обычного деплоя.

---

## 📂 Структура проекта

```
hockey365/
├── index.html                   # Главная страница (сохранённые матчи и календарь)
├── online/index.html            # Статусы матчей из последнего опубликованного среза
├── competitions/index.html      # Каталог турниров и лиг
├── competition/index.html       # Турнир (таблицы, сетка плей-офф, лидеры, календарь)
├── match/index.html             # Матч-центр (хроника, голы, удаления, пятёрки, статистика)
├── team/index.html              # Профиль клуба (состав, арена, матчи)
├── player/index.html            # Профиль игрока / вратаря
├── news/index.html              # Новости хоккея
├── transfers/index.html         # Таблица переходов и обменов
├── search/index.html            # Клиентский поиск с транслитерацией (RU/EN)
├── favorites/index.html         # Моя лента и избранное (localStorage)
├── settings/index.html          # Выбор темы, пояса, экспорт/импорт настроек
├── about/index.html             # О проекте и источниках данных
├── privacy/index.html           # Конфиденциальность
├── 404.html                     # Страница 404
├── sw.js, manifest.webmanifest  # PWA манифест и Service Worker
├── assets/
│   ├── css/ (tokens.css, base.css, components.css)
│   ├── js/
│   │   ├── core/ (config.js, dom.js, store.js, format.js, api.js, router.js, i18n.js)
│   │   ├── components/ (site-header.js, site-footer.js, match-row.js, standings-table.js, ...)
│   │   └── pages/ (home.js, online.js, competition.js, match.js, ...)
│   └── logos/, flags/
├── data/                        # База данных JSON
│   ├── competitions.json        # Правила лиг, конференции, дивизионы
│   ├── standings/               # Таблицы КХЛ и НХЛ
│   ├── playoffs/                # Сетки плей-офф
│   ├── leaders/                 # Лидеры бомбардиров и вратарей
│   ├── matches/                 # Boxscore матчей и ленты по датам
│   ├── teams/, players/         # Профили клубов и игроков
│   ├── news/, transfers/        # Новости и переходы
│   └── search-index.json        # Поисковый индекс
├── tools/                       # Скрипты автоматизации на Python 3
│   ├── adapters/                # Адаптеры NHL Web API и KHL
│   ├── normalize.py             # Нормализация данных
│   ├── validate_data.py         # Валидатор схем и бизнес-правил хоккея
│   ├── build_search_index.py    # Сборка индекса поиска
│   └── build_sitemap.py         # Генерация sitemap.xml и robots.txt
├── schemas/                     # JSON Schema спецификации
├── tests/                       # Pytest набор юнит- и интеграционных тестов
└── .github/workflows/           # GitHub Actions (deploy.yml, data-update.yml, ci.yml)
```

`server/` и `db/` — необязательные заготовки live-прокси/хранилища. Они не нужны для публикации статического сайта и не входят в обычный deployment artifact.

---

## 🚀 Быстрый запуск локально

Так как сайт полностью статический и не требует Node.js:

```bash
# Клонируйте репозиторий
git clone https://github.com/newiziwavez33-hub/hockey365.git
cd hockey365

# Запустите локальный веб-сервер Python:
python3 -m http.server 8000
```

Откройте в браузере: `http://localhost:8000`

---

## 🧪 Тестирование и валидация

Для запуска валидаторов схем и тестов:

```bash
# Установка зависимостей тестов (requests, jsonschema, pytest)
pip install -r tools/requirements.txt

# Проверка всех JSON по схемам и хоккейным правилам
python3 tools/validate_data.py

# Запуск полного набора тестов pytest
pytest tests/ -v
```

---

## 🔄 Обновление данных

1. **НХЛ:** Скрипт `tools/adapters/nhl_web.py` опрашивает открытый публичный Web API НХЛ (`api-web.nhle.com/v1`) без ключей.
2. **КХЛ:** Верифицированного источника пока нет. `tools/adapters/khl_aggregator.py` не генерирует демонстрационные результаты; КХЛ скрыта в пользовательских потоках до подключения и проверки поставщика. Старые файлы `data/` всё ещё находятся в репозитории и не должны публиковаться как подтверждённые результаты без отдельной очистки.

Для ручного обновления данных запустите:
```bash
python3 tools/adapters/nhl_web.py
python3 tools/adapters/khl_aggregator.py
python3 tools/normalize.py
python3 tools/validate_data.py
python3 tools/build_search_index.py
```

---

## 📄 Лицензия и правовая информация

Код распространяется под лицензией MIT. Товарные знаки, названия и эмблемы клубов КХЛ и НХЛ принадлежат их законным правообладателям и используются исключительно в информационных целях.
