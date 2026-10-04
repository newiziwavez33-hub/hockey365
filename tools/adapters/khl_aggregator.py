"""Import KHL fixtures and scores from the public KHL mobile feed.

The feed is useful for schedule/score snapshots only.  It is not a video
rights feed and this adapter deliberately does not publish any of its media
URLs.  A response must pass the structural checks below before any match or
metadata file is changed; a failed check keeps KHL hidden in the static UI.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode, urlsplit


KHL_API_BASE = "https://khl.api.webcaster.pro/api/khl_mobile"
DATA_ENDPOINT = f"{KHL_API_BASE}/data.json"
EVENTS_ENDPOINT = f"{KHL_API_BASE}/events_v2.json"
TEAMS_ENDPOINT = f"{KHL_API_BASE}/teams_v2.json"
MAX_EVENT_PAGES = 20
KHL_PROVIDER = "KHL mobile backend"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Hockey365 data adapter/1.0",
}


class KHLFeedError(ValueError):
    """Raised when the KHL response cannot be safely normalized."""


def fetch_khl_url(url: str, timeout: int = 12) -> Any:
    """Fetch and JSON-decode one KHL endpoint.

    Keeping the HTTP boundary in one function makes the adapter easy to test
    with a mocked fetcher and ensures an HTML/error response is never treated
    as an empty schedule.
    """

    request = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = getattr(response, "status", getattr(response, "code", 200))
            if status < 200 or status >= 300:
                raise KHLFeedError(f"KHL request returned HTTP {status}: {url}")
            body = response.read().decode("utf-8")
    except OSError as exc:
        raise KHLFeedError(f"KHL request failed: {url}: {exc}") from exc

    try:
        return json.loads(body)
    except (TypeError, json.JSONDecodeError) as exc:
        raise KHLFeedError(f"KHL response is not valid JSON: {url}") from exc


def _as_int(value: Any, field: str, *, allow_none: bool = True) -> int | None:
    if value is None and allow_none:
        return None
    if isinstance(value, bool):
        raise KHLFeedError(f"KHL {field} must be an integer")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if not text and allow_none:
            return None
        try:
            return int(text)
        except ValueError as exc:
            raise KHLFeedError(f"KHL {field} must be an integer") from exc
    raise KHLFeedError(f"KHL {field} must be an integer")


def _validate_data_response(payload: Any) -> tuple[int, dict[str, Any]]:
    if not isinstance(payload, dict):
        raise KHLFeedError("KHL data response must be an object")

    stage_id = _as_int(payload.get("current_stage_id"), "current_stage_id", allow_none=False)
    if stage_id is None or stage_id <= 0:
        raise KHLFeedError("KHL data response has no valid current_stage_id")

    stages = payload.get("stages_v2", [])
    if stages is None:
        stages = []
    if not isinstance(stages, list):
        raise KHLFeedError("KHL stages_v2 response must be an array")

    stage = {}
    for candidate in stages:
        if not isinstance(candidate, dict):
            raise KHLFeedError("KHL stages_v2 contains a non-object stage")
        candidate_id = _as_int(candidate.get("id"), "stage.id")
        if candidate_id == stage_id:
            stage = candidate
            break
    if stages and not stage:
        raise KHLFeedError(f"KHL current stage {stage_id} is missing from stages_v2")
    return stage_id, stage


def _extract_events(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        raw_events = payload
    elif isinstance(payload, dict):
        raw_events = payload.get("events")
        if raw_events is None:
            raw_events = payload.get("items")
        if raw_events is None and isinstance(payload.get("event"), dict):
            raw_events = [payload]
    else:
        raw_events = None

    if not isinstance(raw_events, list):
        raise KHLFeedError("KHL events response must contain an array")

    events: list[dict[str, Any]] = []
    for item in raw_events:
        if not isinstance(item, dict):
            raise KHLFeedError("KHL events response contains a non-object event")
        event = item.get("event", item)
        if not isinstance(event, dict):
            raise KHLFeedError("KHL event wrapper does not contain an object")
        events.append(event)
    return events


def _extract_teams(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        raw_teams = payload
    elif isinstance(payload, dict):
        raw_teams = payload.get("teams")
        if raw_teams is None:
            raw_teams = payload.get("team")
        if raw_teams is None:
            raw_teams = payload.get("items")
    else:
        raw_teams = None

    if isinstance(raw_teams, dict):
        raw_teams = [raw_teams]
    if not isinstance(raw_teams, list) or not raw_teams:
        raise KHLFeedError("KHL teams response must contain a non-empty array")

    teams: list[dict[str, Any]] = []
    for item in raw_teams:
        team = item.get("team") if isinstance(item, dict) and isinstance(item.get("team"), dict) else item
        if not isinstance(team, dict):
            raise KHLFeedError("KHL teams response contains a non-object team")
        if team.get("id") is None and team.get("khl_id") is None:
            raise KHLFeedError("KHL team has no id")
        if not isinstance(team.get("name"), str) or not team["name"].strip():
            raise KHLFeedError("KHL team has no name")
        teams.append(team)
    return teams


def _team_index(teams: list[dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    """Index API ids in separate namespaces; ``id=101`` is not ``khl_id=101``."""

    index: dict[str, dict[str, dict[str, Any]]] = {"id": {}, "khl_id": {}}
    for team in teams:
        team_id = team.get("id")
        khl_id = team.get("khl_id")
        for namespace, value in (("id", team_id), ("khl_id", khl_id)):
            if value is None:
                continue
            key = str(value)
            previous = index[namespace].get(key)
            if previous is not None and previous != team:
                raise KHLFeedError(f"KHL teams_v2 has conflicting {namespace} {key}")
            index[namespace][key] = team
    return index


_TEAM_SLUGS = {
    "авангард": "avangard",
    "автомобилист": "avtomobilist",
    "адмирал": "admiral",
    "ак барс": "ak-bars",
    "амур": "amur",
    "барыс": "barys",
    "динамо м": "dynamo-msk",
    "динамо мн": "dynamo-mns",
    "драконы": "dragons",
    "лада": "lada",
    "локомотив": "lokomotiv",
    "металлург мг": "metallurg-mg",
    "нефтехимик": "neftekhimik",
    "салават юлаев": "salavat-yulaev",
    "северсталь": "severstal",
    "сибирь": "sibir",
    "ска": "ska",
    "спартак": "spartak",
    "торпедо": "torpedo",
    "трактор": "traktor",
    "хк сочи": "sochi",
    "сочи": "sochi",
    "витязь": "vityaz",
    "кунлунь рс": "kunlun",
}

_CYRILLIC = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
})


def _team_slug(name: str) -> str:
    normalized = " ".join(name.replace("ё", "е").casefold().split())
    if normalized in _TEAM_SLUGS:
        return _TEAM_SLUGS[normalized]
    ascii_name = normalized.translate(_CYRILLIC)
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")
    if not slug:
        raise KHLFeedError(f"KHL team name cannot produce an id: {name!r}")
    return slug


def _team_details(team: Any, teams: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    if not isinstance(team, dict):
        raise KHLFeedError("KHL event team must be an object")
    team_key = team.get("id")
    if team_key is None:
        team_key = team.get("khl_id")
    if team_key is None:
        raise KHLFeedError("KHL event team has no id")

    candidates: list[dict[str, Any]] = []
    for namespace in ("id", "khl_id"):
        if team.get(namespace) is not None:
            known = teams[namespace].get(str(team[namespace]))
            if known is None:
                raise KHLFeedError(f"KHL event team {namespace} {team[namespace]!r} is missing from teams_v2")
            candidates.append(known)
    if len(candidates) > 1 and candidates[0] != candidates[1]:
        raise KHLFeedError(f"KHL event team ids resolve to different teams: {team!r}")
    known = candidates[0] if candidates else None
    if known is None:
        raise KHLFeedError(f"KHL event team {team_key!r} is missing from teams_v2")
    name = (known or {}).get("name")
    if not isinstance(name, str) or not name.strip():
        raise KHLFeedError(f"KHL event team {team_key!r} has no name")
    details = {"id": f"khl:{_team_slug(name)}", "name": name.strip()}
    short = known.get("short")
    if isinstance(short, str) and short.strip():
        details["short"] = short.strip()
    image = _official_team_image(known.get("image"))
    if image is not None:
        details["logo"] = image
    return details


def _team_id(team: Any, teams: dict[str, dict[str, dict[str, Any]]]) -> str:
    return _team_details(team, teams)["id"]


def _official_team_image(value: Any) -> str | None:
    """Never pass event media or arbitrary upstream URLs into a match snapshot."""
    if not isinstance(value, str) or not value or re.search(r"[\s\\\x00-\x1f\x7f]", value):
        return None
    try:
        url = urlsplit(value)
        if (url.scheme != "https" or url.netloc != "thumbs.webcaster.pro"
                or not url.path.startswith("/") or url.fragment):
            return None
    except ValueError:
        return None
    return value


def _to_datetime(value: Any) -> datetime:
    if isinstance(value, bool) or value is None:
        raise KHLFeedError("KHL event has no valid start time")
    if isinstance(value, (int, float)):
        timestamp = float(value)
        if timestamp > 100_000_000_000:  # API uses milliseconds for start_at.
            timestamp /= 1000
        try:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (OverflowError, OSError, ValueError) as exc:
            raise KHLFeedError("KHL event has an invalid start timestamp") from exc
    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise KHLFeedError("KHL event has no valid start time")
        try:
            if re.fullmatch(r"\d+(?:\.\d+)?", text):
                return _to_datetime(float(text))
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        except (ValueError, OverflowError, OSError) as exc:
            raise KHLFeedError("KHL event has an invalid start time") from exc
    raise KHLFeedError("KHL event has an invalid start time")


def _event_datetime(event: dict[str, Any]) -> datetime:
    # ``event_start_at`` is the video/stream start and is normally ten
    # minutes before the game.  Calendar and score dates belong to start_at.
    for key in ("start_at", "utcDate", "event_start_at", "start_at_day", "startAt"):
        if event.get(key) is not None:
            return _to_datetime(event[key])
    raise KHLFeedError("KHL event has no start timestamp")


def _rolling_window(reference_time: datetime) -> tuple[int, int]:
    reference = reference_time.astimezone(timezone.utc)
    start = datetime(reference.year, reference.month, reference.day, tzinfo=timezone.utc) - timedelta(days=1)
    end = start + timedelta(days=9)
    return int(start.timestamp()), int(end.timestamp())


def _events_page_url(stage_id: int, start_time: int, end_time: int, page: int) -> str:
    query = urlencode([
        ("stage_id", stage_id),
        ("q[start_at_gt_time_from_unixtime]", start_time),
        ("q[start_at_lt_time_from_unixtime]", end_time),
        ("order_direction", "asc"),
        ("page", page),
    ])
    return f"{EVENTS_ENDPOINT}?{query}"


def _fetch_event_pages(
    fetch: Callable[[str], Any],
    *,
    stage_id: int,
    start_time: int,
    end_time: int,
    max_pages: int,
) -> list[dict[str, Any]]:
    if max_pages < 1:
        raise KHLFeedError("KHL event page limit must be positive")
    events: list[dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        payload = fetch(_events_page_url(stage_id, start_time, end_time, page))
        page_events = _extract_events(payload)
        if not page_events:
            return events
        events.extend(page_events)
    raise KHLFeedError(f"KHL events pagination exceeded {max_pages} pages without an empty page")


def _status(event: dict[str, Any]) -> str:
    raw = next((event[key] for key in ("game_state_key", "game_state", "status")
                if key in event and event[key] is not None), None)
    if not isinstance(raw, str):
        raise KHLFeedError(f"KHL event has unknown game state: {raw!r}")
    value = raw.strip().casefold()
    aliases = {
        "LIVE": {"live", "in_progress", "in-progress", "playing", "started", "ongoing"},
        "INTERMISSION": {"intermission", "break", "pause"},
        "FINISHED": {"finished", "ended", "complete", "completed", "final", "off", "закончен", "завершен"},
        "POSTPONED": {"postponed", "перенесен", "перенесён"},
        "CANCELLED": {"cancelled", "canceled", "отменен", "отменён"},
        "SCHEDULED": {"not_yet_started", "not-started", "not started", "future", "planned"},
    }
    for status, known_values in aliases.items():
        if value in known_values:
            return status
    raise KHLFeedError(f"KHL event has unknown game state: {raw!r}")


def _score(value: Any) -> tuple[int | None, int | None]:
    if value is None:
        return None, None
    if isinstance(value, dict):
        home = value.get("home", value.get("team_a", value.get("a")))
        away = value.get("away", value.get("team_b", value.get("b")))
        parsed = _as_int(home, "score.home"), _as_int(away, "score.away")
        if any(score is not None and score < 0 for score in parsed):
            raise KHLFeedError("KHL event score cannot be negative")
        return parsed
    if isinstance(value, str):
        match = re.fullmatch(r"\s*(\d+)\s*[:\-]\s*(\d+)\s*", value)
        if not match:
            raise KHLFeedError(f"KHL event has invalid score: {value!r}")
        return int(match.group(1)), int(match.group(2))
    raise KHLFeedError("KHL event score must be a string or object")


def _season(stage: dict[str, Any], event: dict[str, Any]) -> str:
    raw = stage.get("season") or event.get("season")
    if not raw:
        stage_name = str(stage.get("title") or event.get("stage_name") or "")
        found = re.search(r"(\d{4}/\d{4})", stage_name)
        raw = found.group(1) if found else None
    if not isinstance(raw, str) or not raw.strip():
        raise KHLFeedError("KHL current stage has no season")
    season = raw.strip()
    long_season = re.fullmatch(r"(\d{4})/(\d{4})", season)
    if long_season:
        return f"{long_season.group(1)}/{long_season.group(2)[-2:]}"
    return season


def _stage_type(stage: dict[str, Any], event: dict[str, Any]) -> str:
    stage_type = stage.get("type") or event.get("stage_type")
    if stage_type in {"regular", "playoff", "preseason"}:
        return stage_type
    title = str(stage.get("title") or event.get("stage_name") or "").casefold()
    return "playoff" if "плей" in title or "play-off" in title or "playoff" in title else "regular"


def _periods(event: dict[str, Any], side: int) -> list[int | None]:
    scores = event.get("scores")
    if not isinstance(scores, dict):
        return []
    values: list[int | None] = []
    for name in ("first_period", "second_period", "third_period", "overtime"):
        value = scores.get(name)
        if value is None:
            parsed = (None, None)
        else:
            parsed = _score(value)
        values.append(parsed[side])
    while values and values[-1] is None:
        values.pop()
    return values


def _finished_in(event: dict[str, Any], status: str, period: int | None) -> str | None:
    if status != "FINISHED":
        return None
    explicit = str(event.get("finished_in") or event.get("finish_type") or "").casefold()
    if any(token in explicit for token in ("shoot", "bull", "so", "буллит")):
        return "SO"
    if any(token in explicit for token in ("overtime", "ot", "овертайм")):
        return "OT"
    scores = event.get("scores")
    if scores is None:
        scores = {}
    if not isinstance(scores, dict):
        raise KHLFeedError("KHL event scores must be an object")
    if scores.get("bullitt") is not None or "буллит" in str(event.get("game_state_key", "")).casefold():
        return "SO"
    if scores.get("overtime") is not None or (period is not None and period > 3):
        return "OT"
    return "REG"


def normalize_event(
    event: dict[str, Any],
    *,
    stage_id: int,
    stage: dict[str, Any],
    teams: dict[str, dict[str, dict[str, Any]]],
    fetched_at: str,
) -> dict[str, Any]:
    """Normalize one current-stage API event into the site's match schema."""

    # event.id identifies the video/event record, NOT the game.
    match_id = event.get("match_id")
    khl_id = event.get("khl_id")
    if match_id is None and khl_id is None:
        raise KHLFeedError("KHL event has no match_id or confirmed khl_id")
    def numeric_id(value: Any) -> str:
        if isinstance(value, bool) or not (
            isinstance(value, int) or isinstance(value, str) and re.fullmatch(r"[0-9]+", value)
        ) or int(value) <= 0:
            raise KHLFeedError(f"KHL event has invalid numeric match id: {value!r}")
        return str(int(value))
    match_key = numeric_id(match_id if match_id is not None else khl_id)
    if khl_id is not None and numeric_id(khl_id) != match_key:
        raise KHLFeedError("KHL event match_id and khl_id disagree")
    start = _event_datetime(event)
    status = _status(event)
    period_value = _as_int(event.get("period"), "period")
    # The feed uses -1 as a finished-game sentinel, not a real hockey period.
    period = period_value if period_value is not None and period_value > 0 else None
    home_score, away_score = _score(event.get("score"))
    if status in {"LIVE", "INTERMISSION", "FINISHED"} and (
        home_score is None or away_score is None or home_score < 0 or away_score < 0
    ):
        raise KHLFeedError("KHL started/finished event needs nonnegative home and away scores")
    if status in {"SCHEDULED", "POSTPONED", "CANCELLED"}:
        # The feed uses a placeholder "0:0" for not-yet-started games.
        home_score, away_score = None, None
    season = _season(stage, event)
    finished_in = _finished_in(event, status, period)
    # Shootout attempts are not period goals. Keeping them in ``periods``
    # would make the site's period-sum validator compare attempts with the
    # final score, so leave the period breakdown absent rather than inventing
    # a post-shootout goal allocation.
    home_periods = [] if finished_in == "SO" else _periods(event, 0)
    away_periods = [] if finished_in == "SO" else _periods(event, 1)
    home = _team_details(event.get("team_a"), teams)
    away = _team_details(event.get("team_b"), teams)
    if home["id"] == away["id"]:
        raise KHLFeedError("KHL event has the same home and away team")
    source = {
        "provider": KHL_PROVIDER,
        "official": True,
        "verified": True,
        "verifiedMatches": True,
        "licenseConfirmed": False,
        "endpoint": EVENTS_ENDPOINT,
        "endpoints": [DATA_ENDPOINT, EVENTS_ENDPOINT, TEAMS_ENDPOINT],
        "stageId": stage_id,
        "eventId": event.get("id"),
        "matchId": str(match_key),
        "fetchedAt": fetched_at,
    }
    clock = event.get("clock")
    if isinstance(clock, dict):
        clock = clock.get("time_remaining") or clock.get("time")
    if not isinstance(clock, str):
        clock = None

    return {
        "id": f"khl:{match_key}",
        "compId": "KHL",
        "season": season,
        "stage": _stage_type(stage, event),
        "round": event.get("round"),
        "seriesGame": _as_int(event.get("series_game"), "series_game"),
        "utcDate": start.isoformat().replace("+00:00", "Z"),
        "status": status,
        "period": period,
        "clock": clock,
        "finishedIn": finished_in,
        "home": {
            **home,
            "score": home_score,
            "periods": home_periods,
            "shots": None,
        },
        "away": {
            **away,
            "score": away_score,
            "periods": away_periods,
            "shots": None,
        },
        "arena": event.get("arena") if isinstance(event.get("arena"), str) else None,
        "officials": {"referees": [], "linesmen": []},
        "events": [],
        "lineups": None,
        "stats": None,
        "h2h": [],
        "source": source,
    }


def normalize_schedule(
    events_payload: Any,
    *,
    stage_id: int,
    stage: dict[str, Any],
    teams: dict[str, dict[str, dict[str, Any]]],
    fetched_at: str,
    window_start: int | None = None,
    window_end: int | None = None,
) -> list[dict[str, Any]]:
    """Filter the current stage and normalize its match events."""

    normalized: dict[str, dict[str, Any]] = {}
    priorities: dict[str, int] = {}
    for event in _extract_events(events_payload):
        if event.get("stage_id") is None:
            raise KHLFeedError("KHL event has no stage_id")
        event_stage_id = _as_int(event.get("stage_id"), "event.stage_id")
        if event_stage_id != stage_id:
            continue
        # events_v2 also contains highlights and condensed-game records. They
        # carry placeholder 0:0 scores and must not replace the schedule or
        # the authoritative archive record for the same match.
        type_id = _as_int(event.get("type_id"), "event.type_id")
        if type_id not in {18, 24}:
            continue
        start_time = _event_datetime(event).timestamp()
        if ((window_start is not None and start_time < window_start)
                or (window_end is not None and start_time >= window_end)):
            continue
        match = normalize_event(
            event,
            stage_id=stage_id,
            stage=stage,
            teams=teams,
            fetched_at=fetched_at,
        )
        previous = normalized.get(match["id"])
        previous_priority = priorities.get(match["id"], -1)
        current_priority = 2 if type_id == 18 else 1
        if previous is None or current_priority > previous_priority or (current_priority == previous_priority and previous["status"] == "SCHEDULED"):
            normalized[match["id"]] = match
            priorities[match["id"]] = current_priority
    return sorted(normalized.values(), key=lambda match: (match["utcDate"], match["id"]))


def _match_schema() -> dict[str, Any]:
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "match.schema.json"
    try:
        with schema_path.open(encoding="utf-8") as handle:
            schema = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise KHLFeedError(f"Cannot load match schema: {schema_path}") from exc
    if not isinstance(schema, dict):
        raise KHLFeedError("Match schema must be an object")
    return schema


def _validate_matches(matches: list[dict[str, Any]]) -> None:
    try:
        import jsonschema
    except ImportError as exc:
        raise KHLFeedError("jsonschema is required before publishing KHL matches") from exc
    schema = _match_schema()
    for match in matches:
        try:
            jsonschema.validate(instance=match, schema=schema)
        except jsonschema.ValidationError as exc:
            raise KHLFeedError(f"KHL match {match.get('id')} failed match schema: {exc.message}") from exc


def _is_khl_match(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    match_id = str(value.get("id") or "").casefold()
    comp_id = str(value.get("compId") or "").casefold()
    return match_id.startswith("khl:") or comp_id == "khl"


def _is_verified_khl_match(value: Any) -> bool:
    if not _is_khl_match(value):
        return False
    source = value.get("source")
    return (
        isinstance(source, dict)
        and source.get("provider") == KHL_PROVIDER
        and source.get("verified") is True
        and source.get("verifiedMatches") is True
    )


def _sanitize_date_feeds(by_date_dir: Path) -> None:
    """Drop old KHL records from every date feed, retaining only new tagged ones."""

    if not by_date_dir.is_dir():
        return
    for date_path in sorted(by_date_dir.glob("*.json")):
        try:
            with date_path.open(encoding="utf-8") as handle:
                feed = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            raise KHLFeedError(f"Cannot read KHL date feed: {date_path.name}") from exc
        if not isinstance(feed, list):
            raise KHLFeedError(f"KHL date feed is not an array: {date_path.name}")
        filtered = [item for item in feed if not _is_khl_match(item) or _is_verified_khl_match(item)]
        if filtered != feed:
            _atomic_write_json(date_path, filtered)


def _team_profile(team: dict[str, Any], fetched_at: str) -> tuple[str, dict[str, Any]] | None:
    """Build a profile only when all required display fields are source-provided."""

    name = team.get("name")
    short = team.get("short")
    country = team.get("country")
    city = team.get("city") or team.get("location")
    image = _official_team_image(team.get("image"))
    if not all(isinstance(value, str) and value.strip() for value in (name, short, country, city, image)):
        return None
    team_id = f"khl:{_team_slug(name)}"
    return team_id, {
        "id": team_id,
        "slug": team_id.removeprefix("khl:"),
        "name": name,
        "short": short,
        "country": country,
        "city": city,
        "conference": team.get("conference"),
        "division": team.get("division"),
        "logo": image,
        "coach": None,
        "roster": [],
        "competitions": ["KHL"],
        "source": {
            "provider": KHL_PROVIDER,
            "official": True,
            "verified": True,
            "verifiedTeam": True,
            "endpoint": TEAMS_ENDPOINT,
            "teamId": team.get("id"),
            "khlId": team.get("khl_id"),
            "image": image,
            "fetchedAt": fetched_at,
        },
    }


def _publish_new_team_profiles(root: Path, source_teams: list[dict[str, Any]], fetched_at: str) -> None:
    teams_dir = root / "teams"
    for source_team in source_teams:
        profile = _team_profile(source_team, fetched_at)
        if profile is None:
            continue
        team_id, value = profile
        path = teams_dir / f"{team_id}.json"
        # Never overwrite a legacy dossier.  New profiles contain no roster or
        # statistics unless those fields were explicitly supplied above.
        if path.exists():
            continue
        _atomic_write_json(path, value)


def _atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
    )
    temporary = Path(handle.name)
    try:
        with handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _set_khl_verification(
    meta_path: Path,
    *,
    verified: bool,
    verified_matches: bool,
    checked_at: str,
    error: str | None = None,
) -> None:
    if not meta_path.is_file():
        return
    with meta_path.open(encoding="utf-8") as handle:
        meta = json.load(handle)
    if not isinstance(meta, dict):
        raise KHLFeedError("data/meta.json must contain an object")

    unverified = meta.get("unverifiedCompetitions", [])
    if not isinstance(unverified, list):
        unverified = []
    # This global block protects old standings, players and team dossiers.
    # Match feed verification is intentionally tracked separately below.
    if "KHL" not in unverified:
        unverified.append("KHL")
    meta["unverifiedCompetitions"] = unverified
    source_status = meta.get("sourceStatus")
    if not isinstance(source_status, dict):
        source_status = {}
    status: dict[str, Any] = {
        "provider": KHL_PROVIDER,
        "verified": verified,
        "verifiedMatches": verified_matches,
        "official": True,
        "licenseConfirmed": False,
        "checkedAt": checked_at,
        "endpoints": [DATA_ENDPOINT, EVENTS_ENDPOINT, TEAMS_ENDPOINT],
    }
    if error:
        status["error"] = error[:300]
    source_status["KHL"] = status
    meta["sourceStatus"] = source_status
    _atomic_write_json(meta_path, meta)


def _merge_date_feed(date_path: Path, matches: list[dict[str, Any]], *, refresh_khl: bool = False) -> None:
    existing: list[dict[str, Any]] = []
    if date_path.is_file():
        with date_path.open(encoding="utf-8") as handle:
            existing_value = json.load(handle)
        if not isinstance(existing_value, list):
            raise KHLFeedError(f"KHL date feed is not an array: {date_path.name}")
        existing = [item for item in existing_value if isinstance(item, dict) and isinstance(item.get("id"), str)]
    merged = {
        item["id"]: item
        for item in existing
        if not _is_khl_match(item) or (not refresh_khl and _is_verified_khl_match(item))
    }
    merged.update({match["id"]: match for match in matches})
    result = sorted(merged.values(), key=lambda match: (str(match.get("utcDate", "")), match["id"]))
    _atomic_write_json(date_path, result)


def sync_khl_data(
    output_data_dir: str | os.PathLike[str],
    fetcher: Callable[[str], Any] | None = None,
    *,
    reference_time: datetime | None = None,
    max_event_pages: int = MAX_EVENT_PAGES,
) -> list[dict[str, Any]]:
    """Fetch, validate and publish the current KHL schedule snapshot.

    No match output is written until all public responses and the full match
    schema validate. ``reference_time`` exists for deterministic backfills and
    tests; production runs use the current UTC time.
    """

    fetch = fetcher or fetch_khl_url
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)
    elif reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)
    else:
        reference_time = reference_time.astimezone(timezone.utc)
    checked_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    window_start, window_end = _rolling_window(reference_time)
    root = Path(output_data_dir)
    meta_path = root / "meta.json"
    try:
        data_payload = fetch(DATA_ENDPOINT)
        stage_id, stage = _validate_data_response(data_payload)
        events_payload = _fetch_event_pages(
            fetch,
            stage_id=stage_id,
            start_time=window_start,
            end_time=window_end,
            max_pages=max_event_pages,
        )
        teams_payload = fetch(TEAMS_ENDPOINT)
        source_teams = _extract_teams(teams_payload)
        teams = _team_index(source_teams)
        matches = normalize_schedule(
            events_payload,
            stage_id=stage_id,
            stage=stage,
            teams=teams,
            fetched_at=checked_at,
            window_start=window_start,
            window_end=window_end,
        )
        _validate_matches(matches)

        matches_dir = root / "matches"
        by_date_dir = matches_dir / "by-date"
        _sanitize_date_feeds(by_date_dir)
        for match in matches:
            _atomic_write_json(matches_dir / f"{match['id']}.json", match)
        by_date: dict[str, list[dict[str, Any]]] = {}
        for match in matches:
            by_date.setdefault(match["utcDate"][:10], []).append(match)
        window_dates = {
            (datetime.fromtimestamp(window_start, tz=timezone.utc) + timedelta(days=offset)).date().isoformat()
            for offset in range((window_end - window_start) // 86400)
        }
        existing_dates = {path.stem for path in by_date_dir.glob("*.json")} if by_date_dir.is_dir() else set()
        for date in sorted((existing_dates & window_dates) | by_date.keys()):
            _merge_date_feed(by_date_dir / f"{date}.json", by_date.get(date, []), refresh_khl=True)

        _publish_new_team_profiles(root, source_teams, checked_at)
        _set_khl_verification(
            meta_path,
            verified=True,
            verified_matches=True,
            checked_at=checked_at,
        )
        return matches
    except Exception as exc:
        # Legacy KHL records must not remain in date feeds even when the new
        # feed is down. Do not mask the original error if cleanup/metadata
        # handling itself fails.
        try:
            _sanitize_date_feeds(root / "matches" / "by-date")
        except Exception:
            pass
        try:
            _set_khl_verification(
                meta_path,
                verified=False,
                verified_matches=False,
                checked_at=checked_at,
                error=str(exc),
            )
        except Exception:
            pass
        if isinstance(exc, KHLFeedError):
            raise
        raise KHLFeedError(str(exc)) from exc


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parents[2]
    try:
        synced = sync_khl_data(base_dir / "data")
        print(f"KHL schedule synced successfully: {len(synced)} matches")
    except Exception as exc:
        print(f"KHL update failed; KHL remains hidden: {exc}", file=sys.stderr)
        sys.exit(1)
