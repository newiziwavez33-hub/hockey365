import json
from copy import deepcopy
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

import pytest

from tools.adapters import khl_aggregator


def _epoch_ms(value):
    return int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000)


def _responses():
    return {
        khl_aggregator.DATA_ENDPOINT: {
            'current_stage_id': 407,
            'stages_v2': [{
                'id': 407,
                'type': 'regular',
                'season': '2026/2027',
                'title': 'Регулярный чемпионат',
            }],
        },
        khl_aggregator.TEAMS_ENDPOINT: [
            {'team': {'id': 16, 'khl_id': 2, 'name': 'ЦСКА', 'short': 'ЦСК', 'image': 'https://thumbs.webcaster.pro/teams/cska.png'}},
            {'team': {'id': 26, 'khl_id': 1, 'name': 'Локомотив', 'short': 'ЛОК', 'image': 'https://thumbs.webcaster.pro/teams/loko.png'}},
        ],
        khl_aggregator.EVENTS_ENDPOINT: [
            {'event': {
                'id': 2786722,
                'match_id': '900001',
                'khl_id': 900001,
                'stage_id': 407,
                'type_id': 18,
                'game_state_key': 'finished',
                'start_at': _epoch_ms('2026-10-04T17:00:00Z'),
                'event_start_at': _epoch_ms('2026-10-04T16:50:00Z'),
                'team_a': {'id': 16, 'khl_id': 2, 'name': 'ЦСКА'},
                'team_b': {'id': 26, 'khl_id': 1, 'name': 'Локомотив'},
                'score': '3:2',
                'scores': {
                    'first_period': '1:0',
                    'second_period': '1:1',
                    'third_period': '1:1',
                    'overtime': None,
                    'bullitt': None,
                },
            }},
            {'event': {
                'id': 2786723,
                'match_id': '900002',
                'stage_id': 407,
                'type_id': 24,
                'game_state_key': 'not_yet_started',
                'start_at': _epoch_ms('2026-10-05T17:00:00Z'),
                'event_start_at': _epoch_ms('2026-10-05T17:00:00Z'),
                'team_a': {'id': 26, 'name': 'Локомотив'},
                'team_b': {'id': 16, 'name': 'ЦСКА'},
                # The feed uses 0:0 as a placeholder before puck drop.
                'score': '0:0',
                'scores': {
                    'first_period': None,
                    'second_period': None,
                    'third_period': None,
                    'overtime': None,
                    'bullitt': None,
                },
            }},
            # A valid response can contain another stage; it must not leak
            # into the current-stage date feeds.
            {'event': {
                'id': 2786724,
                'match_id': 'old-stage-match',
                'stage_id': 370,
                'type_id': 18,
                'game_state_key': 'finished',
                'event_start_at': _epoch_ms('2026-10-04T19:00:00Z'),
                'team_a': {'id': 16, 'name': 'ЦСКА'},
                'team_b': {'id': 26, 'name': 'Локомотив'},
                'score': '9:9',
            }},
        ],
    }


def test_khl_sync_normalizes_scores_dates_and_verified_source(tmp_path):
    data_dir = tmp_path / 'data'
    data_dir.mkdir()
    (data_dir / 'meta.json').write_text(json.dumps({
        'updatedAt': '2026-10-04T00:00:00Z',
        'unverifiedCompetitions': ['KHL'],
    }), encoding='utf-8')
    responses = _responses()
    calls = []

    def fake_fetch(url):
        calls.append(url)
        base = url.split('?', 1)[0]
        if base == khl_aggregator.EVENTS_ENDPOINT:
            query = parse_qs(urlsplit(url).query)
            assert query['stage_id'] == ['407']
            assert query['q[start_at_gt_time_from_unixtime]'] == [str(int(datetime(2026, 10, 3, tzinfo=timezone.utc).timestamp()))]
            assert query['q[start_at_lt_time_from_unixtime]'] == [str(int(datetime(2026, 10, 12, tzinfo=timezone.utc).timestamp()))]
            assert query['order_direction'] == ['asc']
            return responses[base] if query['page'] == ['1'] else []
        return responses[base]

    matches = khl_aggregator.sync_khl_data(
        data_dir,
        fetcher=fake_fetch,
        reference_time=datetime(2026, 10, 4, 12, tzinfo=timezone.utc),
    )

    assert [match['id'] for match in matches] == ['khl:900001', 'khl:900002']
    finished = json.loads((data_dir / 'matches' / 'khl:900001.json').read_text(encoding='utf-8'))
    scheduled = json.loads((data_dir / 'matches' / 'khl:900002.json').read_text(encoding='utf-8'))
    assert finished['utcDate'] == '2026-10-04T17:00:00Z'
    assert finished['home']['id'] == 'khl:cska'
    assert (finished['home']['name'], finished['home']['short'], finished['home']['logo']) == (
        'ЦСКА', 'ЦСК', 'https://thumbs.webcaster.pro/teams/cska.png'
    )
    assert finished['away']['id'] == 'khl:lokomotiv'
    assert finished['home']['score'] == 3
    assert finished['away']['score'] == 2
    assert finished['home']['periods'] == [1, 1, 1]
    assert finished['away']['periods'] == [0, 1, 1]
    assert finished['source']['stageId'] == 407
    assert finished['source']['official'] is True
    assert finished['source']['verified'] is True
    assert finished['source']['licenseConfirmed'] is False
    assert finished['source']['verifiedMatches'] is True
    assert scheduled['home']['score'] is None
    assert scheduled['away']['score'] is None
    assert json.loads((data_dir / 'matches' / 'by-date' / '2026-10-04.json').read_text(encoding='utf-8'))[0]['id'] == 'khl:900001'
    assert json.loads((data_dir / 'matches' / 'by-date' / '2026-10-05.json').read_text(encoding='utf-8'))[0]['id'] == 'khl:900002'
    assert calls[0] == khl_aggregator.DATA_ENDPOINT
    assert calls[1].startswith(khl_aggregator.EVENTS_ENDPOINT + '?')
    assert calls[2].startswith(khl_aggregator.EVENTS_ENDPOINT + '?')
    assert calls[3] == khl_aggregator.TEAMS_ENDPOINT

    meta = json.loads((data_dir / 'meta.json').read_text(encoding='utf-8'))
    assert 'KHL' in meta['unverifiedCompetitions']
    assert meta['sourceStatus']['KHL']['verified'] is True
    assert meta['sourceStatus']['KHL']['verifiedMatches'] is True


def test_khl_sync_rejects_malformed_events_and_keeps_khl_hidden(tmp_path):
    data_dir = tmp_path / 'data'
    data_dir.mkdir()
    (data_dir / 'meta.json').write_text(json.dumps({
        'unverifiedCompetitions': [],
    }), encoding='utf-8')
    responses = _responses()
    responses[khl_aggregator.EVENTS_ENDPOINT] = {'unexpected': 'shape'}

    with pytest.raises(khl_aggregator.KHLFeedError, match='events response'):
        khl_aggregator.sync_khl_data(data_dir, fetcher=lambda url: responses[url.split('?', 1)[0]])

    assert not (data_dir / 'matches').exists()
    meta = json.loads((data_dir / 'meta.json').read_text(encoding='utf-8'))
    assert 'KHL' in meta['unverifiedCompetitions']
    assert meta['sourceStatus']['KHL']['verified'] is False
    assert meta['sourceStatus']['KHL']['verifiedMatches'] is False


def test_khl_score_parser_rejects_non_score_instead_of_inventing_zero():
    with pytest.raises(khl_aggregator.KHLFeedError, match='invalid score'):
        khl_aggregator._score('unknown')


def test_khl_sync_removes_legacy_and_stale_window_khl_but_keeps_nhl(tmp_path):
    data_dir = tmp_path / 'data'
    by_date = data_dir / 'matches' / 'by-date'
    by_date.mkdir(parents=True)
    trusted = {
        'id': 'khl:trusted',
        'compId': 'KHL',
        'source': {
            'provider': khl_aggregator.KHL_PROVIDER,
            'verified': True,
            'verifiedMatches': True,
        },
    }
    (by_date / '2026-10-03.json').write_text(json.dumps([
        {'id': 'KHL:old-uppercase', 'compId': 'KHL'},
        {'id': 'khl:old-no-source', 'compId': 'khl'},
        trusted,
        {'id': 'nhl:1', 'compId': 'NHL'},
    ]), encoding='utf-8')
    (data_dir / 'meta.json').write_text(json.dumps({'unverifiedCompetitions': ['KHL']}), encoding='utf-8')
    responses = _responses()

    def fake_fetch(url):
        base = url.split('?', 1)[0]
        return [] if base == khl_aggregator.EVENTS_ENDPOINT and parse_qs(urlsplit(url).query)['page'] != ['1'] else responses[base]

    khl_aggregator.sync_khl_data(
        data_dir,
        fetcher=fake_fetch,
        reference_time=datetime(2026, 10, 4, tzinfo=timezone.utc),
    )
    feed = json.loads((by_date / '2026-10-03.json').read_text(encoding='utf-8'))
    assert {item['id'] for item in feed} == {'nhl:1'}


def test_khl_team_id_and_khl_id_namespaces_do_not_collide():
    teams = khl_aggregator._team_index([
        {'id': 101, 'khl_id': 1, 'name': 'ЦСКА'},
        {'id': 1, 'khl_id': 101, 'name': 'Локомотив'},
    ])
    assert teams['id']['101']['name'] == 'ЦСКА'
    assert teams['khl_id']['101']['name'] == 'Локомотив'
    with pytest.raises(khl_aggregator.KHLFeedError, match='different teams'):
        khl_aggregator._team_id({'id': 101, 'khl_id': 101}, teams)


def _normalize(event=None, teams=None):
    responses = _responses()
    event = deepcopy(event if event is not None else responses[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    source_teams = teams if teams is not None else khl_aggregator._extract_teams(responses[khl_aggregator.TEAMS_ENDPOINT])
    return khl_aggregator.normalize_event(
        event, stage_id=407, stage=responses[khl_aggregator.DATA_ENDPOINT]['stages_v2'][0],
        teams=khl_aggregator._team_index(source_teams), fetched_at='2026-10-04T12:00:00Z',
    )


@pytest.mark.parametrize('state', [None, '', 'finished-but-unverified', 'live_stream', 'random', 1])
def test_unknown_game_state_is_rejected(state):
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event['game_state_key'] = state
    with pytest.raises(khl_aggregator.KHLFeedError, match='unknown game state'):
        _normalize(event)


@pytest.mark.parametrize('status', ['live', 'intermission', 'finished'])
@pytest.mark.parametrize('score', [None, {'home': None, 'away': 2}, {'home': -1, 'away': 2}, {'home': 1, 'away': -2}])
def test_started_games_require_both_nonnegative_scores(status, score):
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event.update(game_state_key=status, score=score)
    with pytest.raises(khl_aggregator.KHLFeedError, match='nonnegative|negative'):
        _normalize(event)


@pytest.mark.parametrize('match_id,khl_id', [
    (None, None), ('bad-match', None), (True, None), ('900001/2', None), ('900001', 900002),
])
def test_event_id_cannot_replace_match_id(match_id, khl_id):
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event.update(id=2786722, match_id=match_id, khl_id=khl_id)
    with pytest.raises(khl_aggregator.KHLFeedError, match='match_id|match id'):
        _normalize(event)


def test_confirmed_khl_id_can_identify_match_when_match_id_absent():
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event.pop('match_id')
    assert _normalize(event)['id'] == 'khl:900001'


@pytest.mark.parametrize('type_id', [None, 17, 19, 25])
def test_only_game_event_types_are_accepted(type_id):
    responses = _responses()
    event = deepcopy(responses[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event.update(type_id=type_id, event_or_quote_type_name='архив')
    assert khl_aggregator.normalize_schedule(
        [{'event': event}], stage_id=407, stage=responses[khl_aggregator.DATA_ENDPOINT]['stages_v2'][0],
        teams=khl_aggregator._team_index(khl_aggregator._extract_teams(responses[khl_aggregator.TEAMS_ENDPOINT])),
        fetched_at='2026-10-04T12:00:00Z',
    ) == []


@pytest.mark.parametrize('image', [
    'http://thumbs.webcaster.pro/team.png', 'https://thumbs.webcaster.pro.evil.test/team.png',
    'https://thumbs.webcaster.pro@evil.test/team.png', 'https://127.0.0.1/logo.png',
    'https://thumbs.webcaster.pro:443/team.png', 'https://thumbs.webcaster.pro\\@evil.test/team.png',
])
def test_unsafe_team_image_and_event_media_never_leak(image):
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event['media'] = {'url': 'https://video.example.test/raw.mp4', 'ip': '127.0.0.1'}
    teams = khl_aggregator._extract_teams(_responses()[khl_aggregator.TEAMS_ENDPOINT])
    teams[0]['image'] = image
    match = _normalize(event, teams)
    assert match['home']['name'] == 'ЦСКА'
    assert 'logo' not in match['home']
    assert 'media' not in json.dumps(match)
    assert '127.0.0.1' not in json.dumps(match)


def test_team_names_are_from_verified_teams_even_without_local_dossiers(tmp_path):
    teams = khl_aggregator._extract_teams(_responses()[khl_aggregator.TEAMS_ENDPOINT])
    teams[0]['name'] = 'Драконы'
    teams[0]['short'] = 'ДРА'
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event['team_a']['name'] = 'untrusted event label'
    match = _normalize(event, teams)
    assert match['home']['id'] == 'khl:dragons'
    assert match['home']['name'] == 'Драконы'
    assert match['home']['short'] == 'ДРА'
    assert match['home']['logo'].startswith('https://thumbs.webcaster.pro/')
    assert not (tmp_path / 'teams' / 'khl:dragons.json').exists()


def test_conflicting_team_namespace_and_duplicate_home_away_are_rejected():
    teams = khl_aggregator._extract_teams(_responses()[khl_aggregator.TEAMS_ENDPOINT])
    with pytest.raises(khl_aggregator.KHLFeedError, match='conflicting id'):
        khl_aggregator._team_index(teams + [{'id': 16, 'khl_id': 9, 'name': 'Драконы'}])
    with pytest.raises(khl_aggregator.KHLFeedError, match='conflicting khl_id'):
        khl_aggregator._team_index(teams + [{'id': 99, 'khl_id': 2, 'name': 'Драконы'}])
    event = deepcopy(_responses()[khl_aggregator.EVENTS_ENDPOINT][0]['event'])
    event['team_b'] = {'khl_id': 2}
    with pytest.raises(khl_aggregator.KHLFeedError, match='same home and away'):
        _normalize(event)
    event['team_b'] = {'id': 999, 'khl_id': 1}
    with pytest.raises(khl_aggregator.KHLFeedError, match='missing from teams_v2'):
        _normalize(event)


def test_sync_drops_out_of_window_and_refreshes_rescheduled_fixture_without_losing_nhl(tmp_path):
    data_dir = tmp_path / 'data'
    by_date = data_dir / 'matches' / 'by-date'
    by_date.mkdir(parents=True)
    data_dir.joinpath('meta.json').write_text('{}', encoding='utf-8')
    responses = _responses()
    def fake_fetch(url):
        base = url.split('?', 1)[0]
        if base == khl_aggregator.EVENTS_ENDPOINT and parse_qs(urlsplit(url).query)['page'] != ['1']:
            return []
        return responses[base]
    reference = datetime(2026, 10, 4, tzinfo=timezone.utc)
    khl_aggregator.sync_khl_data(data_dir, fetcher=fake_fetch, reference_time=reference)
    old = json.loads((by_date / '2026-10-04.json').read_text(encoding='utf-8'))[0]
    (by_date / '2026-10-04.json').write_text(json.dumps([old, {'id': 'nhl:1', 'compId': 'NHL'}]), encoding='utf-8')
    (by_date / '2026-09-30.json').write_text(json.dumps([old, {'id': 'nhl:2', 'compId': 'NHL'}]), encoding='utf-8')
    moved = responses[khl_aggregator.EVENTS_ENDPOINT][0]['event']
    moved['start_at'] = _epoch_ms('2026-10-07T18:00:00Z')
    outside = deepcopy(responses[khl_aggregator.EVENTS_ENDPOINT][1])
    outside['event']['match_id'] = '900003'
    outside['event']['start_at'] = _epoch_ms('2027-03-04T18:00:00Z')
    responses[khl_aggregator.EVENTS_ENDPOINT] = [responses[khl_aggregator.EVENTS_ENDPOINT][0], outside]
    matches = khl_aggregator.sync_khl_data(data_dir, fetcher=fake_fetch, reference_time=reference)
    assert [item['id'] for item in matches] == ['khl:900001']
    assert [item['id'] for item in json.loads((by_date / '2026-10-04.json').read_text())] == ['nhl:1']
    assert [item['id'] for item in json.loads((by_date / '2026-10-05.json').read_text())] == []
    assert [item['id'] for item in json.loads((by_date / '2026-10-07.json').read_text())] == ['khl:900001']
    assert {item['id'] for item in json.loads((by_date / '2026-09-30.json').read_text())} == {'nhl:2', 'khl:900001'}
    assert not (by_date / '2027-03-04.json').exists()


def test_empty_success_clears_window_but_fetch_error_does_not(tmp_path):
    data_dir = tmp_path / 'data'
    responses = _responses()
    data_dir.mkdir()
    (data_dir / 'meta.json').write_text('{}', encoding='utf-8')
    def fake_fetch(url):
        base = url.split('?', 1)[0]
        if base == khl_aggregator.EVENTS_ENDPOINT and parse_qs(urlsplit(url).query)['page'] != ['1']:
            return []
        return responses[base]
    reference = datetime(2026, 10, 4, tzinfo=timezone.utc)
    khl_aggregator.sync_khl_data(data_dir, fetcher=fake_fetch, reference_time=reference)
    date_path = data_dir / 'matches' / 'by-date' / '2026-10-04.json'
    def broken_fetch(url):
        if url.startswith(khl_aggregator.EVENTS_ENDPOINT):
            raise ConnectionError('upstream unavailable')
        return fake_fetch(url)
    with pytest.raises(khl_aggregator.KHLFeedError, match='upstream unavailable'):
        khl_aggregator.sync_khl_data(data_dir, fetcher=broken_fetch, reference_time=reference)
    assert json.loads(date_path.read_text())[0]['id'] == 'khl:900001'
    responses[khl_aggregator.EVENTS_ENDPOINT] = []
    assert khl_aggregator.sync_khl_data(data_dir, fetcher=fake_fetch, reference_time=reference) == []
    assert json.loads(date_path.read_text()) == []


@pytest.mark.parametrize('invalid', ['state', 'score', 'team', 'match_id'])
def test_invalid_fixture_prevents_all_match_writes(tmp_path, invalid):
    responses = _responses()
    event = responses[khl_aggregator.EVENTS_ENDPOINT][0]['event']
    if invalid == 'state':
        event['game_state_key'] = 'mysterious_finished'
    elif invalid == 'score':
        event['score'] = {'home': 1, 'away': None}
    elif invalid == 'team':
        event['team_b'] = {'id': 16}
    else:
        event.pop('match_id')
        event.pop('khl_id')

    def fetch(url):
        base = url.split('?', 1)[0]
        if base == khl_aggregator.EVENTS_ENDPOINT and parse_qs(urlsplit(url).query)['page'] != ['1']:
            return []
        return responses[base]

    with pytest.raises(khl_aggregator.KHLFeedError):
        khl_aggregator.sync_khl_data(
            tmp_path / 'data', fetcher=fetch,
            reference_time=datetime(2026, 10, 4, tzinfo=timezone.utc),
        )
    assert not (tmp_path / 'data' / 'matches').exists()
