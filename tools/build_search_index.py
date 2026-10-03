"""
Hockey365 Search Index Generator
Builds client-side search index with RU/EN aliases, 'ё'/'е' normalization,
and transliteration for lightning-fast autocomplete.
"""

import json
import os
import glob

# Cyrillic to Latin transliteration table
TRANSLIT_MAP = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def transliterate(text):
    text_clean = text.lower()
    result = []
    for char in text_clean:
        result.append(TRANSLIT_MAP.get(char, char))
    return "".join(result)

def normalize_text(text):
    if not text:
        return ""
    return text.lower().replace('ё', 'е').strip()

def build_search_index(root_dir):
    data_dir = os.path.join(root_dir, 'data')
    index_items = []

    # 1. Competitions
    comp_file = os.path.join(data_dir, 'competitions.json')
    if os.path.exists(comp_file):
        with open(comp_file, 'r', encoding='utf-8') as f:
            comps = json.load(f)
        for c in comps:
            name = c.get('name', '')
            name_en = c.get('nameEn', '')
            tokens = [normalize_text(name), normalize_text(name_en), transliterate(name)]
            index_items.append({
                "type": "competition",
                "id": c['id'],
                "title": name,
                "subtitle": f"{name_en} • {c.get('country', '')}",
                "url": f"/competition/?id={c['id']}",
                "tokens": " ".join(tokens)
            })

    # 2. Teams
    for tf in glob.glob(os.path.join(data_dir, 'teams', '*.json')):
        with open(tf, 'r', encoding='utf-8') as f:
            t = json.load(f)
        name = t.get('name', '')
        name_en = t.get('nameEn', '')
        short = t.get('short', '')
        city = t.get('city', '')
        tokens = [
            normalize_text(name),
            normalize_text(name_en),
            normalize_text(short),
            normalize_text(city),
            transliterate(name)
        ]
        index_items.append({
            "type": "team",
            "id": t['id'],
            "title": name,
            "subtitle": f"{t.get('conference', '')} • {t.get('city', '')}",
            "logo": t.get('logo', ''),
            "url": f"/team/?id={t['id']}",
            "tokens": " ".join(tokens)
        })

    # 3. Players
    for pf in glob.glob(os.path.join(data_dir, 'players', '*.json')):
        with open(pf, 'r', encoding='utf-8') as f:
            p = json.load(f)
        name = p.get('name', '')
        name_en = p.get('nameEn', '')
        pos = p.get('position', '')
        tokens = [
            normalize_text(name),
            normalize_text(name_en),
            normalize_text(pos),
            transliterate(name)
        ]
        index_items.append({
            "type": "player",
            "id": p['id'],
            "title": name,
            "subtitle": f"#{p.get('number', '')} • Позиция: {pos}",
            "url": f"/player/?id={p['id']}",
            "tokens": " ".join(tokens)
        })

    # 4. News
    news_file = os.path.join(data_dir, 'news', 'index.json')
    if os.path.exists(news_file):
        with open(news_file, 'r', encoding='utf-8') as f:
            news_data = json.load(f)
        for n in news_data.get('news', []):
            title = n.get('title', '')
            tokens = [normalize_text(title), normalize_text(" ".join(n.get('tags', [])))]
            index_items.append({
                "type": "news",
                "id": n['id'],
                "title": title,
                "subtitle": n.get('summary', '')[:80] + '...',
                "url": f"/news/?id={n['id']}",
                "tokens": " ".join(tokens)
            })

    output_file = os.path.join(data_dir, 'search-index.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(index_items, f, ensure_ascii=False, indent=2)

    print(f"Search index generated with {len(index_items)} indexed items.")

if __name__ == '__main__':
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    build_search_index(root_dir)
