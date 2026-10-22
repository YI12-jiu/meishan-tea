"""Build a distributable offline preview using the same application source."""
from pathlib import Path
import base64
import mimetypes
import re

root = Path(__file__).resolve().parents[1]
cache = {}


def data_uri(path):
    if path not in cache:
        mime = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
        cache[path] = 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
    return cache[path]


def local_path(ref):
    """index.html 的引用带 ?v=<hash> 缓存版本号，解析文件路径前先剥掉查询串。"""
    return root / ref.split('?', 1)[0]


def css(match):
    file = local_path(match[1])
    text = file.read_text(encoding='utf-8')

    def url(m):
        relative = m[1].strip('\"\x27')
        if relative.startswith(('data:', 'http:', 'https:')):
            return m[0]
        return 'url("' + data_uri((file.parent / relative).resolve()) + '")'

    return '<style>' + re.sub(r'url\(([^)]+)\)', url, text) + '</style>'


def script(match):
    text = local_path(match[1]).read_text(encoding='utf-8')
    for asset in (root / 'assets').glob('*.jpg'):
        text = text.replace('assets/' + asset.name, data_uri(asset))
    return '<script>' + text.replace('</script', '<\\/script') + '</script>'


html = (root / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', css, html)
html = re.sub(r'<script\s+src="([^"]+)"\s*></script>', script, html)
html = re.sub(
    r'href="assets/favicon\.svg(?:\?[^"]*)?"',
    'href="' + data_uri(root / 'assets/favicon.svg') + '"',
    html,
)
(root / '离线体验.html').write_text(html, encoding='utf-8', newline='\n')
print('Built 离线体验.html:', (root / '离线体验.html').stat().st_size, 'bytes')
