"""
Tests for Hockey365 Live News Adapter (tools/adapters/fetch_news.py)
"""

import json
from pathlib import Path
import jsonschema
import pytest

from tools.adapters import fetch_news

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Чемпионат.com</title>
    <link>https://www.championat.com</link>
    <item>
      <guid>https://www.championat.com/hockey/news-6644534-v-arbitra-matcha-avtomobilist-amur-popala-shajba.html</guid>
      <title>В арбитра матча «Автомобилист» — «Амур» попала шайба</title>
      <link>https://www.championat.com/hockey/news-6644534-v-arbitra-matcha-avtomobilist-amur-popala-shajba.html</link>
      <pubDate>Sun, 04 Oct 2026 15:25:17 +0300</pubDate>
      <description>В матче регулярного чемпионата КХЛ между «Автомобилистом» и «Амуром» шайба попала в судью.</description>
      <category>Хоккей</category>
      <category domain="sections">КХЛ</category>
      <category domain="tags">ХК Автомобилист</category>
      <category domain="tags">ХК Амур</category>
      <category domain="content_type">news</category>
      <category domain="content_importance">breaking</category>
    </item>
    <item>
      <guid>https://www.championat.com/hockey/news-6644400-ovechkin-zabrosil-shajbu-v-vorota-rangers.html</guid>
      <title>Овечкин забросил победную шайбу в ворота «Рейнджерс»</title>
      <link>https://www.championat.com/hockey/news-6644400-ovechkin-zabrosil-shajbu-v-vorota-rangers.html</link>
      <pubDate>Sun, 04 Oct 2026 14:00:00 +0000</pubDate>
      <description>Капитан «Вашингтон Кэпиталз» Александр Овечкин поразил ворота «Нью-Йорк Рейнджерс» в овертайме.</description>
      <category>Хоккей</category>
      <category domain="sections">НХЛ</category>
      <category domain="tags">Вашингтон Кэпиталз</category>
      <category domain="tags">Нью-Йорк Рейнджерс</category>
      <category domain="tags">Александр Овечкин</category>
      <enclosure url="https://img.championat.com/news/big/ovechkin.jpg" type="image/jpeg" />
    </item>
  </channel>
</rss>
"""

def test_parse_and_normalize_news_valid_schema():
    root = Path(__file__).resolve().parents[1]
    schema = json.loads((root / 'schemas' / 'news.schema.json').read_text())

    data = fetch_news.parse_and_normalize_news(SAMPLE_RSS)
    jsonschema.validate(instance=data, schema=schema)

    assert len(data['news']) == 2
    item1 = data['news'][0]
    assert item1['id'] == 'news-6644534'
    assert item1['slug'] == 'v-arbitra-matcha-avtomobilist-amur-popala-shajba'
    assert 'Автомобилист' in item1['title']
    assert item1['publishedAt'] == '2026-10-04T12:25:17Z'
    assert 'khl:avtomobilist' in item1['relatedTeamIds']
    assert 'khl:amur' in item1['relatedTeamIds']
    assert 'КХЛ' in item1['tags']
    assert item1['source'] == 'Чемпионат • Хоккей'

    item2 = data['news'][1]
    assert item2['id'] == 'news-6644400'
    assert item2['image'] == 'https://img.championat.com/news/big/ovechkin.jpg'
    assert 'nhl:wsh' in item2['relatedTeamIds']
    assert 'nhl:nyr' in item2['relatedTeamIds']
    assert 'nhl:p_8471214' in item2['relatedPlayerIds']
    assert 'НХЛ' in item2['tags']


def test_slug_transliteration():
    title = 'СКА победил «Локомотив» в овертайме!'
    slug = fetch_news.transliterate_to_slug(title)
    assert 'ska-pobedil-lokomotiv-v-overtayme' in slug


def test_sync_news_offline_fallback(tmp_path, monkeypatch):
    data_dir = tmp_path / 'data'
    news_dir = data_dir / 'news'
    news_dir.mkdir(parents=True)
    existing_file = news_dir / 'index.json'
    existing_content = {'news': [{'id': 'cached-1', 'slug': 's', 'title': 'T', 'summary': 'S', 'publishedAt': '2026-10-04T00:00:00Z'}]}
    existing_file.write_text(json.dumps(existing_content))

    def fail_fetch(*args, **kwargs):
        raise OSError('Network offline')

    monkeypatch.setattr(fetch_news, 'fetch_news_rss', fail_fetch)

    result = fetch_news.sync_news(str(data_dir))
    assert result == existing_content
