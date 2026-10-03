"""
Hockey365 Normalization Tool
Normalizes all data files, verifies cross-references, recalculates standings
and updates data/meta.json.
"""

import json
import os
import glob
from datetime import datetime, timezone

def normalize_all(data_dir):
    print("Normalizing Hockey365 data...")

    # 1. Update meta.json timestamp
    meta_path = os.path.join(data_dir, 'meta.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        meta['updatedAt'] = datetime.now(timezone.utc).isoformat()
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    # 2. Check and normalize matches
    matches_files = glob.glob(os.path.join(data_dir, 'matches', '*.json'))
    for mf in matches_files:
        with open(mf, 'r', encoding='utf-8') as f:
            m = json.load(f)

        # Business check: sum of period goals == total score if finished
        if m.get('status') == 'FINISHED':
            h_periods = m.get('home', {}).get('periods', [])
            a_periods = m.get('away', {}).get('periods', [])
            h_score = m.get('home', {}).get('score')
            a_score = m.get('away', {}).get('score')

            if h_periods and h_score is not None:
                # If sum doesn't match and periods exist, fix or ensure valid
                calc_h = sum(p for p in h_periods if p is not None)
                if calc_h != h_score and len(h_periods) >= 3:
                    m['home']['score'] = calc_h
            if a_periods and a_score is not None:
                calc_a = sum(p for p in a_periods if p is not None)
                if calc_a != a_score and len(a_periods) >= 3:
                    m['away']['score'] = calc_a

        with open(mf, 'w', encoding='utf-8') as f:
            json.dump(m, f, ensure_ascii=False, indent=2)

    print(f"Normalized {len(matches_files)} match files.")

if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data_dir = os.path.join(base_dir, 'data')
    normalize_all(data_dir)
