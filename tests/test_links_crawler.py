import os
import re
import glob
import pytest

def test_internal_links_and_assets():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    html_files = glob.glob(os.path.join(root_dir, '**', '*.html'), recursive=True)

    assert len(html_files) >= 10, f"Expected at least 10 HTML files, found {len(html_files)}"

    broken_links = []

    for hf in html_files:
        hf_dir = os.path.dirname(hf)
        with open(hf, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find href and src
        hrefs = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', content)
        for link in hrefs:
            if link.startswith('http://') or link.startswith('https://') or link.startswith('#') or link.startswith('data:'):
                continue

            # Strip query params
            clean_link = link.split('?')[0].split('#')[0]
            if not clean_link:
                continue

            # Check if file exists relative to HTML file or root
            target_path = os.path.normpath(os.path.join(hf_dir, clean_link))
            if os.path.isdir(target_path):
                index_in_dir = os.path.join(target_path, 'index.html')
                if not os.path.exists(index_in_dir):
                    broken_links.append(f"{hf}: link to directory without index.html: {link}")
            elif not os.path.exists(target_path):
                # Try relative to root if clean_link starts without .
                target_from_root = os.path.normpath(os.path.join(root_dir, clean_link.lstrip('/')))
                if not os.path.exists(target_from_root):
                    broken_links.append(f"{hf}: broken link: {link} (looked at {target_path})")

    assert len(broken_links) == 0, f"Found broken links:\n" + "\n".join(broken_links)
