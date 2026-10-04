"""
Hockey365 Sitemap and Robots Generator
Generates sitemap.xml and robots.txt for GitHub Pages SEO.
"""

import os
import json
import glob

SITE_URL = "https://newiziwavez33-hub.github.io/hockey365"

def generate_sitemap(root_dir):
    urls = [
        {"loc": f"{SITE_URL}/", "priority": "1.0", "changefreq": "always"},
        {"loc": f"{SITE_URL}/online/", "priority": "0.9", "changefreq": "always"},
        {"loc": f"{SITE_URL}/competitions/", "priority": "0.8", "changefreq": "daily"},
        {"loc": f"{SITE_URL}/competition/?id=KHL", "priority": "0.9", "changefreq": "hourly"},
        {"loc": f"{SITE_URL}/competition/?id=NHL", "priority": "0.9", "changefreq": "hourly"},
        {"loc": f"{SITE_URL}/news/", "priority": "0.8", "changefreq": "hourly"},
        {"loc": f"{SITE_URL}/transfers/", "priority": "0.7", "changefreq": "daily"},
        {"loc": f"{SITE_URL}/search/", "priority": "0.6", "changefreq": "weekly"},
        {"loc": f"{SITE_URL}/favorites/", "priority": "0.5", "changefreq": "weekly"},
        {"loc": f"{SITE_URL}/about/", "priority": "0.4", "changefreq": "monthly"},
        {"loc": f"{SITE_URL}/privacy/", "priority": "0.3", "changefreq": "monthly"}
    ]

    # Add teams
    data_dir = os.path.join(root_dir, 'data')
    for tf in glob.glob(os.path.join(data_dir, 'teams', '*.json')):
        with open(tf, 'r', encoding='utf-8') as f:
            t = json.load(f)
        urls.append({
            "loc": f"{SITE_URL}/team/?id={t['id']}",
            "priority": "0.7",
            "changefreq": "daily"
        })

    # Add players
    for pf in glob.glob(os.path.join(data_dir, 'players', '*.json')):
        with open(pf, 'r', encoding='utf-8') as f:
            p = json.load(f)
        urls.append({
            "loc": f"{SITE_URL}/player/?id={p['id']}",
            "priority": "0.6",
            "changefreq": "daily"
        })

    # Add news articles
    news_file = os.path.join(data_dir, 'news', 'index.json')
    if os.path.exists(news_file):
        with open(news_file, 'r', encoding='utf-8') as f:
            news_data = json.load(f)
        for n in news_data.get('news', []):
            urls.append({
                "loc": f"{SITE_URL}/news/?id={n['id']}",
                "priority": "0.6",
                "changefreq": "daily"
            })

    # Generate sitemap.xml
    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for u in urls:
        sitemap_lines.append('  <url>')
        sitemap_lines.append(f'    <loc>{u["loc"]}</loc>')
        sitemap_lines.append(f'    <changefreq>{u["changefreq"]}</changefreq>')
        sitemap_lines.append(f'    <priority>{u["priority"]}</priority>')
        sitemap_lines.append('  </url>')
    sitemap_lines.append('</urlset>')

    sitemap_path = os.path.join(root_dir, 'sitemap.xml')
    with open(sitemap_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(sitemap_lines))

    # Generate robots.txt
    robots_content = f"""User-agent: *
Allow: /

Sitemap: {SITE_URL}/sitemap.xml
"""
    robots_path = os.path.join(root_dir, 'robots.txt')
    with open(robots_path, 'w', encoding='utf-8') as f:
        f.write(robots_content)

    print(f"Generated sitemap.xml with {len(urls)} URLs and robots.txt.")

if __name__ == '__main__':
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    generate_sitemap(root_dir)
