import http.server
import socketserver
import threading
import urllib.request
import urllib.parse
import os
import sys
import pytest

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        super().__init__(*args, directory=root_dir, **kwargs)

    def log_message(self, format, *args):
        pass

@pytest.fixture(scope="module")
def server():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever)
    thread.daemon = True
    thread.start()
    yield f"http://127.0.0.1:{port}"
    httpd.shutdown()

def test_all_routes_return_200(server):
    routes = [
        "/",
        "/online/",
        "/competitions/",
        "/competition/?id=KHL",
        "/competition/?id=NHL",
        "/match/?id=khl:20261003-ska-lok",
        "/team/?id=khl:ska",
        "/player/?id=khl:p_nikishin",
        "/news/",
        "/transfers/",
        f"/search/?q={urllib.parse.quote('СКА')}",
        "/favorites/",
        "/settings/",
        "/about/",
        "/privacy/",
        "/404.html",
        "/manifest.webmanifest",
        "/sw.js",
        "/data/competitions.json",
        "/data/search-index.json"
    ]

    news_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'news', 'index.json')
    if os.path.exists(news_file):
        import json
        with open(news_file, 'r', encoding='utf-8') as f:
            news_data = json.load(f)
            if news_data.get('news'):
                routes.append(f"/news/?id={news_data['news'][0]['id']}")

    for route in routes:
        url = server + route
        req = urllib.request.Request(url, headers={'User-Agent': 'TestCrawler'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            assert resp.status == 200, f"Route {route} returned status {resp.status}"
            content = resp.read()
            assert len(content) > 0, f"Route {route} returned empty content"


