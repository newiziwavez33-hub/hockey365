from pathlib import Path
import re
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
PUBLISHED_PAGES = [ROOT / '404.html', ROOT / 'index.html', *sorted(ROOT.glob('*/index.html'))]
ASSET_VERSION = '1.8.2'


def local_entry_resources(html):
    """Only resources requested directly by published HTML (not dynamic page data)."""
    return re.findall(r'''["']((?:\.?\.?/)?(?:assets/(?:css|icons|js)/[^"']+|sw\.js\?[^"']+))["']''', html)


def test_published_pages_use_the_same_local_hockey365_icon():
    assert len(PUBLISHED_PAGES) == 15
    for page in PUBLISHED_PAGES:
        html = page.read_text(encoding='utf-8')
        assert 'name="viewport"' in html
        expected = 'assets/icons/hockey365.svg' if page.parent == ROOT else '../assets/icons/hockey365.svg'
        assert f'href="{expected}?v={ASSET_VERSION}"' in html, page
        assert 'assets/logos/comp/KHL.svg' not in html, page


def test_all_published_html_entry_resources_use_one_cache_version():
    assert len(PUBLISHED_PAGES) == 15
    for page in PUBLISHED_PAGES:
        html = page.read_text(encoding='utf-8')
        resources = local_entry_resources(html)
        assert len(resources) >= 6, page  # favicon + 3 stylesheets + header/footer modules
        css = [urlsplit(resource).path for resource in resources if '/css/' in resource]
        assert {Path(path).name for path in css} >= {'tokens.css', 'base.css', 'components.css'}, page
        if page.name == 'index.html' and page.parent.name not in {'about', 'privacy'}:
            name = 'home' if page.parent == ROOT else page.parent.name
            assert any(urlsplit(resource).path.endswith(f'/js/pages/{name}.js') for resource in resources), page
        if page == ROOT / 'match/index.html':
            assert any(path.endswith('/event-player.css') for path in css), page
        if page == ROOT / 'index.html':
            assert f"./sw.js?v={ASSET_VERSION}" in resources, page
        for resource in resources:
            url = urlsplit(resource)
            assert url.query == f'v={ASSET_VERSION}', (page, resource)
            assert (page.parent / url.path).is_file(), (page, resource)
        assert not re.search(r'\?v=(?!' + re.escape(ASSET_VERSION) + r'\b)[^"\s]+', html), page


def test_local_icon_is_a_valid_non_league_mark():
    icon = (ROOT / 'assets/icons/hockey365.svg').read_text(encoding='utf-8')
    assert '<svg ' in icon
    assert 'Hockey365' in icon
    assert 'КХЛ' not in icon
    assert re.search(r'<(path|ellipse)\b', icon)


def test_narrow_match_and_event_layout_has_regression_guards():
    css = (ROOT / 'assets/css/components.css').read_text(encoding='utf-8')
    assert '.match-event-row' in css
    assert '.match-event-details' in css
    assert 'flex: 0 0 100%;' in css
    assert 'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);' in css
    assert '.standings-table .team-logo-small' in css
    assert '.brand-badge-icon img' in css
