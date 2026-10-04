import copy
import json
import os

import jsonschema
import pytest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def match_schema():
    with open(os.path.join(ROOT, "schemas", "match.schema.json"), encoding="utf-8") as handle:
        return json.load(handle)


def minimal_match():
    return {
        "id": "KHL:2026-27:example",
        "compId": "KHL",
        "season": "2026/27",
        "utcDate": "2026-10-04T16:00:00Z",
        "status": "SCHEDULED",
        "home": {"id": "KHL:home"},
        "away": {"id": "KHL:away"},
    }


def broadcast(kind="embed"):
    return {
        "type": kind,
        "verified": True,
        "provider": "YouTube" if kind == "embed" else "Official TV",
        "url": (
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
            if kind == "embed" else "https://watch.example.org/matches/example"
        ),
        "sourceName": "Rights holder",
        "sourceUrl": "https://www.example.org/schedule/example",
        "verifiedAt": "2026-10-04T12:00:00Z",
    }


def test_broadcast_is_optional_and_verified_forms_validate(match_schema):
    match = minimal_match()
    jsonschema.validate(match, match_schema)
    match["broadcast"] = None
    jsonschema.validate(match, match_schema)
    match["broadcast"] = broadcast("embed")
    jsonschema.validate(match, match_schema)
    match["broadcast"] = broadcast("external")
    jsonschema.validate(match, match_schema)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value.update(url="http://watch.example.org/live"),
        lambda value: value.update(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        lambda value: value.update(url="https://www.youtube-nocookie.com/embed/<script>"),
        lambda value: value.update(verified=False),
        lambda value: value.update(sourceUrl="javascript:alert(1)"),
    ],
)
def test_broadcast_rejects_untrusted_or_unverified_urls(match_schema, mutate):
    match = minimal_match()
    value = broadcast("embed")
    mutate(value)
    match["broadcast"] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(match, match_schema)


def test_broadcast_does_not_allow_extra_unreviewed_fields(match_schema):
    match = minimal_match()
    value = copy.deepcopy(broadcast("external"))
    value["autoplay"] = True
    match["broadcast"] = value
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(match, match_schema)
