"""C0 spike #1 (throwaway): HTML -> PDF at exact cheque size in mm with Chromium.
Cheque size below is a PLACEHOLDER until the real Arab Bank cheque is measured."""
import json, subprocess, sys
from playwright.sync_api import sync_playwright

W_MM, H_MM = 175.0, 93.0           # placeholder
import os
DX, DY = float(os.environ.get('DX','0')), float(os.environ.get('DY','0'))   # printer-profile offset (mm)
DEBUG = os.environ.get('DEBUG','1') == '1'
OUT = os.environ.get('OUT','cheque.pdf')
words = json.load(open('words.json'))

# (id, x_mm, y_mm, w_mm, h_mm, align, font_pt, text)  -- y from the TOP edge
FIELDS = [
    ('date',    12,  12, 40, 7, 'left',  11, '05/10/2026'),
    ('payee',   40,  27, 125, 8, 'right', 12, 'السادة شركة بوليفارد العبدلي المحترمين'),
    ('words1',  20,  40, 145, 8, 'right', 11, words['words']),
    ('words2',  20,  49, 145, 8, 'right', 11, words['words_long']),
    ('amt_main',115, 62, 38, 9, 'center',15, '3355'),
    ('amt_frac',155, 62, 14, 9, 'center',15, '515'),
    ('memo',    20,  76, 100, 7, 'right', 10, 'دفعة من الحساب 24/24'),
]
# vector reference marks used by the geometry test (exact mm positions)
MARKS = [(5, 5), (W_MM - 5, 5), (5, H_MM - 5), (W_MM - 5, H_MM - 5)]

def html():
    css = f"""
    @page {{ size: {W_MM}mm {H_MM}mm; margin: 0 }}
    * {{ box-sizing: border-box; margin: 0; padding: 0 }}
    html, body {{ width: {W_MM}mm; height: {H_MM}mm; }}
    body {{ font-family: 'DejaVu Sans'; position: relative; overflow: hidden }}
    .clip {{ position: absolute; left: 0; top: 0; width: {W_MM}mm; height: {H_MM}mm; overflow: hidden }}
    .sheet {{ position: absolute; left: {DX}mm; top: {DY}mm; width: {W_MM}mm; height: {H_MM}mm }}
    .f {{ position: absolute; white-space: nowrap; overflow: hidden }}
    .f.right {{ text-align: right }} .f.left {{ text-align: left }} .f.center {{ text-align: center }}
    .m {{ position: absolute; width: 4mm; height: 4mm; background: #000 }}
    .box {{ position: absolute; outline: 0.2mm solid #888 }}   /* debug frame of each field */
    """
    parts = ['<div class="clip"><div class="sheet">']
    for (cx, cy) in MARKS:
        parts.append(f'<div class="m" style="left:{cx-2}mm;top:{cy-2}mm"></div>')
    for (i, x, y, w, h, al, pt, tx) in FIELDS:
        if DEBUG: parts.append(f'<div class="box" style="left:{x}mm;top:{y}mm;width:{w}mm;height:{h}mm"></div>')
        parts.append(f'<div class="f {al}" dir="rtl" style="left:{x}mm;top:{y}mm;width:{w}mm;height:{h}mm;line-height:{h}mm;font-size:{pt}pt">{tx}</div>')
    parts.append('</div></div>')
    return f'<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>{css}</style></head><body>{"".join(parts)}</body></html>'

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.set_content(html()); pg.emulate_media(media='print')
    pg.pdf(path=OUT, prefer_css_page_size=True, print_background=True,
           margin=dict(top='0', right='0', bottom='0', left='0'))
    b.close()
print('written')
