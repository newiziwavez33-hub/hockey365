"""
Hockey365 Live News Adapter
Fetches real-time hockey news from championat.com RSS feed,
normalizes and enriches articles, matches related teams/players,
and validates against schemas/news.schema.json.
"""

import os
import sys
import json
import re
import html
import urllib.request
import email.utils
from datetime import timezone
import jsonschema

RSS_FEED_URL = "https://www.championat.com/rss/news/hockey/"
USER_AGENT = "Hockey365/1.4 (+https://github.com/newiziwavez33-hub/hockey365; Mozilla/5.0)"

RU_TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def transliterate_to_slug(text):
    text = text.lower()
    res = []
    for ch in text:
        if ch in RU_TRANSLIT:
            res.append(RU_TRANSLIT[ch])
        elif ch.isalnum():
            res.append(ch)
        elif ch in (' ', '-', '_', '—', '–'):
            res.append('-')
    slug = ''.join(res)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug[:80] if slug else 'hockey-news'

# Team matching rules
TEAM_KEYWORD_MAP = {
    # KHL
    'khl:admiral': ['адмирал', 'владивосток'],
    'khl:ak-bars': ['ак барс', 'казан'],
    'khl:amur': ['амур', 'хабаровск'],
    'khl:avangard': ['авангард', 'омск', 'ястреб'],
    'khl:avtomobilist': ['автомобилист', 'екатеринбург'],
    'khl:barys': ['барыс', 'астана'],
    'khl:cska': ['цска'],
    'khl:dynamo-mns': ['динамо минск', 'минское динамо', 'динамо мн'],
    'khl:dynamo-msk': ['динамо москва', 'московское динамо', 'динамо м', 'динамовц'],
    'khl:kunlun': ['куньлунь', 'ред стар'],
    'khl:lada': ['лада', 'тольятти'],
    'khl:lokomotiv': ['локомотив', 'ярославл'],
    'khl:metallurg-mg': ['металлург мг', 'магнитогорск', 'магнитка', 'металлург'],
    'khl:neftekhimik': ['нефтехимик', 'нижнекамск'],
    'khl:salavat-yulaev': ['салават юлаев', 'салават', 'уфа'],
    'khl:severstal': ['северсталь', 'череповец'],
    'khl:sibir': ['сибирь', 'новосибирск'],
    'khl:ska': ['ска', 'армейцы невы', 'питерский ска', 'санкт-петербург'],
    'khl:sochi': ['хк сочи', 'сочи'],
    'khl:spartak': ['спартак', 'красно-бел'],
    'khl:torpedo': ['торпедо', 'нижний новгород'],
    'khl:traktor': ['трактор', 'челябинск'],
    'khl:vityaz': ['витязь', 'балаших'],
    # NHL
    'nhl:ana': ['анахайм', 'дакс'],
    'nhl:bos': ['бостон', 'брюинз'],
    'nhl:buf': ['баффало', 'сейбрз'],
    'nhl:car': ['каролина', 'харрикейнз'],
    'nhl:cbj': ['коламбус', 'блю джекетс'],
    'nhl:cgy': ['калгари', 'флэймз'],
    'nhl:chi': ['чикаго', 'блэкхокс', 'бедард'],
    'nhl:col': ['колорадо', 'эвеланш', 'макиннон'],
    'nhl:dal': ['даллас', 'старз'],
    'nhl:det': ['детройт', 'ред уингз'],
    'nhl:edm': ['эдмонтон', 'ойлерз', 'макдэвид', 'драйзайтль'],
    'nhl:fla': ['флорида', 'пантерз', 'бобровский', 'барков'],
    'nhl:lak': ['лос-анджелес', 'кингз'],
    'nhl:min': ['миннесота', 'уайлд', 'капризов'],
    'nhl:mtl': ['монреаль', 'канадиенс'],
    'nhl:njd': ['нью-джерси', 'девилз'],
    'nhl:nsh': ['нэшвилл', 'предаторз'],
    'nhl:nyi': ['нью-йорк айлендерс', 'айлендерс'],
    'nhl:nyr': ['нью-йорк рейнджерс', 'рейнджерс', 'шестеркин', 'панарин'],
    'nhl:ott': ['оттава', 'сенаторз'],
    'nhl:phi': ['филадельфия', 'флайерз', 'мичков'],
    'nhl:pit': ['питтсбург', 'пингвинз', 'кросби', 'малкин'],
    'nhl:sea': ['сиэтл', 'кракен'],
    'nhl:sjs': ['сан-хосе', 'шаркс'],
    'nhl:stl': ['сент-луис', 'блюз'],
    'nhl:tbl': ['тампа-бэй', 'тампа', 'лайтнинг', 'кучеров', 'василевский'],
    'nhl:tor': ['торонто', 'мейпл лифс', 'мэйпл лифс', 'мэттьюс'],
    'nhl:uta': ['юта'],
    'nhl:van': ['ванкувер', 'кэнакс'],
    'nhl:vgk': ['вегас', 'голден найтс'],
    'nhl:wpg': ['виннипег', 'джетс', 'хеллебайк'],
    'nhl:wsh': ['вашингтон', 'кэпиталз', 'овечкин'],
}

PLAYER_KEYWORD_MAP = {
    'khl:p_goldobin': ['голдобин', 'goldobin'],
    'khl:p_gusev': ['гусев', 'gusev'],
    'khl:p_isaev': ['даниил исаев', 'исаев'],
    'khl:p_nikishin': ['никишин', 'nikishin'],
    'khl:p_radulov': ['радулов', 'radulov'],
    'nhl:p_8471214': ['овечкин', 'ovechkin'],
    'nhl:p_8476453': ['кучеров', 'kucherov'],
    'nhl:p_8477492': ['макиннон', 'mackinnon'],
    'nhl:p_8478048': ['шестеркин', 'shesterkin'],
    'nhl:p_8478402': ['макдэвид', 'mcdavid'],
    'nhl:p_8478550': ['панарин', 'panarin'],
    'nhl:p_8479318': ['мэттьюс', 'мэттьюc', 'matthews'],
    'nhl:p_8480069': ['макар', 'makar'],
}

def match_entities(text, keyword_map):
    matched = []
    text_lower = text.lower()
    for entity_id, keywords in keyword_map.items():
        for kw in keywords:
            pattern = r'(?<![а-яёa-z0-9])' + re.escape(kw) + r'(?![а-яёa-z0-9])'
            if re.search(pattern, text_lower):
                matched.append(entity_id)
                break
    return matched

def pick_relevant_image(enclosure_url, related_teams, tags, title):
    if enclosure_url and enclosure_url.startswith(('http://', 'https://')):
        return enclosure_url

    title_lower = title.lower()
    if 'трансфер' in title_lower or 'Трансферы' in tags:
        return 'assets/images/news_transfers.jpg'
    if any(t in related_teams for t in ('khl:ska', 'khl:lokomotiv', 'khl:cska', 'khl:dynamo-msk', 'khl:severstal')):
        return 'assets/images/news_ska_lokomotiv.jpg'
    if any(t in related_teams for t in ('khl:spartak', 'khl:traktor', 'khl:avtomobilist', 'khl:amur', 'khl:avangard', 'khl:ak-bars', 'khl:salavat-yulaev', 'khl:metallurg-mg', 'khl:sibir', 'khl:barys', 'khl:torpedo', 'khl:neftekhimik', 'khl:lada', 'khl:admiral', 'khl:sochi', 'khl:vityaz', 'khl:kunlun')):
        return 'assets/images/news_spartak_traktor.jpg'
    if any(t.startswith('nhl:') for t in related_teams) or 'НХЛ' in tags:
        return 'assets/images/news_nhl_season.jpg'
    if any(t.startswith('khl:') for t in related_teams) or 'КХЛ' in tags:
        return 'assets/images/news_spartak_traktor.jpg'

    return 'assets/images/hero_banner.jpg'

def clean_html_text(raw_text):
    if not raw_text:
        return ''
    text = html.unescape(raw_text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def fetch_news_rss(url=RSS_FEED_URL, timeout=12):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()

def parse_and_normalize_news(xml_content):
    import xml.etree.ElementTree as ET
    root = ET.fromstring(xml_content)
    channel = root.find('channel')
    if channel is None:
        raise ValueError("Invalid RSS feed: channel element not found")

    items = channel.findall('item')
    normalized_articles = []

    for item in items:
        link = clean_html_text(item.findtext('link') or item.findtext('guid') or '')
        title = clean_html_text(item.findtext('title') or '')
        desc = clean_html_text(item.findtext('description') or '')
        pub_date_str = item.findtext('pubDate') or ''

        if not title or not link:
            continue

        # Extract publication timestamp to ISO-8601 UTC
        try:
            dt = email.utils.parsedate_to_datetime(pub_date_str)
            iso_published_at = dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        except Exception:
            from datetime import datetime
            iso_published_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        # Extract id and slug
        m = re.search(r'/news-(\d+)-(.*?)\.html', link)
        if m:
            art_id = f"news-{m.group(1)}"
            slug = m.group(2)
        else:
            slug = transliterate_to_slug(title)
            art_id = f"news-{slug[:40]}"

        # Parse categories and build tags
        raw_categories = [c.text for c in item.findall('category') if c.text]
        clean_tags = []
        ignore_cats = {'news', 'breaking', 'exclusive', 'content_type', 'sections', 'tags', 'brief'}
        
        for c in raw_categories:
            c_clean = c.strip()
            if c_clean.lower() in ignore_cats:
                continue
            if c_clean.startswith('ХК ') or c_clean.startswith('ФК '):
                c_clean = c_clean[3:].strip()
            if c_clean and c_clean not in clean_tags:
                clean_tags.append(c_clean)

        if not clean_tags:
            clean_tags = ['Хоккей']
        if 'КХЛ' not in clean_tags and 'НХЛ' not in clean_tags:
            if 'кхл' in (title + ' ' + desc).lower():
                clean_tags.insert(0, 'КХЛ')
            elif 'нхл' in (title + ' ' + desc).lower():
                clean_tags.insert(0, 'НХЛ')

        # Match teams and players
        search_blob = f"{title} {desc} {' '.join(raw_categories)}"
        related_teams = match_entities(search_blob, TEAM_KEYWORD_MAP)
        related_players = match_entities(search_blob, PLAYER_KEYWORD_MAP)

        # Image enclosure
        enc = item.find('enclosure')
        enc_url = enc.attrib.get('url') if enc is not None else None
        image_path = pick_relevant_image(enc_url, related_teams, clean_tags, title)

        # Short summary
        summary = desc
        if len(summary) > 220:
            first_sentence = re.split(r'(?<=[.!?])\s+', desc)[0]
            summary = first_sentence if len(first_sentence) <= 220 else (desc[:217] + '...')

        article = {
            "id": art_id,
            "slug": slug,
            "title": title,
            "summary": summary,
            "content": desc or title,
            "image": image_path,
            "publishedAt": iso_published_at,
            "source": "Чемпионат • Хоккей",
            "url": link,
            "tags": clean_tags,
            "relatedTeamIds": sorted(list(set(related_teams))),
            "relatedPlayerIds": sorted(list(set(related_players)))
        }
        normalized_articles.append(article)

    return {"news": normalized_articles}

def sync_news(output_data_dir):
    news_dir = os.path.join(output_data_dir, 'news')
    os.makedirs(news_dir, exist_ok=True)
    out_file = os.path.join(news_dir, 'index.json')

    root_dir = os.path.abspath(os.path.join(output_data_dir, '..'))
    schema_path = os.path.join(root_dir, 'schemas', 'news.schema.json')
    if not os.path.exists(schema_path):
        schema_path = os.path.join(os.path.dirname(__file__), '..', '..', 'schemas', 'news.schema.json')

    try:
        print(f"Fetching real hockey news from {RSS_FEED_URL}...")
        xml_content = fetch_news_rss(RSS_FEED_URL)
        data = parse_and_normalize_news(xml_content)
        if not data.get('news'):
            raise ValueError("No articles parsed from news feed")

        # Validate against schema
        if os.path.exists(schema_path):
            with open(schema_path, 'r', encoding='utf-8') as sf:
                schema = json.load(sf)
            jsonschema.validate(instance=data, schema=schema)
            print(f"Validated {len(data['news'])} articles against schemas/news.schema.json")

        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Successfully saved {len(data['news'])} real news articles to {out_file}")
        return data

    except Exception as exc:
        print(f"Warning: Failed to fetch live news ({exc}). Preserving existing file if present.", file=sys.stderr)
        if os.path.exists(out_file):
            with open(out_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        raise

if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    data_dir = os.path.join(base_dir, 'data')
    sync_news(data_dir)
