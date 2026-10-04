import json
from pathlib import Path

import pytest

from tools.adapters import khl_aggregator, nhl_web
from tools.normalize import normalize_all
from tools.validate_data import validate_all


def test_nhl_schedule_does_not_invent_boxscore_or_roster(tmp_path, monkeypatch):
    monkeypatch.setattr(nhl_web, 'fetch_nhl_url', lambda url: {
        'gameWeek': [{'date': '2026-10-04', 'games': [{
            'id': 2026020001, 'gameType': 2, 'gameState': 'OFF',
            'startTimeUTC': '2026-10-04T23:00:00Z',
            'periodDescriptor': {'periodType': 'OT', 'number': 4},
            'homeTeam': {'abbrev': 'EDM', 'score': 3},
            'awayTeam': {'abbrev': 'TOR', 'score': 2},
        }]}]
    })
    nhl_web.sync_nhl_schedule(tmp_path)
    match = json.loads((tmp_path / 'matches' / 'nhl:2026020001.json').read_text())
    assert match['home']['score'] == 3
    assert match['finishedIn'] == 'OT'
    assert match['home']['periods'] == []
    assert match['home']['shots'] is None
    assert match['events'] == []
    assert match['lineups'] is None
    assert match['stats'] is None
    assert match['clock'] is None


def test_nhl_schedule_keeps_official_gamecenter_as_verified_external_link(tmp_path, monkeypatch):
    monkeypatch.setattr(nhl_web, 'fetch_nhl_url', lambda url: {
        'gameWeek': [{'date': '2026-10-04', 'games': [{
            'id': 2026020002, 'gameType': 2, 'gameState': 'FUT',
            'startTimeUTC': '2026-10-04T23:00:00Z',
            'gameCenterLink': '/gamecenter/bos-vs-nyr/2026/10/04/2026020002',
            'homeTeam': {'abbrev': 'NYR'}, 'awayTeam': {'abbrev': 'BOS'},
        }]}]
    })
    nhl_web.sync_nhl_schedule(tmp_path)
    match = json.loads((tmp_path / 'matches' / 'nhl:2026020002.json').read_text())
    assert match['broadcast'] == {
        'type': 'external',
        'verified': True,
        'provider': 'NHL.com',
        'url': 'https://www.nhl.com/gamecenter/bos-vs-nyr/2026/10/04/2026020002',
        'sourceName': 'NHL.com Gamecenter',
        'sourceUrl': 'https://www.nhl.com/gamecenter/bos-vs-nyr/2026/10/04/2026020002',
        'verifiedAt': match['broadcast']['verifiedAt'],
    }


def test_nhl_live_schedule_hydrates_score_from_official_gamecenter(tmp_path, monkeypatch):
    calls = []

    def fetch(url):
        calls.append(url)
        if url.endswith('/schedule/now'):
            return {'gameWeek': [{'date': '2026-10-04', 'games': [{
                'id': 2026020003, 'gameType': 2, 'gameState': 'LIVE',
                'startTimeUTC': '2026-10-04T17:00:00Z',
                'periodDescriptor': {'number': 1, 'periodType': 'REG'},
                'homeTeam': {'abbrev': 'DET'}, 'awayTeam': {'abbrev': 'WPG'},
            }]}]}
        if url.endswith('/boxscore'):
            return {
                'gameState': 'LIVE',
                'periodDescriptor': {'number': 2, 'periodType': 'REG'},
                'clock': {'timeRemaining': '15:48', 'inIntermission': False},
                'homeTeam': {'abbrev': 'DET', 'score': 0, 'sog': 14},
                'awayTeam': {'abbrev': 'WPG', 'score': 2, 'sog': 15},
            }
        if url.endswith('/play-by-play'):
            return {
                'homeTeam': {'id': 17, 'abbrev': 'DET'},
                'awayTeam': {'id': 52, 'abbrev': 'WPG'},
                'plays': [{
                    'typeDescKey': 'goal',
                    'periodDescriptor': {'number': 1, 'periodType': 'REG'},
                    'timeInPeriod': '04:12', 'sortOrder': 10,
                    'details': {'eventOwnerTeamId': 52, 'scoringPlayerId': 99,
                                'awayScore': 1, 'homeScore': 0},
                }],
            }
        raise AssertionError(url)

    monkeypatch.setattr(nhl_web, 'fetch_nhl_url', fetch)
    nhl_web.sync_nhl_schedule(tmp_path)
    match = json.loads((tmp_path / 'matches' / 'nhl:2026020003.json').read_text())
    assert match['status'] == 'LIVE'
    assert match['home']['score'] == 0
    assert match['away']['score'] == 2
    assert match['period'] == 2
    assert match['clock'] == '15:48'
    assert match['events'][0]['type'] == 'GOAL'
    assert match['stats']['shotsOnGoal'] == [14, 15]
    assert any(url.endswith('/boxscore') for url in calls)


def test_normalizer_does_not_modify_unverified_scores_or_freshness(tmp_path):
    data = tmp_path / 'data'
    dates = data / 'matches' / 'by-date'
    dates.mkdir(parents=True)
    match = {'id': 'nhl:1', 'status': 'FINISHED', 'home': {'score': 3, 'periods': [1, 1, 0]}}
    (data / 'matches' / 'nhl:1.json').write_text(json.dumps(match))
    (dates / '2026-10-04.json').write_text(json.dumps([match]))
    (data / 'meta.json').write_text(json.dumps({'updatedAt': '2026-10-03T00:00:00Z'}))
    normalize_all(data)
    assert json.loads((data / 'matches' / 'nhl:1.json').read_text()) == match
    meta = json.loads((data / 'meta.json').read_text())
    assert meta['updatedAt'] == '2026-10-03T00:00:00Z'
    assert meta['dateCounts'] == {'2026-10-04': 1}


def test_khl_sync_cannot_publish_from_invalid_feed(tmp_path, monkeypatch):
    monkeypatch.setattr(khl_aggregator, 'fetch_khl_url', lambda url: {})
    with pytest.raises(khl_aggregator.KHLFeedError, match='current_stage_id'):
        khl_aggregator.sync_khl_data(tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_empty_nhl_standings_cannot_overwrite(tmp_path, monkeypatch):
    monkeypatch.setattr(nhl_web, 'fetch_nhl_url', lambda url: {'standings': []})
    with pytest.raises(ValueError, match='no teams'):
        nhl_web.sync_nhl_standings_and_teams(tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_failed_nhl_leader_request_preserves_previous_file(tmp_path, monkeypatch):
    output = tmp_path / 'leaders' / 'NHL-2026-27.json'
    output.parent.mkdir()
    output.write_text('{"existing": true}')

    def fetch(url):
        if 'goalie' in url:
            raise OSError('network unavailable')
        return {'points': [{'id': 1, 'firstName': {'default': 'A'},
                            'lastName': {'default': 'B'}, 'teamAbbrev': 'BOS', 'value': 1}]}

    monkeypatch.setattr(nhl_web, 'fetch_nhl_url', fetch)
    with pytest.raises(OSError, match='network unavailable'):
        nhl_web.sync_nhl_leaders(tmp_path)
    assert output.read_text() == '{"existing": true}'


def test_nhl_standings_positions_are_local_to_each_group(tmp_path, monkeypatch):
    def row(abbr, pts, division):
        return {'seasonId': 20262027, 'teamAbbrev': {'default': abbr},
                'teamName': {'default': abbr}, 'teamCommonName': {'default': abbr},
                'conferenceName': 'Eastern', 'divisionName': division,
                'points': pts, 'wins': pts // 2, 'gamesPlayed': 4}

    monkeypatch.setattr(nhl_web, 'fetch_nhl_url', lambda url: {'standings': [
        row('BUF', 2, 'Atlantic'), row('NYR', 4, 'Metropolitan'),
        row('BOS', 6, 'Atlantic')]})
    nhl_web.sync_nhl_standings_and_teams(tmp_path)
    standings = json.loads((tmp_path / 'standings' / 'NHL-2026-27.json').read_text())
    division = next(g for g in standings['groups'] if g['name'] == 'Дивизион Атлантический')
    assert [(r['teamId'], r['pos']) for r in division['rows']] == [
        ('nhl:bos', 1), ('nhl:buf', 2)]


def test_date_feed_validation_rejects_missing_detail(tmp_path, capsys):
    from shutil import copytree

    root = tmp_path / 'site'
    source = Path(__file__).resolve().parents[1]
    copytree(source / 'schemas', root / 'schemas')
    copytree(source / 'data', root / 'data')
    detail = root / 'data' / 'matches' / 'nhl:2026020022.json'
    detail.unlink()
    assert validate_all(root) is False
    assert 'differs from its detail file' in capsys.readouterr().out
