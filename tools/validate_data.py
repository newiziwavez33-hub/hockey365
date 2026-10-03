"""
Hockey365 Data Validator & Business Rules Verifier
Validates all JSON files against schemas/*.schema.json and checks hockey domain business rules:
- Sum of goals in periods equals total score for finished games.
- In finished games with SO, score difference is exactly 1.
- In playoff brackets, team wins in a series do not exceed ceil(bestOf / 2).
- Points in standings match league pointsRule.
"""

import json
import os
import glob
import sys
import jsonschema

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def validate_all(root_dir):
    data_dir = os.path.join(root_dir, 'data')
    schemas_dir = os.path.join(root_dir, 'schemas')

    errors = []

    # 1. Validate competitions.json
    comp_schema = load_json(os.path.join(schemas_dir, 'competition.schema.json'))
    competitions = load_json(os.path.join(data_dir, 'competitions.json'))
    for c in competitions:
        try:
            jsonschema.validate(instance=c, schema=comp_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Competition {c.get('id')} validation error: {e.message}")

    # Build points rules map
    rules_map = {c['id']: c.get('pointsRule', '2-1-0-ot') for c in competitions}

    # 2. Validate Teams
    team_schema = load_json(os.path.join(schemas_dir, 'team.schema.json'))
    team_files = glob.glob(os.path.join(data_dir, 'teams', '*.json'))
    for tf in team_files:
        t = load_json(tf)
        try:
            jsonschema.validate(instance=t, schema=team_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Team file {os.path.basename(tf)} validation error: {e.message}")

    # 3. Validate Players
    player_schema = load_json(os.path.join(schemas_dir, 'player.schema.json'))
    player_files = glob.glob(os.path.join(data_dir, 'players', '*.json'))
    for pf in player_files:
        p = load_json(pf)
        try:
            jsonschema.validate(instance=p, schema=player_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Player file {os.path.basename(pf)} validation error: {e.message}")

    # 4. Validate Matches & Business Rules
    match_schema = load_json(os.path.join(schemas_dir, 'match.schema.json'))
    match_files = glob.glob(os.path.join(data_dir, 'matches', '*.json'))
    for mf in match_files:
        m = load_json(mf)
        try:
            jsonschema.validate(instance=m, schema=match_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Match {os.path.basename(mf)} schema error: {e.message}")

        # Business Rule 1: Sum of period goals == total score for FINISHED matches
        if m.get('status') == 'FINISHED':
            h_score = m['home']['score']
            a_score = m['away']['score']
            h_periods = m['home'].get('periods', [])
            a_periods = m['away'].get('periods', [])

            if h_periods and h_score is not None:
                calc_h = sum(p for p in h_periods if p is not None)
                if calc_h != h_score:
                    errors.append(f"Match {m['id']} home period sum {calc_h} != score {h_score}")

            if a_periods and a_score is not None:
                calc_a = sum(p for p in a_periods if p is not None)
                if calc_a != a_score:
                    errors.append(f"Match {m['id']} away period sum {calc_a} != score {a_score}")

            # Business Rule 2: In SO (Shootout) finished games, score difference must be exactly 1
            if m.get('finishedIn') == 'SO':
                if h_score is not None and a_score is not None:
                    diff = abs(h_score - a_score)
                    if diff != 1:
                        errors.append(f"Match {m['id']} finished in SO but goal diff is {diff} (must be 1)")

    # 5. Validate Standings
    standings_schema = load_json(os.path.join(schemas_dir, 'standings.schema.json'))
    standings_files = glob.glob(os.path.join(data_dir, 'standings', '*.json'))
    for sf in standings_files:
        st = load_json(sf)
        try:
            jsonschema.validate(instance=st, schema=standings_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Standings {os.path.basename(sf)} schema error: {e.message}")

        # Business Rule 3: Points in standings calculated according to pointsRule
        comp_id = st.get('compId')
        points_rule = rules_map.get(comp_id, '2-1-0-ot')
        for grp in st.get('groups', []):
            for row in grp.get('rows', []):
                w = row.get('w', 0)
                wot = row.get('wOT', 0)
                wso = row.get('wSO', 0)
                lot = row.get('lOT', 0)
                lso = row.get('lSO', 0)
                l = row.get('l', 0)
                pts = row.get('pts', 0)

                if points_rule in ['2-1-0', '2-1-0-ot']:
                    expected_pts = 2 * (w + wot + wso) + 1 * (lot + lso)
                    if pts != expected_pts:
                        errors.append(f"Standings {comp_id} team {row['teamId']} pts {pts} != expected {expected_pts} (rule {points_rule})")
                elif points_rule == '3-2-1-0':
                    expected_pts = 3 * w + 2 * (wot + wso) + 1 * (lot + lso)
                    if pts != expected_pts:
                        errors.append(f"Standings {comp_id} team {row['teamId']} pts {pts} != expected {expected_pts} (rule 3-2-1-0)")

    # 6. Validate Playoffs & Business Rules
    playoff_schema = load_json(os.path.join(schemas_dir, 'playoff.schema.json'))
    playoff_files = glob.glob(os.path.join(data_dir, 'playoffs', '*.json'))
    for pf in playoff_files:
        po = load_json(pf)
        try:
            jsonschema.validate(instance=po, schema=playoff_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Playoff {os.path.basename(pf)} schema error: {e.message}")

        # Business Rule 4: Series wins must not exceed ceil(bestOf / 2)
        for r in po.get('rounds', []):
            for s in r.get('series', []):
                max_allowed = (s['bestOf'] + 1) // 2
                w1, w2 = s['wins']
                if w1 > max_allowed or w2 > max_allowed:
                    errors.append(f"Playoff series {s['seriesId']} wins {s['wins']} exceed max {max_allowed} in best-of-{s['bestOf']}")

    # 7. Validate Leaders, News, Transfers
    leaders_schema = load_json(os.path.join(schemas_dir, 'leaders.schema.json'))
    for lf in glob.glob(os.path.join(data_dir, 'leaders', '*.json')):
        l = load_json(lf)
        try:
            jsonschema.validate(instance=l, schema=leaders_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Leaders {os.path.basename(lf)} schema error: {e.message}")

    news_schema = load_json(os.path.join(schemas_dir, 'news.schema.json'))
    news_file = os.path.join(data_dir, 'news', 'index.json')
    if os.path.exists(news_file):
        try:
            jsonschema.validate(instance=load_json(news_file), schema=news_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"News schema error: {e.message}")

    transfers_schema = load_json(os.path.join(schemas_dir, 'transfers.schema.json'))
    for tf in glob.glob(os.path.join(data_dir, 'transfers', '*.json')):
        try:
            jsonschema.validate(instance=load_json(tf), schema=transfers_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"Transfers {os.path.basename(tf)} schema error: {e.message}")

    if errors:
        print(f"Validation FAILED with {len(errors)} errors:")
        for err in errors:
            print(f"  - {err}")
        return False
    else:
        print("All data validated successfully! 0 schema errors, all hockey business rules satisfied.")
        return True

if __name__ == '__main__':
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    success = validate_all(root_dir)
    sys.exit(0 if success else 1)
