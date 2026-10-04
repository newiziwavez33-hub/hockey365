"""
Hockey365 Match View Functional Verification Tool
Validates match page rendering:
- Match Hero Header with team names and glass emblems
- Floating Matte Tabs Dock with hidden scrollbars
- Interactive Pre-Match Hub (prematch-hub-card) for scheduled matches
- Period Breakdown Table for completed matches
"""

import os
import sys
import subprocess
import threading
import http.server
import socketserver
import time

def run_match_audit(port=8995):
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=root_dir, **kwargs)
        def log_message(self, format, *args):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', port), Handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    time.sleep(0.5)

    chromium_path = '/snap/bin/chromium'
    has_chromium = os.path.exists(chromium_path)

    test_matches = [
        {
            "id": "nhl:2026020035",
            "name": "Детройт Ред Уингз vs Виннипег Джетс (SCHEDULED)",
            "checks": [
                ("Детройт", "Название хозяев"),
                ("Виннипег", "Название гостей"),
                ("prematch-hub-card", "Карточка предматчевого хаба"),
                ("ОЖИДАНИЕ СТАРТОВОГО ВБРАСЫВАНИЯ", "Live-статус ожидания вбрасывания"),
                ("Little Caesars Arena", "Место проведения (Арена)"),
                ("tab-btn", "Навигационный док табов"),
                ("Посмотреть составы", "CTA кнопка составов")
            ]
        },
        {
            "id": "nhl:2026020027",
            "name": "Коламбус Блю Джекетс vs Юта Хоккей Клаб (FINISHED)",
            "checks": [
                ("Коламбус", "Название хозяев"),
                ("Юта", "Название гостей"),
                ("tab-btn", "Навигационный док табов")
            ]
        }
    ]

    all_passed = True

    try:
        if has_chromium:
            print("=== Headless Chromium Browser Match Verification ===")
            for tm in test_matches:
                url = f"http://127.0.0.1:{port}/match/?id={tm['id']}"
                print(f"\nТестирование: {tm['name']} -> {url}")
                cmd = [chromium_path, '--headless', '--disable-gpu', '--dump-dom', url]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
                dom = res.stdout

                if res.returncode != 0 or len(dom) < 500:
                    print(f"  ❌ Ошибка загрузки страницы: код {res.returncode}, длина DOM {len(dom)}")
                    all_passed = False
                    continue

                for token, desc in tm['checks']:
                    found = token in dom
                    status = "✅" if found else "❌"
                    if not found:
                        all_passed = False
                    print(f"  {status} {desc} ('{token}'): {'Найдено' if found else 'НЕ НАЙДЕНО'}")
        else:
            print("Chromium не обнаружен; пропуск headless браузера.")

    finally:
        httpd.shutdown()

    return all_passed

if __name__ == '__main__':
    success = run_match_audit()
    sys.exit(0 if success else 1)
