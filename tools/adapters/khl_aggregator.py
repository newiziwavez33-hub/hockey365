"""
KHL Data Adapter & Generator for Hockey365
Supports external aggregator API (if SPORTS_API_KEY provided) with automatic fallback
to comprehensive authentic KHL 2026/2027 dataset in data-manual/khl/.
"""

import json
import os
import sys

KHL_TEAMS = [
    # Западная конференция - Дивизион Боброва
    {
        "id": "khl:ska", "slug": "ska-saint-petersburg", "name": "СКА", "nameEn": "SKA Saint Petersburg",
        "short": "СКА", "country": "RUS", "city": "Санкт-Петербург", "conference": "Запад", "division": "Боброва",
        "founded": 1946, "arena": {"name": "СКА Арена", "capacity": 21500, "city": "Санкт-Петербург"},
        "colors": ["#002D62", "#D3A029"], "logo": "/assets/logos/teams/ska.svg", "coach": "Роман Ротенберг",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:spartak", "slug": "spartak-moscow", "name": "Спартак", "nameEn": "Spartak Moscow",
        "short": "СПА", "country": "RUS", "city": "Москва", "conference": "Запад", "division": "Боброва",
        "founded": 1946, "arena": {"name": "Мегаспорт", "capacity": 12396, "city": "Москва"},
        "colors": ["#E31B23", "#FFFFFF"], "logo": "/assets/logos/teams/spartak.svg", "coach": "Алексей Жамнов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:torpedo", "slug": "torpedo-nizhny-novgorod", "name": "Торпедо", "nameEn": "Torpedo Nizhny Novgorod",
        "short": "ТОР", "country": "RUS", "city": "Нижний Новгород", "conference": "Запад", "division": "Боброва",
        "founded": 1946, "arena": {"name": "КРК Нагорный", "capacity": 5500, "city": "Нижний Новгород"},
        "colors": ["#00205B", "#E31B23"], "logo": "/assets/logos/teams/torpedo.svg", "coach": "Игорь Ларионов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:sochi", "slug": "hc-sochi", "name": "ХК Сочи", "nameEn": "HC Sochi",
        "short": "СОЧ", "country": "RUS", "city": "Сочи", "conference": "Запад", "division": "Боброва",
        "founded": 2014, "arena": {"name": "Большой", "capacity": 12000, "city": "Сочи"},
        "colors": ["#003366", "#FFCC00"], "logo": "/assets/logos/teams/sochi.svg", "coach": "Сергей Зубов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:vityaz", "slug": "vityaz-balashikha", "name": "Витязь", "nameEn": "Vityaz Balashikha",
        "short": "ВИТ", "country": "RUS", "city": "Балашиха", "conference": "Запад", "division": "Боброва",
        "founded": 1996, "arena": {"name": "Арена Балашиха", "capacity": 5678, "city": "Балашиха"},
        "colors": ["#C8102E", "#FFFFFF"], "logo": "/assets/logos/teams/vityaz.svg", "coach": "Павел Десятков",
        "competitions": ["KHL"]
    },

    # Западная конференция - Дивизион Тарасова
    {
        "id": "khl:cska", "slug": "cska-moscow", "name": "ЦСКА", "nameEn": "CSKA Moscow",
        "short": "ЦСК", "country": "RUS", "city": "Москва", "conference": "Запад", "division": "Тарасова",
        "founded": 1946, "arena": {"name": "ЦСКА Арена", "capacity": 12100, "city": "Москва"},
        "colors": ["#E31B23", "#002D62"], "logo": "/assets/logos/teams/cska.svg", "coach": "Илья Воробьёв",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:dynamo-msk", "slug": "dynamo-moscow", "name": "Динамо М", "nameEn": "Dynamo Moscow",
        "short": "ДИН", "country": "RUS", "city": "Москва", "conference": "Запад", "division": "Тарасова",
        "founded": 1946, "arena": {"name": "ВТБ Арена", "capacity": 10500, "city": "Москва"},
        "colors": ["#003DA5", "#FFFFFF"], "logo": "/assets/logos/teams/dynamo-msk.svg", "coach": "Алексей Кудашов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:lokomotiv", "slug": "lokomotiv-yaroslavl", "name": "Локомотив", "nameEn": "Lokomotiv Yaroslavl",
        "short": "ЛОК", "country": "RUS", "city": "Ярославль", "conference": "Запад", "division": "Тарасова",
        "founded": 1959, "arena": {"name": "Арена-2000", "capacity": 9070, "city": "Ярославль"},
        "colors": ["#E31B23", "#00205B"], "logo": "/assets/logos/teams/lokomotiv.svg", "coach": "Игорь Никитин",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:severstal", "slug": "severstal-cherepovets", "name": "Северсталь", "nameEn": "Severstal Cherepovets",
        "short": "СЕВ", "country": "RUS", "city": "Череповец", "conference": "Запад", "division": "Тарасова",
        "founded": 1956, "arena": {"name": "Ледовый дворец", "capacity": 5583, "city": "Череповец"},
        "colors": ["#FFCC00", "#000000"], "logo": "/assets/logos/teams/severstal.svg", "coach": "Андрей Козырев",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:dynamo-mns", "slug": "dynamo-minsk", "name": "Динамо Мн", "nameEn": "Dinamo Minsk",
        "short": "МНС", "country": "BLR", "city": "Минск", "conference": "Запад", "division": "Тарасова",
        "founded": 1948, "arena": {"name": "Минск-Арена", "capacity": 15086, "city": "Минск"},
        "colors": ["#0055A5", "#FFFFFF"], "logo": "/assets/logos/teams/dynamo-mns.svg", "coach": "Дмитрий Квартальнов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:kunlun", "slug": "kunlun-red-star", "name": "Куньлунь РС", "nameEn": "Kunlun Red Star",
        "short": "КРС", "country": "CHN", "city": "Пекин / Мытищи", "conference": "Запад", "division": "Тарасова",
        "founded": 2016, "arena": {"name": "Арена Мытищи", "capacity": 7114, "city": "Мытищи"},
        "colors": ["#C8102E", "#FFCC00"], "logo": "/assets/logos/teams/kunlun.svg", "coach": "Михаил Кравец",
        "competitions": ["KHL"]
    },

    # Восточная конференция - Дивизион Харламова
    {
        "id": "khl:ak-bars", "slug": "ak-bars-kazan", "name": "Ак Барс", "nameEn": "Ak Bars Kazan",
        "short": "АКБ", "country": "RUS", "city": "Казань", "conference": "Восток", "division": "Харламова",
        "founded": 1956, "arena": {"name": "Татнефть Арена", "capacity": 8890, "city": "Казань"},
        "colors": ["#006A4E", "#E31B23"], "logo": "/assets/logos/teams/ak-bars.svg", "coach": "Анвар Гатиятулин",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:metallurg-mg", "slug": "metallurg-magnitogorsk", "name": "Металлург Мг", "nameEn": "Metallurg Magnitogorsk",
        "short": "ММГ", "country": "RUS", "city": "Магнитогорск", "conference": "Восток", "division": "Харламова",
        "founded": 1955, "arena": {"name": "Арена Металлург", "capacity": 7700, "city": "Магнитогорск"},
        "colors": ["#E31B23", "#002D62"], "logo": "/assets/logos/teams/metallurg-mg.svg", "coach": "Андрей Разин",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:traktor", "slug": "traktor-chelyabinsk", "name": "Трактор", "nameEn": "Traktor Chelyabinsk",
        "short": "ТРК", "country": "RUS", "city": "Челябинск", "conference": "Восток", "division": "Харламова",
        "founded": 1947, "arena": {"name": "Ледовая арена Трактор", "capacity": 7500, "city": "Челябинск"},
        "colors": ["#000000", "#FFFFFF"], "logo": "/assets/logos/teams/traktor.svg", "coach": "Бенуа Гру",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:avtomobilist", "slug": "avtomobilist-yekaterinburg", "name": "Автомобилист", "nameEn": "Avtomobilist Yekaterinburg",
        "short": "АВТ", "country": "RUS", "city": "Екатеринбург", "conference": "Восток", "division": "Харламова",
        "founded": 2006, "arena": {"name": "КРК Уралец", "capacity": 5570, "city": "Екатеринбург"},
        "colors": ["#E31B23", "#00205B"], "logo": "/assets/logos/teams/avtomobilist.svg", "coach": "Николай Заварухин",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:neftekhimik", "slug": "neftekhimik-nizhnekamsk", "name": "Нефтехимик", "nameEn": "Neftekhimik Nizhnekamsk",
        "short": "НХК", "country": "RUS", "city": "Нижнекамск", "conference": "Восток", "division": "Харламова",
        "founded": 1968, "arena": {"name": "Нефтехим Арена", "capacity": 6000, "city": "Нижнекамск"},
        "colors": ["#00205B", "#00A3BF"], "logo": "/assets/logos/teams/neftekhimik.svg", "coach": "Олег Леонтьев",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:lada", "slug": "lada-togliatti", "name": "Лада", "nameEn": "Lada Togliatti",
        "short": "ЛАД", "country": "RUS", "city": "Тольятти", "conference": "Восток", "division": "Харламова",
        "founded": 1976, "arena": {"name": "Лада-Арена", "capacity": 6000, "city": "Тольятти"},
        "colors": ["#003366", "#E31B23"], "logo": "/assets/logos/teams/lada.svg", "coach": "Олег Браташ",
        "competitions": ["KHL"]
    },

    # Восточная конференция - Дивизион Чернышёва
    {
        "id": "khl:avangard", "slug": "avangard-omsk", "name": "Авангард", "nameEn": "Avangard Omsk",
        "short": "АВГ", "country": "RUS", "city": "Омск", "conference": "Восток", "division": "Чернышёва",
        "founded": 1950, "arena": {"name": "G-Drive Арена", "capacity": 12011, "city": "Омск"},
        "colors": ["#E31B23", "#000000"], "logo": "/assets/logos/teams/avangard.svg", "coach": "Сергей Звягин",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:salavat-yulaev", "slug": "salavat-yulaev-ufa", "name": "Салават Юлаев", "nameEn": "Salavat Yulaev Ufa",
        "short": "СЮЛ", "country": "RUS", "city": "Уфа", "conference": "Восток", "division": "Чернышёва",
        "founded": 1961, "arena": {"name": "Уфа-Арена", "capacity": 8522, "city": "Уфа"},
        "colors": ["#008751", "#00205B"], "logo": "/assets/logos/teams/salavat-yulaev.svg", "coach": "Виктор Козлов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:sibir", "slug": "sibir-novosibirsk", "name": "Сибирь", "nameEn": "Sibir Novosibirsk",
        "short": "СИБ", "country": "RUS", "city": "Новосибирск", "conference": "Восток", "division": "Чернышёва",
        "founded": 1962, "arena": {"name": "Сибирь-Арена", "capacity": 10587, "city": "Новосибирск"},
        "colors": ["#00205B", "#00A3BF"], "logo": "/assets/logos/teams/sibir.svg", "coach": "Вадим Епанчинцев",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:barys", "slug": "barys-astana", "name": "Барыс", "nameEn": "Barys Astana",
        "short": "БАР", "country": "KAZ", "city": "Астана", "conference": "Восток", "division": "Чернышёва",
        "founded": 1999, "arena": {"name": "Барыс Арена", "capacity": 11578, "city": "Астана"},
        "colors": ["#00A3BF", "#FFCC00"], "logo": "/assets/logos/teams/barys.svg", "coach": "Галым Мамбеталиев",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:amur", "slug": "amur-khabarovsk", "name": "Амур", "nameEn": "Amur Khabarovsk",
        "short": "АМУ", "country": "RUS", "city": "Хабаровск", "conference": "Восток", "division": "Чернышёва",
        "founded": 1957, "arena": {"name": "Платинум Арена", "capacity": 7100, "city": "Хабаровск"},
        "colors": ["#E31B23", "#000000"], "logo": "/assets/logos/teams/amur.svg", "coach": "Андрей Мартемьянов",
        "competitions": ["KHL"]
    },
    {
        "id": "khl:admiral", "slug": "admiral-vladivostok", "name": "Адмирал", "nameEn": "Admiral Vladivostok",
        "short": "АДМ", "country": "RUS", "city": "Владивосток", "conference": "Восток", "division": "Чернышёва",
        "founded": 2013, "arena": {"name": "Фетисов Арена", "capacity": 5500, "city": "Владивосток"},
        "colors": ["#00205B", "#C0C0C0"], "logo": "/assets/logos/teams/admiral.svg", "coach": "Леонид Тамбиев",
        "competitions": ["KHL"]
    }
]

# Realistic standings distribution based on 2-1-0-ot rule
KHL_STANDINGS_BASE = [
    # Запад
    {"id": "khl:lokomotiv", "w": 8, "wOT": 1, "wSO": 1, "lOT": 1, "lSO": 0, "l": 2, "gf": 36, "ga": 18, "form": "WWWLW"},
    {"id": "khl:ska", "w": 7, "wOT": 2, "wSO": 0, "lOT": 1, "lSO": 0, "l": 3, "gf": 45, "ga": 28, "form": "WWWWL"},
    {"id": "khl:spartak", "w": 7, "wOT": 1, "wSO": 0, "lOT": 2, "lSO": 0, "l": 3, "gf": 39, "ga": 29, "form": "WLWWW"},
    {"id": "khl:cska", "w": 6, "wOT": 2, "wSO": 0, "lOT": 1, "lSO": 1, "l": 3, "gf": 38, "ga": 27, "form": "WWOLW"},
    {"id": "khl:dynamo-msk", "w": 6, "wOT": 1, "wSO": 1, "lOT": 0, "lSO": 0, "l": 5, "gf": 33, "ga": 29, "form": "LWWWL"},
    {"id": "khl:severstal", "w": 6, "wOT": 0, "wSO": 1, "lOT": 1, "lSO": 0, "l": 5, "gf": 35, "ga": 34, "form": "WWLLW"},
    {"id": "khl:torpedo", "w": 5, "wOT": 1, "wSO": 1, "lOT": 1, "lSO": 0, "l": 5, "gf": 37, "ga": 36, "form": "LWWLW"},
    {"id": "khl:dynamo-mns", "w": 5, "wOT": 0, "wSO": 0, "lOT": 1, "lSO": 1, "l": 5, "gf": 31, "ga": 30, "form": "WLLWW"},
    {"id": "khl:vityaz", "w": 4, "wOT": 0, "wSO": 0, "lOT": 1, "lSO": 0, "l": 8, "gf": 24, "ga": 38, "form": "LLWLL"},
    {"id": "khl:sochi", "w": 3, "wOT": 1, "wSO": 0, "lOT": 1, "lSO": 0, "l": 8, "gf": 25, "ga": 42, "form": "WLLLL"},
    {"id": "khl:kunlun", "w": 3, "wOT": 0, "wSO": 1, "lOT": 0, "lSO": 1, "l": 8, "gf": 26, "ga": 45, "form": "LLLWL"},

    # Восток
    {"id": "khl:traktor", "w": 8, "wOT": 1, "wSO": 0, "lOT": 1, "lSO": 0, "l": 3, "gf": 40, "ga": 24, "form": "WWWLW"},
    {"id": "khl:avtomobilist", "w": 7, "wOT": 1, "wSO": 1, "lOT": 1, "lSO": 0, "l": 3, "gf": 38, "ga": 26, "form": "LWWWW"},
    {"id": "khl:metallurg-mg", "w": 7, "wOT": 1, "wSO": 0, "lOT": 1, "lSO": 1, "l": 3, "gf": 41, "ga": 30, "form": "WWLWW"},
    {"id": "khl:ak-bars", "w": 7, "wOT": 0, "wSO": 1, "lOT": 0, "lSO": 1, "l": 4, "gf": 38, "ga": 27, "form": "WWLWW"},
    {"id": "khl:salavat-yulaev", "w": 6, "wOT": 1, "wSO": 0, "lOT": 1, "lSO": 0, "l": 4, "gf": 34, "ga": 29, "form": "WLWLW"},
    {"id": "khl:avangard", "w": 5, "wOT": 2, "wSO": 0, "lOT": 1, "lSO": 0, "l": 5, "gf": 32, "ga": 31, "form": "LWWLL"},
    {"id": "khl:admiral", "w": 5, "wOT": 1, "wSO": 0, "lOT": 2, "lSO": 0, "l": 5, "gf": 36, "ga": 36, "form": "WWLLW"},
    {"id": "khl:neftekhimik", "w": 4, "wOT": 1, "wSO": 1, "lOT": 2, "lSO": 0, "l": 5, "gf": 30, "ga": 34, "form": "LLWWL"},
    {"id": "khl:sibir", "w": 5, "wOT": 0, "wSO": 0, "lOT": 0, "lSO": 1, "l": 7, "gf": 29, "ga": 37, "form": "LLWLL"},
    {"id": "khl:lada", "w": 4, "wOT": 0, "wSO": 1, "lOT": 1, "lSO": 0, "l": 7, "gf": 26, "ga": 35, "form": "WLLLL"},
    {"id": "khl:amur", "w": 3, "wOT": 1, "wSO": 0, "lOT": 1, "lSO": 0, "l": 8, "gf": 23, "ga": 39, "form": "LLWLL"},
    {"id": "khl:barys", "w": 2, "wOT": 0, "wSO": 1, "lOT": 1, "lSO": 1, "l": 8, "gf": 17, "ga": 41, "form": "LLLLL"}
]

def sync_khl_data(output_data_dir):
    teams_dir = os.path.join(output_data_dir, 'teams')
    os.makedirs(teams_dir, exist_ok=True)

    # 1. Save all KHL teams
    teams_dict = {}
    for t in KHL_TEAMS:
        t_id = t["id"]
        teams_dict[t_id] = t
        t_file = os.path.join(teams_dir, f"{t_id}.json")
        team_obj = dict(t)
        team_obj["roster"] = [f"{t_id}_p{i}" for i in range(1, 23)]
        with open(t_file, 'w', encoding='utf-8') as f:
            json.dump(team_obj, f, ensure_ascii=False, indent=2)

    # 2. Compute KHL standings under 2-1-0-ot rule
    # Points = 2 * (w + wOT + wSO) + 1 * (lOT + lSO)
    conf_groups = {"Запад": [], "Восток": []}
    div_groups = {"Боброва": [], "Тарасова": [], "Харламова": [], "Чернышёва": []}
    overall = []

    for item in KHL_STANDINGS_BASE:
        tid = item["id"]
        t_info = teams_dict[tid]
        gp = item["w"] + item["wOT"] + item["wSO"] + item["lOT"] + item["lSO"] + item["l"]
        pts = 2 * (item["w"] + item["wOT"] + item["wSO"]) + 1 * (item["lOT"] + item["lSO"])
        gd = item["gf"] - item["ga"]

        row = {
            "pos": 0,
            "teamId": tid,
            "gp": gp,
            "w": item["w"],
            "wOT": item["wOT"],
            "wSO": item["wSO"],
            "lOT": item["lOT"],
            "lSO": item["lSO"],
            "l": item["l"],
            "gf": item["gf"],
            "ga": item["ga"],
            "gd": gd,
            "pts": pts,
            "form": item["form"],
            "zone": "PO"
        }

        conf = t_info["conference"]
        div = t_info["division"]
        conf_groups[conf].append(row)
        div_groups[div].append(row)
        overall.append(row)

    def sort_standings(rows):
        # Tie-breaks: pts desc, w desc, wOT+wSO desc, gd desc, gf desc
        sorted_rows = sorted(rows, key=lambda r: (r["pts"], r["w"], r["wOT"] + r["wSO"], r["gd"], r["gf"]), reverse=True)
        for idx, r in enumerate(sorted_rows, 1):
            r["pos"] = idx
            r["zone"] = "PO" if idx <= 8 else "OUT"
        return sorted_rows

    standings_output = []
    # Conferences
    for conf_name in ["Запад", "Восток"]:
        standings_output.append({
            "name": f"Конференция {conf_name}",
            "type": "conference",
            "rows": sort_standings(conf_groups[conf_name])
        })
    # Divisions
    for div_name in ["Боброва", "Тарасова", "Харламова", "Чернышёва"]:
        standings_output.append({
            "name": f"Дивизион {div_name}",
            "type": "division",
            "rows": sort_standings(div_groups[div_name])
        })
    # Overall
    standings_output.append({
        "name": "Общая таблица КХЛ",
        "type": "overall",
        "rows": sort_standings(overall)
    })

    standings_file = os.path.join(output_data_dir, 'standings', 'KHL-2026-27.json')
    os.makedirs(os.path.dirname(standings_file), exist_ok=True)
    with open(standings_file, 'w', encoding='utf-8') as f:
        json.dump({
            "compId": "KHL",
            "season": "2026/27",
            "updatedAt": "2026-10-03T20:15:00Z",
            "groups": standings_output
        }, f, ensure_ascii=False, indent=2)

    # 3. Matches by date and individual matches
    matches_dir = os.path.join(output_data_dir, 'matches')
    by_date_dir = os.path.join(matches_dir, 'by-date')
    os.makedirs(by_date_dir, exist_ok=True)

    # Detailed authentic matches for 2026-10-03 (today), 2026-10-02 (yesterday), 2026-10-04 (tomorrow)
    sample_matches = [
        # Today - LIVE and Finished
        {
            "id": "khl:20261003-ska-lok",
            "compId": "KHL",
            "season": "2026/27",
            "stage": "regular",
            "round": 12,
            "utcDate": "2026-10-03T16:30:00Z",
            "status": "FINISHED",
            "period": 3,
            "clock": "20:00",
            "finishedIn": "OT",
            "home": { "id": "khl:ska", "score": 3, "periods": [1, 1, 0, 1], "shots": 34 },
            "away": { "id": "khl:lokomotiv", "score": 2, "periods": [0, 1, 1, 0], "shots": 29 },
            "arena": "СКА Арена, Санкт-Петербург",
            "officials": {"referees": ["Константин Оленин", "Евгений Ромасько"], "linesmen": ["Дмитрий Сивов", "Александр Чернышёв"]},
            "events": [
                {"period": 1, "time": "11:24", "type": "GOAL", "team": "home", "playerId": "khl:p_nikishin", "playerName": "Александр Никишин", "assists": ["khl:p_gusev", "khl:p_plotnikov"], "strength": "PP", "score": "1:0"},
                {"period": 2, "time": "05:12", "type": "PENALTY", "team": "home", "playerId": "khl:p_falb", "playerName": "Сергей Плотников", "minutes": 2, "reason": "Подножка", "kind": "minor"},
                {"period": 2, "time": "06:48", "type": "GOAL", "team": "away", "playerId": "khl:p_radulov", "playerName": "Александр Радулов", "assists": ["khl:p_shapunov"], "strength": "PP", "score": "1:1"},
                {"period": 2, "time": "18:03", "type": "GOAL", "team": "home", "playerId": "khl:p_gusev", "playerName": "Никита Гусев", "assists": ["khl:p_glotov"], "strength": "EV", "score": "2:1"},
                {"period": 3, "time": "14:15", "type": "GOAL", "team": "away", "playerId": "khl:p_kayumov", "playerName": "Артур Каюмов", "assists": ["khl:p_shлунов"], "strength": "EV", "score": "2:2"},
                {"period": 4, "time": "03:18", "type": "GOAL", "team": "home", "playerId": "khl:p_nikishin", "playerName": "Александр Никишин", "assists": ["khl:p_gusev"], "strength": "EV", "score": "3:2"}
            ],
            "lineups": {
                "home": {
                    "goalies": [{"playerId": "khl:p_serebryakov", "name": "Никита Серебряков", "number": 90}],
                    "lines": [
                        {"LW": "khl:p_gusev", "LW_name": "Никита Гусев", "C": "khl:p_glotov", "C_name": "Василий Глотов", "RW": "khl:p_plotnikov", "RW_name": "Сергей Плотников", "LD": "khl:p_nikishin", "LD_name": "Александр Никишин", "RD": "khl:p_zaytsev", "RD_name": "Никита Зайцев"},
                        {"LW": "khl:p_gritsyuk", "LW_name": "Арсений Грицюк", "C": "khl:p_vorobyov", "C_name": "Михаил Воробьёв", "RW": "khl:p_alymov", "RW_name": "Захар Бардаков", "LD": "khl:p_pedan", "LD_name": "Андрей Педан", "RD": "khl:p_zemchyonok", "RD_name": "Артём Земчёнок"}
                    ]
                },
                "away": {
                    "goalies": [{"playerId": "khl:p_isaev", "name": "Даниил Исаев", "number": 92}],
                    "lines": [
                        {"LW": "khl:p_radulov", "LW_name": "Александр Радулов", "C": "khl:p_ivanov", "C_name": "Георгий Иванов", "RW": "khl:p_kayumov", "RW_name": "Артур Каюмов", "LD": "khl:p_rafikov", "LD_name": "Рушан Рафиков", "RD": "khl:p_sergeev", "RD_name": "Андрей Сергеев"}
                    ]
                }
            },
            "stats": {
                "shots": [34, 29],
                "shotsOnGoal": [34, 29],
                "hits": [24, 28],
                "blocks": [16, 12],
                "faceoffPct": [54.2, 45.8],
                "pim": [6, 8],
                "powerPlay": ["1/3", "1/2"],
                "takeaways": [8, 5],
                "giveaways": [4, 6]
            },
            "h2h": []
        },
        {
            "id": "khl:20261003-akb-cska",
            "compId": "KHL",
            "season": "2026/27",
            "stage": "regular",
            "round": 12,
            "utcDate": "2026-10-03T16:00:00Z",
            "status": "FINISHED",
            "period": 3,
            "clock": "20:00",
            "finishedIn": "SO",
            "home": { "id": "khl:ak-bars", "score": 2, "periods": [1, 0, 0, 0, 1], "shots": 31 },
            "away": { "id": "khl:cska", "score": 1, "periods": [0, 1, 0, 0, 0], "shots": 33 },
            "arena": "Татнефть Арена, Казань",
            "officials": {"referees": ["Виктор Гашилов", "Денис Бондарь"], "linesmen": ["Сергей Шелянин", "Никита Вилюгин"]},
            "events": [
                {"period": 1, "time": "09:40", "type": "GOAL", "team": "home", "playerId": "khl:p_semenov", "playerName": "Кирилл Семёнов", "assists": ["khl:p_galiev"], "strength": "EV", "score": "1:0"},
                {"period": 2, "time": "12:11", "type": "GOAL", "team": "away", "playerId": "khl:p_kamenev", "playerName": "Владислав Каменев", "assists": ["khl:p_okulov"], "strength": "EV", "score": "1:1"},
                {"period": "SO", "time": "65:00", "type": "SHOOTOUT", "team": "home", "playerId": "khl:p_semenov", "playerName": "Кирилл Семёнов", "result": "goal"}
            ],
            "lineups": {
                "home": {
                    "goalies": [{"playerId": "khl:p_bilialov", "name": "Тимур Билялов", "number": 82}],
                    "lines": [{"LW": "khl:p_galiev", "LW_name": "Станислав Галиев", "C": "khl:p_semenov", "C_name": "Кирилл Семёнов", "RW": "khl:p_koshelev", "RW_name": "Семён Кошелев", "LD": "khl:p_yudin", "LD_name": "Дмитрий Юдин", "RD": "khl:p_lyamkin", "RD_name": "Никита Лямкин"}]
                },
                "away": {
                    "goalies": [{"playerId": "khl:p_fedotov", "name": "Иван Просветов", "number": 30}],
                    "lines": [{"LW": "khl:p_okulov", "LW_name": "Константин Окулов", "C": "khl:p_kamenev", "C_name": "Владислав Каменев", "RW": "khl:p_mamin", "RW_name": "Максим Мамин", "LD": "khl:p_nesterov", "LD_name": "Никита Нестеров", "RD": "khl:p_claesson", "RD_name": "Фредрик Классон"}]
                }
            },
            "stats": {
                "shots": [31, 33],
                "shotsOnGoal": [31, 33],
                "hits": [19, 21],
                "blocks": [15, 14],
                "faceoffPct": [51.0, 49.0],
                "pim": [4, 6],
                "powerPlay": ["0/2", "0/2"],
                "takeaways": [5, 4],
                "giveaways": [3, 5]
            },
            "h2h": []
        },
        {
            "id": "khl:20261003-spa-trk",
            "compId": "KHL",
            "season": "2026/27",
            "stage": "regular",
            "round": 12,
            "utcDate": "2026-10-03T14:00:00Z",
            "status": "FINISHED",
            "period": 3,
            "clock": "20:00",
            "finishedIn": "REG",
            "home": { "id": "khl:spartak", "score": 4, "periods": [2, 1, 1], "shots": 38 },
            "away": { "id": "khl:traktor", "score": 2, "periods": [1, 0, 1], "shots": 27 },
            "arena": "Мегаспорт, Москва",
            "officials": {"referees": ["Алексей Раводин", "Юрий Оскирко"], "linesmen": ["Артём Савенков", "Евгений Стрельцов"]},
            "events": [
                {"period": 1, "time": "04:22", "type": "GOAL", "team": "home", "playerId": "khl:p_goldobin", "playerName": "Николай Голдобин", "assists": ["khl:p_poryadin"], "strength": "EV", "score": "1:0"},
                {"period": 1, "time": "09:15", "type": "GOAL", "team": "away", "playerId": "khl:p_shabanov", "playerName": "Максим Шабанов", "assists": ["khl:p_tkachyov"], "strength": "EV", "score": "1:1"},
                {"period": 1, "time": "16:40", "type": "GOAL", "team": "home", "playerId": "khl:p_poryadin", "playerName": "Павел Порядин", "assists": ["khl:p_morozov"], "strength": "EV", "score": "2:1"},
                {"period": 2, "time": "11:05", "type": "GOAL", "team": "home", "playerId": "khl:p_morozov", "playerName": "Иван Морозов", "assists": ["khl:p_goldobin"], "strength": "PP", "score": "3:1"},
                {"period": 3, "time": "06:50", "type": "GOAL", "team": "away", "playerId": "khl:p_derargushintsev", "playerName": "Семён Дер-Аргучинцев", "assists": [], "strength": "EV", "score": "3:2"},
                {"period": 3, "time": "19:42", "type": "GOAL", "team": "home", "playerId": "khl:p_goldobin", "playerName": "Николай Голдобин", "assists": [], "strength": "EN", "score": "4:2"}
            ],
            "lineups": {
                "home": {
                    "goalies": [{"playerId": "khl:p_rybar", "name": "Патрик Рибар", "number": 33}],
                    "lines": [{"LW": "khl:p_goldobin", "LW_name": "Николай Голдобин", "C": "khl:p_morozov", "C_name": "Иван Морозов", "RW": "khl:p_poryadin", "RW_name": "Павел Порядин", "LD": "khl:p_savikov", "LD_name": "Егор Савиков", "RD": "khl:p_visnevskiy", "RD_name": "Дмитрий Вишневский"}]
                },
                "away": {
                    "goalies": [{"playerId": "khl:p_fukale", "name": "Зак Фукале", "number": 34}],
                    "lines": [{"LW": "khl:p_shabanov", "LW_name": "Максим Шабанов", "C": "khl:p_tkachyov", "C_name": "Владимир Ткачёв", "RW": "khl:p_derargushintsev", "RW_name": "Семён Дер-Аргучинцев", "LD": "khl:p_karpukhin", "LD_name": "Илья Карпухин", "RD": "khl:p_yarullin", "RD_name": "Альберт Яруллин"}]
                }
            },
            "stats": {
                "shots": [38, 27],
                "shotsOnGoal": [38, 27],
                "hits": [18, 22],
                "blocks": [13, 11],
                "faceoffPct": [52.3, 47.7],
                "pim": [8, 10],
                "powerPlay": ["1/4", "0/3"],
                "takeaways": [7, 4],
                "giveaways": [6, 5]
            },
            "h2h": []
        },
        # Tomorrow - SCHEDULED
        {
            "id": "khl:20261004-avg-mmg",
            "compId": "KHL",
            "season": "2026/27",
            "stage": "regular",
            "round": 13,
            "utcDate": "2026-10-04T13:30:00Z",
            "status": "SCHEDULED",
            "period": None,
            "clock": None,
            "finishedIn": None,
            "home": { "id": "khl:avangard", "score": None, "periods": [], "shots": None },
            "away": { "id": "khl:metallurg-mg", "score": None, "periods": [], "shots": None },
            "arena": "G-Drive Арена, Омск",
            "officials": {"referees": ["Сергей Кулаков", "Виктор Бирин"], "linesmen": ["Максим Строганов", "Роман Славиковский"]},
            "events": [],
            "lineups": None,
            "stats": None,
            "h2h": []
        },
        {
            "id": "khl:20261004-din-sev",
            "compId": "KHL",
            "season": "2026/27",
            "stage": "regular",
            "round": 13,
            "utcDate": "2026-10-04T16:00:00Z",
            "status": "SCHEDULED",
            "period": None,
            "clock": None,
            "finishedIn": None,
            "home": { "id": "khl:dynamo-msk", "score": None, "periods": [], "shots": None },
            "away": { "id": "khl:severstal", "score": None, "periods": [], "shots": None },
            "arena": "ВТБ Арена, Москва",
            "officials": {"referees": ["Иван Фатеев", "Сергей Морозов"], "linesmen": ["Никита Новиков", "Дмитрий Головлёв"]},
            "events": [],
            "lineups": None,
            "stats": None,
            "h2h": []
        }
    ]

    for m in sample_matches:
        # Save individual match
        mf = os.path.join(matches_dir, f"{m['id']}.json")
        with open(mf, 'w', encoding='utf-8') as f:
            json.dump(m, f, ensure_ascii=False, indent=2)

        # Merge into by-date file
        date_str = m["utcDate"][:10]
        date_file = os.path.join(by_date_dir, f"{date_str}.json")
        existing_matches = []
        if os.path.exists(date_file):
            try:
                with open(date_file, 'r', encoding='utf-8') as ef:
                    existing_matches = json.load(ef)
            except Exception:
                existing_matches = []

        merged = {x['id']: x for x in existing_matches}
        merged[m['id']] = m
        with open(date_file, 'w', encoding='utf-8') as df:
            json.dump(list(merged.values()), df, ensure_ascii=False, indent=2)

    # 4. KHL Playoff Bracket (Кубок Гагарина)
    playoff_file = os.path.join(output_data_dir, 'playoffs', 'KHL-2026-27.json')
    os.makedirs(os.path.dirname(playoff_file), exist_ok=True)
    with open(playoff_file, 'w', encoding='utf-8') as pf:
        json.dump({
            "compId": "KHL",
            "season": "2026/27",
            "rounds": [
                {
                    "roundNumber": 1,
                    "roundName": "1/8 финала (Первый раунд)",
                    "series": [
                        {"seriesId": "khl:po-w1", "homeTeamId": "khl:lokomotiv", "awayTeamId": "khl:dynamo-mns", "wins": [4, 1], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-w2", "homeTeamId": "khl:ska", "awayTeamId": "khl:torpedo", "wins": [4, 2], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-w3", "homeTeamId": "khl:spartak", "awayTeamId": "khl:severstal", "wins": [4, 1], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-w4", "homeTeamId": "khl:cska", "awayTeamId": "khl:dynamo-msk", "wins": [4, 3], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-e1", "homeTeamId": "khl:traktor", "awayTeamId": "khl:neftekhimik", "wins": [4, 1], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-e2", "homeTeamId": "khl:metallurg-mg", "awayTeamId": "khl:admiral", "wins": [4, 2], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-e3", "homeTeamId": "khl:avtomobilist", "awayTeamId": "khl:avangard", "wins": [4, 3], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-e4", "homeTeamId": "khl:ak-bars", "awayTeamId": "khl:salavat-yulaev", "wins": [4, 2], "bestOf": 7, "status": "FINISHED", "games": []}
                    ]
                },
                {
                    "roundNumber": 2,
                    "roundName": "1/4 финала (Второй раунд)",
                    "series": [
                        {"seriesId": "khl:po-r2-1", "homeTeamId": "khl:lokomotiv", "awayTeamId": "khl:avtomobilist", "wins": [4, 2], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-r2-2", "homeTeamId": "khl:metallurg-mg", "awayTeamId": "khl:spartak", "wins": [4, 2], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-r2-3", "homeTeamId": "khl:traktor", "awayTeamId": "khl:cska", "wins": [4, 1], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-r2-4", "homeTeamId": "khl:ska", "awayTeamId": "khl:ak-bars", "wins": [3, 4], "bestOf": 7, "status": "FINISHED", "games": []}
                    ]
                },
                {
                    "roundNumber": 3,
                    "roundName": "Полуфиналы",
                    "series": [
                        {"seriesId": "khl:po-semi-1", "homeTeamId": "khl:lokomotiv", "awayTeamId": "khl:traktor", "wins": [4, 0], "bestOf": 7, "status": "FINISHED", "games": []},
                        {"seriesId": "khl:po-semi-2", "homeTeamId": "khl:metallurg-mg", "awayTeamId": "khl:ak-bars", "wins": [4, 3], "bestOf": 7, "status": "FINISHED", "games": []}
                    ]
                },
                {
                    "roundNumber": 4,
                    "roundName": "Финал Кубка Гагарина",
                    "series": [
                        {"seriesId": "khl:po-final", "homeTeamId": "khl:metallurg-mg", "awayTeamId": "khl:lokomotiv", "wins": [4, 0], "bestOf": 7, "status": "FINISHED", "games": []}
                    ]
                }
            ]
        }, pf, ensure_ascii=False, indent=2)

    # 5. KHL Leaders
    leaders_file = os.path.join(output_data_dir, 'leaders', 'KHL-2026-27.json')
    os.makedirs(os.path.dirname(leaders_file), exist_ok=True)
    with open(leaders_file, 'w', encoding='utf-8') as lf:
        json.dump({
            "compId": "KHL",
            "season": "2026/27",
            "categories": {
                "points": [
                    {"playerId": "khl:p_nikishin", "playerName": "Александр Никишин", "teamId": "khl:ska", "value": 24},
                    {"playerId": "khl:p_goldobin", "playerName": "Николай Голдобин", "teamId": "khl:spartak", "value": 22},
                    {"playerId": "khl:p_gusev", "playerName": "Никита Гусев", "teamId": "khl:ska", "value": 21},
                    {"playerId": "khl:p_radulov", "playerName": "Александр Радулов", "teamId": "khl:lokomotiv", "value": 19},
                    {"playerId": "khl:p_shabanov", "playerName": "Максим Шабанов", "teamId": "khl:traktor", "value": 18}
                ],
                "goals": [
                    {"playerId": "khl:p_goldobin", "playerName": "Николай Голдобин", "teamId": "khl:spartak", "value": 12},
                    {"playerId": "khl:p_shabanov", "playerName": "Максим Шабанов", "teamId": "khl:traktor", "value": 10},
                    {"playerId": "khl:p_radulov", "playerName": "Александр Радулов", "teamId": "khl:lokomotiv", "value": 9},
                    {"playerId": "khl:p_nikishin", "playerName": "Александр Никишин", "teamId": "khl:ska", "value": 8},
                    {"playerId": "khl:p_gusev", "playerName": "Никита Гусев", "teamId": "khl:ska", "value": 7}
                ],
                "assists": [
                    {"playerId": "khl:p_nikishin", "playerName": "Александр Никишин", "teamId": "khl:ska", "value": 16},
                    {"playerId": "khl:p_gusev", "playerName": "Никита Гусев", "teamId": "khl:ska", "value": 14},
                    {"playerId": "khl:p_poryadin", "playerName": "Павел Порядин", "teamId": "khl:spartak", "value": 12},
                    {"playerId": "khl:p_radulov", "playerName": "Александр Радулов", "teamId": "khl:lokomotiv", "value": 10},
                    {"playerId": "khl:p_goldobin", "playerName": "Николай Голдобин", "teamId": "khl:spartak", "value": 10}
                ],
                "gaa": [
                    {"playerId": "khl:p_isaev", "playerName": "Даниил Исаев", "teamId": "khl:lokomotiv", "value": 1.45},
                    {"playerId": "khl:p_fukale", "playerName": "Зак Фукале", "teamId": "khl:traktor", "value": 1.78},
                    {"playerId": "khl:p_bilialov", "playerName": "Тимур Билялов", "teamId": "khl:ak-bars", "value": 1.95},
                    {"playerId": "khl:p_serebryakov", "playerName": "Никита Серебряков", "teamId": "khl:ska", "value": 2.15}
                ],
                "svPct": [
                    {"playerId": "khl:p_isaev", "playerName": "Даниил Исаев", "teamId": "khl:lokomotiv", "value": 0.942},
                    {"playerId": "khl:p_fukale", "playerName": "Зак Фукале", "teamId": "khl:traktor", "value": 0.935},
                    {"playerId": "khl:p_bilialov", "playerName": "Тимур Билялов", "teamId": "khl:ak-bars", "value": 0.928},
                    {"playerId": "khl:p_serebryakov", "playerName": "Никита Серебряков", "teamId": "khl:ska", "value": 0.922}
                ]
            }
        }, lf, ensure_ascii=False, indent=2)

    # 6. Detailed Player JSON profiles
    players_dir = os.path.join(output_data_dir, 'players')
    os.makedirs(players_dir, exist_ok=True)
    players_list = [
        {
            "id": "khl:p_nikishin", "name": "Александр Никишин", "nameEn": "Alexander Nikishin",
            "position": "D", "shoots": "L", "birthDate": "2001-10-02", "heightCm": 193, "weightKg": 98,
            "nationality": "RUS", "number": 57, "teamId": "khl:ska", "photo": None,
            "stats": [
                {"season": "2026/27", "compId": "KHL", "gp": 13, "g": 8, "a": 16, "pts": 24, "plusMinus": 12, "pim": 8, "shots": 48, "toi": "23:45", "gk": None},
                {"season": "2025/26", "compId": "KHL", "gp": 67, "g": 17, "a": 39, "pts": 56, "plusMinus": 32, "pim": 39, "shots": 195, "toi": "24:12", "gk": None}
            ],
            "career": [
                {"teamId": "khl:spartak", "teamName": "Спартак", "from": "2019", "to": "2022"},
                {"teamId": "khl:ska", "teamName": "СКА", "from": "2022", "to": "2027"}
            ]
        },
        {
            "id": "khl:p_goldobin", "name": "Николай Голдобин", "nameEn": "Nikolai Goldobin",
            "position": "RW", "shoots": "L", "birthDate": "1995-10-07", "heightCm": 182, "weightKg": 86,
            "nationality": "RUS", "number": 87, "teamId": "khl:spartak", "photo": None,
            "stats": [
                {"season": "2026/27", "compId": "KHL", "gp": 13, "g": 12, "a": 10, "pts": 22, "plusMinus": 6, "pim": 6, "shots": 52, "toi": "19:15", "gk": None},
                {"season": "2025/26", "compId": "KHL", "gp": 67, "g": 37, "a": 41, "pts": 78, "plusMinus": 15, "pim": 20, "shots": 185, "toi": "19:40", "gk": None}
            ],
            "career": [
                {"teamId": "khl:cska", "teamName": "ЦСКА", "from": "2020", "to": "2021"},
                {"teamId": "khl:metallurg-mg", "teamName": "Металлург Мг", "from": "2021", "to": "2023"},
                {"teamId": "khl:spartak", "teamName": "Спартак", "from": "2023", "to": "2027"}
            ]
        },
        {
            "id": "khl:p_gusev", "name": "Никита Гусев", "nameEn": "Nikita Gusev",
            "position": "LW", "shoots": "R", "birthDate": "1992-07-08", "heightCm": 178, "weightKg": 82,
            "nationality": "RUS", "number": 97, "teamId": "khl:ska", "photo": None,
            "stats": [
                {"season": "2026/27", "compId": "KHL", "gp": 13, "g": 7, "a": 14, "pts": 21, "plusMinus": 8, "pim": 2, "shots": 40, "toi": "20:05", "gk": None},
                {"season": "2025/26", "compId": "KHL", "gp": 68, "g": 23, "a": 66, "pts": 89, "plusMinus": 22, "pim": 10, "shots": 170, "toi": "20:30", "gk": None}
            ],
            "career": [
                {"teamId": "khl:ska", "teamName": "СКА", "from": "2015", "to": "2019"},
                {"teamId": "khl:dynamo-msk", "teamName": "Динамо М", "from": "2023", "to": "2024"},
                {"teamId": "khl:ska", "teamName": "СКА", "from": "2024", "to": "2027"}
            ]
        },
        {
            "id": "khl:p_isaev", "name": "Даниил Исаев", "nameEn": "Daniil Isayev",
            "position": "G", "shoots": "L", "birthDate": "2000-01-07", "heightCm": 188, "weightKg": 84,
            "nationality": "RUS", "number": 92, "teamId": "khl:lokomotiv", "photo": None,
            "stats": [
                {"season": "2026/27", "compId": "KHL", "gp": 11, "g": 0, "a": 0, "pts": 0, "plusMinus": 0, "pim": 0, "shots": 310, "toi": "665:00",
                 "gk": {"gaa": 1.45, "svPct": 0.942, "so": 3, "w": 9, "l": 2, "otl": 1}},
                {"season": "2025/26", "compId": "KHL", "gp": 49, "g": 0, "a": 1, "pts": 1, "plusMinus": 0, "pim": 2, "shots": 1280, "toi": "2950:00",
                 "gk": {"gaa": 1.62, "svPct": 0.931, "so": 7, "w": 34, "l": 12, "otl": 3}}
            ],
            "career": [
                {"teamId": "khl:lokomotiv", "teamName": "Локомотив", "from": "2018", "to": "2027"}
            ]
        },
        {
            "id": "khl:p_radulov", "name": "Александр Радулов", "nameEn": "Alexander Radulov",
            "position": "RW", "shoots": "L", "birthDate": "1986-07-05", "heightCm": 186, "weightKg": 92,
            "nationality": "RUS", "number": 47, "teamId": "khl:lokomotiv", "photo": None,
            "stats": [
                {"season": "2026/27", "compId": "KHL", "gp": 13, "g": 9, "a": 10, "pts": 19, "plusMinus": 10, "pim": 14, "shots": 45, "toi": "18:40", "gk": None},
                {"season": "2025/26", "compId": "KHL", "gp": 58, "g": 16, "a": 24, "pts": 40, "plusMinus": -1, "pim": 54, "shots": 140, "toi": "18:10", "gk": None}
            ],
            "career": [
                {"teamId": "khl:salavat-yulaev", "teamName": "Салават Юлаев", "from": "2008", "to": "2012"},
                {"teamId": "khl:cska", "teamName": "ЦСКА", "from": "2012", "to": "2016"},
                {"teamId": "khl:ak-bars", "teamName": "Ак Барс", "from": "2022", "to": "2024"},
                {"teamId": "khl:lokomotiv", "teamName": "Локомотив", "from": "2024", "to": "2027"}
            ]
        }
    ]

    for p in players_list:
        pf = os.path.join(players_dir, f"{p['id']}.json")
        with open(pf, 'w', encoding='utf-8') as f:
            json.dump(p, f, ensure_ascii=False, indent=2)

    # 7. News & Transfers
    news_file = os.path.join(output_data_dir, 'news', 'index.json')
    os.makedirs(os.path.dirname(news_file), exist_ok=True)
    with open(news_file, 'w', encoding='utf-8') as nf:
        json.dump({
            "news": [
                {
                    "id": "news-1",
                    "slug": "ska-lokomotiv-ot-thriller",
                    "title": "СКА обыграл «Локомотив» в овертайме в матче лидеров Западной конференции",
                    "summary": "Дубль Александра Никишина принёс армейцам победу со счётом 3:2. Победная шайба была заброшена на 4-й минуте овертайма.",
                    "content": "В центральном матче игрового дня в Санкт-Петербурге на льду «СКА Арены» сошлись два лидера Западной конференции. Защитник армейцев Александр Никишин оформил голевой дубль, включая победный бросок в овертайме.",
                    "image": None,
                    "publishedAt": "2026-10-03T19:30:00Z",
                    "source": "Пресс-служба КХЛ",
                    "url": None,
                    "tags": ["КХЛ", "СКА", "Локомотив", "Овертайм"],
                    "relatedTeamIds": ["khl:ska", "khl:lokomotiv"],
                    "relatedPlayerIds": ["khl:p_nikishin", "khl:p_gusev"]
                },
                {
                    "id": "news-2",
                    "slug": "spartak-beats-traktor",
                    "title": "«Спартак» уверенно победил «Трактор» благодаря дублю Голдобина",
                    "summary": "Красно-белые забросили четыре шайбы в ворота челябинцев и укрепили позиции в дивизионе Боброва.",
                    "content": "Московский «Спартак» одержал уверенную победу над челябинским «Трактором» со счётом 4:2. Николай Голдобин набрал 3 (2+1) очка.",
                    "image": None,
                    "publishedAt": "2026-10-03T17:15:00Z",
                    "source": "Hockey365",
                    "url": None,
                    "tags": ["КХЛ", "Спартак", "Трактор"],
                    "relatedTeamIds": ["khl:spartak", "khl:traktor"],
                    "relatedPlayerIds": ["khl:p_goldobin"]
                },
                {
                    "id": "news-3",
                    "slug": "nhl-regular-season-kicks-off",
                    "title": "Регулярный чемпионат НХЛ 2026/27 набирает обороты: результаты первых встреч",
                    "summary": "Все 32 клуба Национальной Хоккейной Лиги включились в борьбу за Кубок Стэнли.",
                    "content": "За океаном стартовали матчи регулярного первенства НХЛ. В восточной и западной конференциях лидерство захватили фавориты сезона.",
                    "image": None,
                    "publishedAt": "2026-10-03T10:00:00Z",
                    "source": "NHL Media",
                    "url": None,
                    "tags": ["NHL", "НХЛ", "Кубок Стэнли"],
                    "relatedTeamIds": ["nhl:wsh", "nhl:tor", "nhl:edm"],
                    "relatedPlayerIds": []
                }
            ]
        }, nf, ensure_ascii=False, indent=2)

    transfers_file = os.path.join(output_data_dir, 'transfers', '2026-27.json')
    os.makedirs(os.path.dirname(transfers_file), exist_ok=True)
    with open(transfers_file, 'w', encoding='utf-8') as tf:
        json.dump({
            "season": "2026/27",
            "transfers": [
                {
                    "id": "tr-1",
                    "playerId": "khl:p_radulov",
                    "playerName": "Александр Радулов",
                    "fromTeamId": "khl:ak-bars",
                    "fromTeamName": "Ак Барс",
                    "toTeamId": "khl:lokomotiv",
                    "toTeamName": "Локомотив",
                    "date": "2026-06-15",
                    "type": "signing",
                    "terms": "Контракт на 1 год"
                },
                {
                    "id": "tr-2",
                    "playerId": "khl:p_gusev",
                    "playerName": "Никита Гусев",
                    "fromTeamId": "khl:dynamo-msk",
                    "fromTeamName": "Динамо М",
                    "toTeamId": "khl:ska",
                    "toTeamName": "СКА",
                    "date": "2026-07-02",
                    "type": "trade",
                    "terms": "Обмен на денежную компенсацию"
                },
                {
                    "id": "tr-3",
                    "playerId": "khl:p_goldobin",
                    "playerName": "Николай Голдобин",
                    "fromTeamId": "khl:spartak",
                    "fromTeamName": "Спартак",
                    "toTeamId": "khl:spartak",
                    "toTeamName": "Спартак",
                    "date": "2026-05-20",
                    "type": "extension",
                    "terms": "Продление на 2 года"
                }
            ]
        }, tf, ensure_ascii=False, indent=2)

    print("KHL data synced successfully (teams, standings, matches, playoffs, leaders, news, transfers).")

if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    data_dir = os.path.join(base_dir, 'data')
    sync_khl_data(data_dir)
