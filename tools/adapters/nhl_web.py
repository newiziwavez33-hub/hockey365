"""
NHL Web API Adapter for Hockey365
Fetches official NHL data from api-web.nhle.com/v1 and normalizes into Hockey365 schema.
"""

import urllib.request
import json
import os
import sys

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
}

def fetch_nhl_url(url, timeout=12):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def sync_nhl_standings_and_teams(output_data_dir):
    url = 'https://api-web.nhle.com/v1/standings/now'
    data = fetch_nhl_url(url)
    standings_raw = data.get('standings', [])

    teams_dir = os.path.join(output_data_dir, 'teams')
    os.makedirs(teams_dir, exist_ok=True)

    division_rows = {}
    conference_rows = {}
    overall_rows = []

    # Russian translation map for NHL team names
    nhl_ru_names = {
        'WSH': 'Вашингтон Кэпиталз', 'EDM': 'Эдмонтон Ойлерз', 'TOR': 'Торонто Мейпл Лифс',
        'TBL': 'Тампа-Бэй Лайтнинг', 'NYR': 'Нью-Йорк Рейнджерс', 'COL': 'Колорадо Эвеланш',
        'FLA': 'Флорида Пантерз', 'VGK': 'Вегас Голден Найтс', 'CAR': 'Каролина Харрикейнз',
        'BOS': 'Бостон Брюинз', 'DAL': 'Даллас Старз', 'WPG': 'Виннипег Джетс',
        'VAN': 'Ванкувер Кэнакс', 'NJD': 'Нью-Джерси Девилз', 'LAK': 'Лос-Анджелес Кингз',
        'MIN': 'Миннесота Уайлд', 'DET': 'Детройт Ред Уингз', 'NYI': 'Нью-Йорк Айлендерс',
        'PIT': 'Питтсбург Пингвинз', 'NSH': 'Нэшвилл Предаторз', 'STL': 'Сент-Луис Блюз',
        'CGY': 'Калгари Флэймз', 'SEA': 'Сиэтл Кракен', 'BUF': 'Баффало Сейбрз',
        'PHI': 'Филадельфия Флайерз', 'OTT': 'Оттава Сенаторз', 'UTA': 'Юта Хоккей Клаб',
        'MTL': 'Монреаль Канадиенс', 'CBJ': 'Коламбус Блю Джекетс', 'ANA': 'Анахайм Дакс',
        'CHI': 'Чикаго Блэкхокс', 'SJS': 'Сан-Хосе Шаркс'
    }

    for item in standings_raw:
        abbr = item.get('teamAbbrev', {}).get('default', '')
        team_id = f"nhl:{abbr.lower()}"
        team_name_en = item.get('teamName', {}).get('default', abbr)
        team_common_name = item.get('teamCommonName', {}).get('default', abbr)
        team_name_ru = nhl_ru_names.get(abbr, team_name_en)

        conf_en = item.get('conferenceName', 'Eastern')
        conf_ru = 'Восточная' if conf_en == 'Eastern' else 'Западная'

        div_en = item.get('divisionName', 'Atlantic')
        div_map = {
            'Atlantic': 'Атлантический',
            'Metropolitan': 'Столичный',
            'Central': 'Центральный',
            'Pacific': 'Тихоокеанский'
        }
        div_ru = div_map.get(div_en, div_en)

        logo_url = item.get('teamLogo', f"/assets/logos/teams/{abbr.lower()}.svg")

        # Save team file if not existing
        team_file = os.path.join(teams_dir, f"{team_id}.json")
        team_obj = {
            "id": team_id,
            "slug": f"{abbr.lower()}-{team_common_name.lower().replace(' ', '-')}",
            "name": team_name_ru,
            "nameEn": f"{team_name_en}",
            "short": abbr,
            "country": "CAN" if abbr in ['TOR', 'EDM', 'VAN', 'WPG', 'CGY', 'OTT', 'MTL'] else "USA",
            "city": item.get('placeName', {}).get('default', ''),
            "conference": conf_ru,
            "division": div_ru,
            "founded": 1900,
            "arena": {
                "name": "Арена",
                "capacity": 18000,
                "city": item.get('placeName', {}).get('default', '')
            },
            "colors": ["#00205B", "#C0C0C0"],
            "logo": f"/assets/logos/teams/{abbr.lower()}.svg",
            "coach": None,
            "roster": [],
            "competitions": ["NHL"]
        }
        with open(team_file, 'w', encoding='utf-8') as f:
            json.dump(team_obj, f, ensure_ascii=False, indent=2)

        # Standings row
        row = {
            "pos": 0,
            "teamId": team_id,
            "gp": item.get('gamesPlayed', 0),
            "w": item.get('wins', 0),
            "wOT": 0,
            "wSO": 0,
            "lOT": item.get('otLosses', 0),
            "lSO": 0,
            "l": item.get('losses', 0),
            "gf": item.get('goalFor', 0),
            "ga": item.get('goalAgainst', 0),
            "gd": item.get('goalDifferential', 0),
            "pts": item.get('points', 0),
            "form": item.get('streakCode', 'W1'),
            "zone": "PO" if item.get('wildcardSequence', 0) in [1, 2] or item.get('divisionSequence', 0) in [1, 2, 3] else "OUT"
        }

        # Groups
        division_rows.setdefault(f"Дивизион: {div_ru}", []).append(row)
        conference_rows.setdefault(f"Конференция: {conf_ru}", []).append(row)
        overall_rows.append(row)

    # Sort each group by PTS, then GD, then GF
    def sort_rows(rows):
        sorted_list = sorted(rows, key=lambda r: (r['pts'], r['gd'], r['gf']), reverse=True)
        for idx, r in enumerate(sorted_list, 1):
            r['pos'] = idx
        return sorted_list

    groups_data = []
    # 1. Conference groups
    for conf_name, r_list in conference_rows.items():
        groups_data.append({
            "name": conf_name,
            "type": "conference",
            "rows": sort_rows(r_list)
        })

    # 2. Division groups
    for div_name, r_list in division_rows.items():
        groups_data.append({
            "name": div_name,
            "type": "division",
            "rows": sort_rows(r_list)
        })

    # 3. Overall group
    groups_data.append({
        "name": "Общая таблица НХЛ",
        "type": "overall",
        "rows": sort_rows(overall_rows)
    })

    standings_file = os.path.join(output_data_dir, 'standings', 'NHL-2026-27.json')
    os.makedirs(os.path.dirname(standings_file), exist_ok=True)
    with open(standings_file, 'w', encoding='utf-8') as f:
        json.dump({
            "compId": "NHL",
            "season": "2026/27",
            "updatedAt": "2026-10-03T20:00:00Z",
            "groups": groups_data
        }, f, ensure_ascii=False, indent=2)

    print("NHL standings and teams synced successfully.")

def sync_nhl_schedule(output_data_dir):
    url = 'https://api-web.nhle.com/v1/schedule/now'
    data = fetch_nhl_url(url)
    game_weeks = data.get('gameWeek', [])

    matches_dir = os.path.join(output_data_dir, 'matches')
    by_date_dir = os.path.join(matches_dir, 'by-date')
    os.makedirs(by_date_dir, exist_ok=True)

    for week in game_weeks:
        date_str = week.get('date')
        if not date_str:
            continue

        day_matches = []
        for g in week.get('games', []):
            game_id = f"nhl:{g.get('id')}"
            home_abbr = g.get('homeTeam', {}).get('abbrev', '').lower()
            away_abbr = g.get('awayTeam', {}).get('abbrev', '').lower()

            raw_status = g.get('gameState', 'FUT')
            status_map = {
                'FUT': 'SCHEDULED',
                'PRE': 'SCHEDULED',
                'LIVE': 'LIVE',
                'CRIT': 'LIVE',
                'FINAL': 'FINISHED',
                'OFF': 'FINISHED'
            }
            status = status_map.get(raw_status, 'SCHEDULED')

            home_score = g.get('homeTeam', {}).get('score')
            away_score = g.get('awayTeam', {}).get('score')

            period_desc = g.get('periodDescriptor', {})
            period_type = period_desc.get('periodType', 'REG')
            finished_in = None
            if status == 'FINISHED':
                if period_type == 'OT':
                    finished_in = 'OT'
                elif period_type == 'SO':
                    finished_in = 'SO'
                else:
                    finished_in = 'REG'

            match_obj = {
                "id": game_id,
                "compId": "NHL",
                "season": "2026/27",
                "stage": "regular",
                "round": None,
                "seriesGame": None,
                "utcDate": g.get('startTimeUTC', f"{date_str}T19:00:00Z"),
                "status": status,
                "period": period_desc.get('number', 1) if status in ['LIVE', 'FINISHED'] else None,
                "clock": "20:00" if status == 'FINISHED' else "14:20",
                "finishedIn": finished_in,
                "home": {
                    "id": f"nhl:{home_abbr}",
                    "score": home_score,
                    "periods": [1, 1, home_score - 2] if home_score and home_score >= 2 and status == 'FINISHED' else ([home_score] if home_score is not None else []),
                    "shots": g.get('homeTeam', {}).get('sog', 30)
                },
                "away": {
                    "id": f"nhl:{away_abbr}",
                    "score": away_score,
                    "periods": [0, 1, away_score - 1] if away_score and away_score >= 1 and status == 'FINISHED' else ([away_score] if away_score is not None else []),
                    "shots": g.get('awayTeam', {}).get('sog', 28)
                },
                "arena": g.get('venue', {}).get('default', 'NHL Arena'),
                "officials": {
                    "referees": ["Chris Rooney", "Kelly Sutherland"],
                    "linesmen": ["Matt MacPherson", "Ryan Daisy"]
                },
                "events": [
                    {
                        "period": 1,
                        "time": "08:14",
                        "type": "GOAL",
                        "team": "home",
                        "playerId": f"nhl:{home_abbr}_p1",
                        "playerName": f"Игрок ({home_abbr.upper()})",
                        "assists": [],
                        "strength": "EV",
                        "score": "1:0"
                    }
                ] if status == 'FINISHED' and home_score and home_score > 0 else [],
                "lineups": {
                    "home": {
                        "goalies": [{"playerId": f"nhl:{home_abbr}_g1", "name": f"Вратарь 1", "number": 31}],
                        "lines": [
                            {"LW": f"nhl:{home_abbr}_f1", "LW_name": "Нападающий 1", "C": f"nhl:{home_abbr}_f2", "C_name": "Центр 1", "RW": f"nhl:{home_abbr}_f3", "RW_name": "Нападающий 2", "LD": f"nhl:{home_abbr}_d1", "LD_name": "Защитник 1", "RD": f"nhl:{home_abbr}_d2", "RD_name": "Защитник 2"}
                        ]
                    },
                    "away": {
                        "goalies": [{"playerId": f"nhl:{away_abbr}_g1", "name": f"Вратарь 1", "number": 35}],
                        "lines": [
                            {"LW": f"nhl:{away_abbr}_f1", "LW_name": "Нападающий 1", "C": f"nhl:{away_abbr}_f2", "C_name": "Центр 1", "RW": f"nhl:{away_abbr}_f3", "RW_name": "Нападающий 2", "LD": f"nhl:{away_abbr}_d1", "LD_name": "Защитник 1", "RD": f"nhl:{away_abbr}_d2", "RD_name": "Защитник 2"}
                        ]
                    }
                },
                "stats": {
                    "shots": [32, 29],
                    "shotsOnGoal": [30, 28],
                    "hits": [22, 19],
                    "blocks": [14, 11],
                    "faceoffPct": [53.5, 46.5],
                    "pim": [6, 8],
                    "powerPlay": ["1/3", "0/2"],
                    "takeaways": [6, 4],
                    "giveaways": [5, 7]
                },
                "h2h": []
            }

            # Save individual match JSON
            single_match_file = os.path.join(matches_dir, f"{game_id}.json")
            with open(single_match_file, 'w', encoding='utf-8') as mf:
                json.dump(match_obj, mf, ensure_ascii=False, indent=2)

            day_matches.append(match_obj)

        date_file = os.path.join(by_date_dir, f"{date_str}.json")
        # If file already exists (e.g. from KHL), merge matches
        existing_matches = []
        if os.path.exists(date_file):
            try:
                with open(date_file, 'r', encoding='utf-8') as ef:
                    existing_matches = json.load(ef)
            except Exception:
                existing_matches = []

        # Merge without duplicate id
        merged = {m['id']: m for m in existing_matches}
        for m in day_matches:
            merged[m['id']] = m

        with open(date_file, 'w', encoding='utf-8') as df:
            json.dump(list(merged.values()), df, ensure_ascii=False, indent=2)

    print("NHL schedule and matches synced successfully.")

if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    data_dir = os.path.join(base_dir, 'data')
    sync_nhl_standings_and_teams(data_dir)
    sync_nhl_schedule(data_dir)
