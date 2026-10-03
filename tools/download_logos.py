"""
Hockey365 Team Logos Downloader
Downloads real official logos for all 32 NHL teams (official NHL vector SVGs)
and all 23 KHL teams (official high-res badges from TheSportsDB).
"""

import urllib.request
import json
import os
import time

NHL_ABBRS = [
    'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL',
    'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
    'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS',
    'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH'
]

KHL_TEAMS_MAP = {
    'ska': 'https://r2.thesportsdb.com/images/media/team/badge/6k17p41771447068.png',
    'cska': 'https://r2.thesportsdb.com/images/media/team/badge/1hf19s1681319986.png',
    'spartak': 'https://r2.thesportsdb.com/images/media/team/badge/zpj2el1754674286.png',
    'dynamo-msk': 'https://r2.thesportsdb.com/images/media/team/badge/j27vke1782186818.png',
    'lokomotiv': 'https://r2.thesportsdb.com/images/media/team/badge/u5l89y1615576119.png',
    'torpedo': 'https://r2.thesportsdb.com/images/media/team/badge/zdb4w01771447143.png',
    'severstal': 'https://r2.thesportsdb.com/images/media/team/badge/ur1mau1615576281.png',
    'sochi': 'https://r2.thesportsdb.com/images/media/team/badge/8vc3yx1734508572.png',
    'vityaz': 'https://r2.thesportsdb.com/images/media/team/badge/254doy1637267447.png',
    'dynamo-mns': 'https://r2.thesportsdb.com/images/media/team/badge/j99ran1615576087.png',
    'kunlun': 'https://r2.thesportsdb.com/images/media/team/badge/m2i23g1790150258.png',
    'ak-bars': 'https://r2.thesportsdb.com/images/media/team/badge/fcugks1693637120.png',
    'metallurg-mg': 'https://r2.thesportsdb.com/images/media/team/badge/v9a5tu1615576125.png',
    'traktor': 'https://r2.thesportsdb.com/images/media/team/badge/rz5xo11615576307.png',
    'avtomobilist': 'https://r2.thesportsdb.com/images/media/team/badge/a3aeui1615576069.png',
    'neftekhimik': 'https://r2.thesportsdb.com/images/media/team/badge/cttja61615576508.png',
    'lada': 'https://r2.thesportsdb.com/images/media/team/badge/65tcrn1782911462.png',
    'avangard': 'https://r2.thesportsdb.com/images/media/team/badge/usqllb1615575894.png',
    'salavat-yulaev': 'https://r2.thesportsdb.com/images/media/team/badge/0ujble1615576276.png',
    'sibir': 'https://r2.thesportsdb.com/images/media/team/badge/55s9q31615576286.png',
    'barys': 'https://r2.thesportsdb.com/images/media/team/badge/je395l1693637111.png',
    'amur': 'https://r2.thesportsdb.com/images/media/team/badge/0mvysq1615575890.png',
    'admiral': 'https://r2.thesportsdb.com/images/media/team/badge/q3ukqt1641393028.png'
}

def download_file(url, target_path, is_binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        content = resp.read()
        mode = 'wb' if is_binary else 'w'
        with open(target_path, mode, encoding=None if is_binary else 'utf-8') as f:
            if is_binary:
                f.write(content)
            else:
                f.write(content.decode('utf-8'))

def download_all_logos(assets_dir):
    teams_dir = os.path.join(assets_dir, 'logos', 'teams')
    os.makedirs(teams_dir, exist_ok=True)

    print("--- 1. Downloading 32 NHL Official SVG Logos ---")
    for abbr in NHL_ABBRS:
        url = f"https://assets.nhle.com/logos/nhl/svg/{abbr}_light.svg"
        target = os.path.join(teams_dir, f"{abbr.lower()}.svg")
        try:
            download_file(url, target, is_binary=False)
            print(f"  [NHL] {abbr} -> {target} ({os.path.getsize(target)} bytes)")
        except Exception as e:
            print(f"  [NHL] {abbr} failed: {e}")

    print("\n--- 2. Downloading 23 KHL Official Badges ---")
    for team_slug, badge_url in KHL_TEAMS_MAP.items():
        # Save as PNG
        target_png = os.path.join(teams_dir, f"{team_slug}.png")
        try:
            download_file(badge_url, target_png, is_binary=True)
            print(f"  [KHL] {team_slug} -> {target_png} ({os.path.getsize(target_png)} bytes)")

            # Also create an SVG wrapper so any path requesting .svg also renders the PNG smoothly
            target_svg = os.path.join(teams_dir, f"{team_slug}.svg")
            svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 200" width="200" height="200">
  <image href="{team_slug}.png" xlink:href="{team_slug}.png" width="200" height="200" preserveAspectRatio="xMidYMid meet"/>
</svg>"""
            with open(target_svg, 'w', encoding='utf-8') as sf:
                sf.write(svg_content)
        except Exception as e:
            print(f"  [KHL] {team_slug} failed: {e}")

if __name__ == '__main__':
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    assets = os.path.join(root, 'assets')
    download_all_logos(assets)
