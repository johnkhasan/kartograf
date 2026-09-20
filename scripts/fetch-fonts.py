"""Rebuild the subset poster fonts jsPDF embeds for vector text.

    pip install fonttools brotli
    python3 scripts/fetch-fonts.py

Downloads each family from Google Fonts as TTF, subsets it to the characters
a poster can hold, and writes public/fonts/ plus a manifest of the codepoints
each subset actually covers — which is what the export checks before choosing
vector text over drawing the text into the image.
"""

import json, re, subprocess, urllib.request, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'fonts'
OUT.mkdir(parents=True, exist_ok=True)

FONTS = {
    'Space Grotesk': [400, 700],
    'Montserrat': [400, 700],
    'Playfair Display': [400, 700],
    'Oswald': [400, 700],
    'Raleway': [400, 700],
    'Lato': [400, 700],
    'Merriweather': [400, 700],
    'Bebas Neue': [400],
}

# what a poster can contain: latin + latin ext-A, turkish/uzbek marks,
# cyrillic, punctuation, the degree sign, the middle dot and the heart
UNICODES = ','.join([
    'U+0020-007E', 'U+00A0-00FF', 'U+0100-017F', 'U+0192',
    'U+02BB', 'U+02BC', 'U+02C6', 'U+02DC',
    'U+0400-045F', 'U+0490-0491',
    'U+2007-2009', 'U+202F', 'U+2010-2015', 'U+2018-201E', 'U+2020-2022', 'U+2026', 'U+2030',
    'U+2039-203A', 'U+20B4', 'U+20BD', 'U+2122', 'U+2665',
])

def css_faces(family, weights):
    url = ('https://fonts.googleapis.com/css?family=' + family.replace(' ', '+') + ':'
           + ','.join(map(str, weights)) + '&subset=latin,latin-ext,cyrillic')
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8'})
    css = urllib.request.urlopen(req).read().decode()
    blocks = css.split('@font-face')
    out = {}
    for b in blocks:
        m_w = re.search(r'font-weight:\s*(\d+)', b)
        m_u = re.search(r'url\((https://[^)]+\.ttf)\)', b)
        if m_w and m_u:
            out[int(m_w.group(1))] = m_u.group(1)
    return out

def covered(path):
    from fontTools.ttLib import TTFont
    f = TTFont(path)
    codes = sorted(f.getBestCmap().keys())
    ranges, start, prev = [], None, None
    for c in codes:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            ranges.append([start, prev]); start = prev = c
    if start is not None:
        ranges.append([start, prev])
    return ranges

manifest = {}
for family, weights in FONTS.items():
    faces = css_faces(family, weights)
    slug = re.sub(r'[^a-z0-9]+', '-', family.lower()).strip('-')
    entry = {'files': {}}
    for weight in weights:
        url = faces.get(weight) or faces.get(400)
        if not url:
            print('!! no face', family, weight); continue
        raw = OUT / f'{slug}-{weight}.raw.ttf'
        raw.write_bytes(urllib.request.urlopen(url).read())
        dest = OUT / f'{slug}-{weight}.ttf'
        subprocess.run([
            'pyftsubset', str(raw),
            f'--unicodes={UNICODES}',
            '--layout-features=',
            '--no-hinting', '--desubroutinize', '--drop-tables+=DSIG',
            f'--output-file={dest}',
        ], check=True)
        entry['files'][str(weight)] = dest.name
        entry.setdefault('cmap', covered(dest))
        print(f'{dest.name}: {raw.stat().st_size // 1024}KB -> {dest.stat().st_size // 1024}KB')
        raw.unlink()
    manifest[family] = entry

(OUT / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
total = sum(p.stat().st_size for p in OUT.glob('*.ttf'))
print('total ttf:', total // 1024, 'KB')
