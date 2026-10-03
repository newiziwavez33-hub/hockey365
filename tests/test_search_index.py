import os
import json
import pytest

def test_search_index_queries():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    index_file = os.path.join(root_dir, 'data', 'search-index.json')
    assert os.path.exists(index_file), "search-index.json must exist"

    with open(index_file, 'r', encoding='utf-8') as f:
        index = json.load(f)

    def search(query):
        q = query.lower().replace('ё', 'е').strip()
        return [
            item for item in index
            if q in item['title'].lower().replace('ё', 'е') or q in item['tokens'].lower().replace('ё', 'е')
        ]

    # Test "Ак Барс" in Russian
    akbars_ru = search("Ак Барс")
    assert len(akbars_ru) > 0, "Should find 'Ак Барс' in Russian"

    # Test "ak bars" transliteration
    akbars_en = search("ak bars")
    assert len(akbars_en) > 0, "Should find 'ak bars' in English transliteration"

    # Test "СКА"
    ska = search("СКА")
    assert len(ska) > 0, "Should find 'СКА'"

    # Test "Никишин"
    nikishin = search("Никишин")
    assert len(nikishin) > 0, "Should find player 'Никишин'"
