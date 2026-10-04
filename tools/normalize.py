"""Refresh the available-date index without changing source match results."""

import json
import os
import sys
import glob
from datetime import datetime
from zoneinfo import ZoneInfo

# Ensure project root is available in module search path
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

def normalize_all(data_dir):
    print("Normalizing Hockey365 data...")

    # Sync live news if full project structure exists
    try:
        root_dir = os.path.abspath(os.path.join(data_dir, '..'))
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        from tools.adapters.fetch_news import sync_news
        if os.path.exists(os.path.join(root_dir, 'schemas', 'news.schema.json')) or os.path.exists(os.path.join(data_dir, 'news')):
            sync_news(data_dir)
    except Exception as exc:
        print(f"News sync skipped during normalize: {exc}")

    # Indexing existing files is not a data refresh. Never advance updatedAt here.
    meta_path = os.path.join(data_dir, 'meta.json')
    by_date_files = glob.glob(os.path.join(data_dir, 'matches', 'by-date', '*.json'))
    available_dates = sorted([os.path.basename(f).replace('.json', '') for f in by_date_files])
    date_counts = {}
    for f in by_date_files:
        d_name = os.path.basename(f).replace('.json', '')
        try:
            with open(f, 'r', encoding='utf-8') as bdf:
                games = json.load(bdf)
                date_counts[d_name] = len(games) if isinstance(games, list) else 0
        except (OSError, ValueError) as exc:
            raise ValueError(f"Cannot index match date file {f}: {exc}") from exc

    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        meta['availableDates'] = available_dates
        # The portal defaults to Moscow dates; UTC may still be yesterday.
        today = datetime.now(ZoneInfo('Europe/Moscow')).date().isoformat()
        current_or_past = [day for day in available_dates if day <= today]
        meta['activeDate'] = current_or_past[-1] if current_or_past else (available_dates[0] if available_dates else None)
        meta['dateCounts'] = date_counts
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Indexed {len(by_date_files)} match dates; source scores unchanged.")

if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data_dir = os.path.join(base_dir, 'data')
    normalize_all(data_dir)
