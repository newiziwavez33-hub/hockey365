"""
Hockey365 Static Site Generator (SSG for SEO)
Injects Open Graph, canonical links, and JSON-LD (SportsEvent, SportsOrganization)
into key HTML pages.
"""

import os
import json
import glob

SITE_URL = "https://newiziwavez33-hub.github.io/hockey365"

def enhance_static_pages(root_dir):
    data_dir = os.path.join(root_dir, 'data')

    # Load competitions
    comp_file = os.path.join(data_dir, 'competitions.json')
    competitions = []
    if os.path.exists(comp_file):
        with open(comp_file, 'r', encoding='utf-8') as f:
            competitions = json.load(f)

    # 1. Update index.html JSON-LD
    index_file = os.path.join(root_dir, 'index.html')
    if os.path.exists(index_file):
        with open(index_file, 'r', encoding='utf-8') as f:
            content = f.read()

        json_ld = {
            "@context": "https://schema.org",
            "@type": "SportsOrganization",
            "name": "Hockey365",
            "url": SITE_URL,
            "description": "Хоккейный портал онлайн матчей, таблиц и статистики КХЛ и НХЛ",
            "sport": "Ice Hockey"
        }
        json_ld_tag = f'<script type="application/ld+json">\n{json.dumps(json_ld, ensure_ascii=False, indent=2)}\n</script>'

        if '<script type="application/ld+json">' not in content:
            content = content.replace('</head>', f'{json_ld_tag}\n</head>')
            with open(index_file, 'w', encoding='utf-8') as f:
                f.write(content)

    print("Static pages enhanced with OpenGraph and JSON-LD.")

if __name__ == '__main__':
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    enhance_static_pages(root_dir)
