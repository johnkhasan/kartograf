"""Rebuild the star catalogue the sky poster draws from.

    python3 scripts/fetch-stars.py

Takes d3-celestial's magnitude-6 star set and its western constellation lines
(BSD-3, ofrohn/d3-celestial) and packs them into flat arrays: the browser only
needs right ascension, declination and brightness, and JSON objects for five
thousand stars cost far more than the numbers do.
"""

import json
import pathlib
import urllib.request

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'sky.json'
BASE = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/'


def fetch(name):
    with urllib.request.urlopen(BASE + name) as r:
        return json.loads(r.read().decode())


stars = fetch('stars.6.json')
lines = fetch('constellations.lines.json')

# [ra, dec, mag] triples, rounded to what a poster can possibly resolve
flat = []
for f in stars['features']:
    ra, dec = f['geometry']['coordinates']
    mag = f['properties']['mag']
    flat.extend([round(ra, 3), round(dec, 3), round(mag, 2)])

segments = []
for f in lines['features']:
    for line in f['geometry']['coordinates']:
        segments.append([round(v, 2) for point in line for v in point])

OUT.write_text(json.dumps({'stars': flat, 'lines': segments}, separators=(',', ':')))
print(f"{len(flat) // 3} stars, {len(segments)} constellation lines -> {OUT.stat().st_size // 1024}KB")
