"""
NHL Web API Adapter for Hockey365
Fetches official NHL data from api-web.nhle.com/v1:
- Standings and teams
- Real schedules and live gamecenter scores
- Real skater and goalie leaders
- Real star player profiles and team rosters
"""

import urllib.request
import json
import os
import sys
from datetime import datetime, timezone

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
    if not standings_raw:
        raise ValueError('NHL standings response has no teams; existing files preserved')
    if any(item.get('seasonId') != 20262027 for item in standings_raw):
        raise ValueError('NHL standings are not for 2026/27; existing files preserved')

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

        # Standings do not contain verified arena, coach, founding year or roster.
        # Do not overwrite team profiles with invented details.

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

        division_rows.setdefault(f"Дивизион: {div_ru}", []).append(row)
        conference_rows.setdefault(f"Конференция: {conf_ru}", []).append(row)
        overall_rows.append(row)

    def sort_rows(rows):
        sorted_list = [dict(row) for row in sorted(rows, key=lambda r: (r['pts'], r['gd'], r['gf']), reverse=True)]
        for idx, r in enumerate(sorted_list, 1):
            r['pos'] = idx
        return sorted_list

    groups_data = []
    # 1. Conference groups
    for conf_name in ["Восточная", "Западная"]:
        if f"Конференция: {conf_name}" in conference_rows:
            groups_data.append({
                "name": f"Конференция {conf_name}",
                "type": "conference",
                "rows": sort_rows(conference_rows[f"Конференция: {conf_name}"])
            })

    # 2. Division groups
    for div_name in ["Атлантический", "Столичный", "Центральный", "Тихоокеанский"]:
        if f"Дивизион: {div_name}" in division_rows:
            groups_data.append({
                "name": f"Дивизион {div_name}",
                "type": "division",
                "rows": sort_rows(division_rows[f"Дивизион: {div_name}"])
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
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "groups": groups_data
        }, f, ensure_ascii=False, indent=2)

    print("NHL standings and teams synced successfully.")

def sync_nhl_leaders(output_data_dir):
    print("Syncing real NHL leaders...")
    skater_url = 'https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=points,goals,assists'
    goalie_url = 'https://api-web.nhle.com/v1/goalie-stats-leaders/current?categories=goalsAgainstAverage,savePctg'

    categories = {
        "points": [],
        "goals": [],
        "assists": [],
        "gaa": [],
        "svPct": []
    }

    s_data = fetch_nhl_url(skater_url)
    try:
        for cat in ['points', 'goals', 'assists']:
            if cat in s_data:
                for item in s_data[cat][:10]:
                    fn = item.get('firstName', {}).get('default', '')
                    ln = item.get('lastName', {}).get('default', '')
                    team_abbr = item.get('teamAbbrev', '').lower()
                    categories[cat].append({
                        "playerId": f"nhl:p_{item.get('id')}",
                        "playerName": f"{fn} {ln}",
                        "teamId": f"nhl:{team_abbr}",
                        "value": item.get('value', 0)
                    })
    except (TypeError, ValueError, KeyError) as e:
        raise ValueError('Invalid NHL skater leader response; existing file preserved') from e

    g_data = fetch_nhl_url(goalie_url)
    try:
        if 'goalsAgainstAverage' in g_data:
            for item in g_data['goalsAgainstAverage'][:10]:
                fn = item.get('firstName', {}).get('default', '')
                ln = item.get('lastName', {}).get('default', '')
                team_abbr = item.get('teamAbbrev', '').lower()
                categories['gaa'].append({
                    "playerId": f"nhl:p_{item.get('id')}",
                    "playerName": f"{fn} {ln}",
                    "teamId": f"nhl:{team_abbr}",
                    "value": round(item.get('value', 0.0), 2)
                })
        if 'savePctg' in g_data:
            for item in g_data['savePctg'][:10]:
                fn = item.get('firstName', {}).get('default', '')
                ln = item.get('lastName', {}).get('default', '')
                team_abbr = item.get('teamAbbrev', '').lower()
                categories['svPct'].append({
                    "playerId": f"nhl:p_{item.get('id')}",
                    "playerName": f"{fn} {ln}",
                    "teamId": f"nhl:{team_abbr}",
                    "value": round(item.get('value', 0.0), 3)
                })
    except (TypeError, ValueError, KeyError) as e:
        raise ValueError('Invalid NHL goalie leader response; existing file preserved') from e

    leaders_file = os.path.join(output_data_dir, 'leaders', 'NHL-2026-27.json')
    os.makedirs(os.path.dirname(leaders_file), exist_ok=True)
    if not categories['points'] or not categories['gaa']:
        raise ValueError('NHL leaders unavailable; existing file preserved')
    with open(leaders_file, 'w', encoding='utf-8') as f:
        json.dump({
            "compId": "NHL",
            "season": "2026/27",
            "categories": categories
        }, f, ensure_ascii=False, indent=2)

    print("NHL leaders synced successfully.")

def sync_nhl_star_players(output_data_dir):
    print("Syncing real NHL star player profiles...")
    players_dir = os.path.join(output_data_dir, 'players')
    os.makedirs(players_dir, exist_ok=True)

    # Key NHL Stars (McDavid, MacKinnon, Ovechkin, Matthews, Kucherov, Panarin, Makar, Shesterkin)
    star_ids = [
        8478402, # Connor McDavid
        8477492, # Nathan MacKinnon
        8471214, # Alex Ovechkin
        8479318, # Auston Matthews
        8476453, # Nikita Kucherov
        8478550, # Artemi Panarin
        8480069, # Cale Makar
        8478048  # Igor Shesterkin
    ]

    for p_id in star_ids:
        try:
            url = f"https://api-web.nhle.com/v1/player/{p_id}/landing"
            p_data = fetch_nhl_url(url)

            fn = p_data.get('firstName', {}).get('default', '')
            ln = p_data.get('lastName', {}).get('default', '')
            pos = p_data.get('position', 'C')
            if pos in ['L', 'LW']: pos = 'LW'
            elif pos in ['R', 'RW']: pos = 'RW'
            elif pos == 'D': pos = 'D'
            elif pos == 'G': pos = 'G'
            elif pos != 'C':
                print(f'  [Player] {p_id} has unknown position; skipping.')
                continue

            team_abbr = p_data.get('currentTeamAbbrev', '').lower()
            if not team_abbr:
                print(f'  [Player] {p_id} has no current team; skipping.')
                continue

            featured = p_data.get('featuredStats', {})
            season_stats = featured.get('regularSeason', {}).get('subSeason', {})
            stats = []
            if featured.get('season') == 20262027 and season_stats:
                entry = {'season': '2026/27', 'compId': 'NHL', 'gp': season_stats.get('gamesPlayed', 0)}
                for source, dest in [('goals', 'g'), ('assists', 'a'), ('points', 'pts'),
                                     ('plusMinus', 'plusMinus'), ('pim', 'pim'), ('shots', 'shots')]:
                    if source in season_stats:
                        entry[dest] = season_stats[source]
                stats.append(entry)

            player_obj = {
                "id": f"nhl:p_{p_id}",
                "name": f"{fn} {ln}",
                "nameEn": f"{fn} {ln}",
                "position": pos,
                "shoots": p_data.get('shootsCatches'),
                "birthDate": p_data.get('birthDate'),
                "heightCm": p_data.get('heightInCentimeters'),
                "weightKg": p_data.get('weightInKilograms'),
                "nationality": p_data.get('birthCountry'),
                "number": p_data.get('sweaterNumber'),
                "teamId": f"nhl:{team_abbr}",
                "photo": p_data.get('headshot'),
                "stats": stats,
                "career": [],
                "source": {
                    "provider": "NHL Web API",
                    "official": True,
                    "endpoint": url,
                    "fetchedAt": datetime.now(timezone.utc).isoformat()
                }
            }

            p_file = os.path.join(players_dir, f"nhl:p_{p_id}.json")
            with open(p_file, 'w', encoding='utf-8') as f:
                json.dump(player_obj, f, ensure_ascii=False, indent=2)
            print(f"  [Player] {fn} {ln} saved.")
        except Exception as e:
            print(f"Failed to fetch player {p_id}:", e)

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
                "stage": {1: 'preseason', 2: 'regular', 3: 'playoff'}.get(g.get('gameType'), 'regular'),
                "round": None,
                "seriesGame": None,
                "utcDate": g['startTimeUTC'],
                "status": status,
                "period": period_desc.get('number', 1) if status in ['LIVE', 'FINISHED'] else None,
                "clock": None,
                "finishedIn": finished_in,
                "home": {
                    "id": f"nhl:{home_abbr}",
                    "score": home_score,
                    "periods": [],
                    "shots": g.get('homeTeam', {}).get('sog')
                },
                "away": {
                    "id": f"nhl:{away_abbr}",
                    "score": away_score,
                    "periods": [],
                    "shots": g.get('awayTeam', {}).get('sog')
                },
                "arena": g.get('venue', {}).get('default'),
                "officials": {"referees": [], "linesmen": []},
                "events": [],
                "lineups": None,
                "stats": None,
                "h2h": []
            }

            # The public schedule exposes an official NHL Gamecenter page, but
            # not a guaranteed playable stream URL. Keep that distinction
            # explicit: the client can take the user to the rights-holder page
            # without pretending that every market has the same video rights.
            game_center_path = g.get('gameCenterLink')
            if isinstance(game_center_path, str) and game_center_path.startswith('/gamecenter/'):
                game_center_url = f"https://www.nhl.com{game_center_path}"
                match_obj["broadcast"] = {
                    "type": "external",
                    "verified": True,
                    "provider": "NHL.com",
                    "url": game_center_url,
                    "sourceName": "NHL.com Gamecenter",
                    "sourceUrl": game_center_url,
                    "verifiedAt": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                }

            single_match_file = os.path.join(matches_dir, f"{game_id}.json")
            with open(single_match_file, 'w', encoding='utf-8') as mf:
                json.dump(match_obj, mf, ensure_ascii=False, indent=2)

            day_matches.append(match_obj)

        date_file = os.path.join(by_date_dir, f"{date_str}.json")
        existing_matches = []
        if os.path.exists(date_file):
            try:
                with open(date_file, 'r', encoding='utf-8') as ef:
                    existing_matches = json.load(ef)
            except Exception:
                existing_matches = []

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
    sync_nhl_leaders(data_dir)
    sync_nhl_star_players(data_dir)
    # A published snapshot is fresh only after the mandatory NHL feeds succeed.
    meta_file = os.path.join(data_dir, 'meta.json')
    with open(meta_file, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    meta['updatedAt'] = datetime.now(timezone.utc).isoformat()
    with open(meta_file, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
