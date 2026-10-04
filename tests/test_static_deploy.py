from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_static_frontend_has_no_fixed_repository_base_path():
    config = (ROOT / 'assets/js/core/config.js').read_text(encoding='utf-8')
    assert 'import.meta.url' in config
    assert "=== '/hockey365'" not in config


def test_static_styles_do_not_use_domain_root_asset_urls():
    css = (ROOT / 'assets/css/components.css').read_text(encoding='utf-8')
    assert "url('/assets/" not in css


def test_publishable_root_has_no_node_or_vite_manifest():
    assert not (ROOT / 'package.json').exists()
    assert not (ROOT / 'vite.config.js').exists()
    assert not (ROOT / 'vite.config.ts').exists()
