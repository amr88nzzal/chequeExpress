"""Geometry test for the cheque PDF spike. Rasterises at 300 dpi and checks positions in mm."""
import os, subprocess, re, sys
import numpy as np
from PIL import Image

DPI = 300
PX_MM = DPI / 25.4
W_MM, H_MM = 175.0, 93.0
exec(open('spike.py').read().split('def html')[0].split('words = ')[0].replace('import json, subprocess, sys\nfrom playwright.sync_api import sync_playwright\n',''))  # constants only
import json
words = json.load(open('words.json'))
src = open('spike.py').read()
FIELDS_SRC = src[src.index('FIELDS = ['):src.index('# vector reference marks')]
exec(FIELDS_SRC)
MARKS = [(5, 5), (W_MM - 5, 5), (5, H_MM - 5), (W_MM - 5, H_MM - 5)]

def render(out, dx=0.0, dy=0.0):
    env = dict(os.environ, DEBUG='0', OUT=out, DX=str(dx), DY=str(dy))
    subprocess.run([sys.executable, 'spike.py'], check=True, env=env, capture_output=True)
    subprocess.run(['pdftoppm', '-r', str(DPI), '-gray', '-png', '-singlefile', out, out[:-4]], check=True)
    return np.array(Image.open(out[:-4] + '.png').convert('L')) < 128   # True = ink

def bbox(ink, x0, y0, x1, y1):
    """ink bbox (mm) inside a window given in mm; None if empty"""
    a, b, c, d = [int(round(v * PX_MM)) for v in (x0, y0, x1, y1)]
    sub = ink[max(b, 0):d, max(a, 0):c]
    ys, xs = np.where(sub)
    if len(xs) == 0: return None
    return ((xs.min() + max(a, 0)) / PX_MM, (ys.min() + max(b, 0)) / PX_MM,
            (xs.max() + 1 + max(a, 0)) / PX_MM, (ys.max() + 1 + max(b, 0)) / PX_MM)

results = []
def check(name, ok, detail=''):
    results.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))

ink = render('t0.pdf')
# --- page size
info = subprocess.run(['pdfinfo', 't0.pdf'], capture_output=True, text=True).stdout
m = re.search(r'Page size:\s+([\d.]+) x ([\d.]+) pts', info)
pw, ph = float(m.group(1)) / 72 * 25.4, float(m.group(2)) / 72 * 25.4
check('page size within 0.3 mm of the requested cheque size', abs(pw - W_MM) <= 0.3 and abs(ph - H_MM) <= 0.3, f'{pw:.2f} x {ph:.2f} mm vs {W_MM} x {H_MM}')

# --- reference marks (4 mm squares) at their exact positions
for (cx, cy) in MARKS:
    bb = bbox(ink, cx - 4, cy - 4, cx + 4, cy + 4)
    mx, my = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    check(f'mark ({cx},{cy}) within 0.2 mm', abs(mx - cx) <= 0.2 and abs(my - cy) <= 0.2, f'measured ({mx:.2f},{my:.2f}) size {bb[2]-bb[0]:.2f}x{bb[3]-bb[1]:.2f}')

# --- printer-profile offset moves everything by exactly dx, dy
DXm, DYm = 1.5, -0.8
ink2 = render('t1.pdf', DXm, DYm)
for (cx, cy) in MARKS[:2]:
    bb = bbox(ink2, cx - 4 + DXm, cy - 4 + DYm if cy > 5 else 0, cx + 4 + DXm, cy + 4 + DYm)
    if bb is None:
        check(f'offset mark ({cx},{cy}) visible', False); continue
    mx, my = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    check(f'offset (+{DXm}, {DYm}) applied to mark ({cx},{cy}) within 0.2 mm', abs(mx - (cx + DXm)) <= 0.2 and abs(my - (cy + DYm)) <= 0.2, f'measured ({mx:.2f},{my:.2f})')

# --- text fields: inside their box, and aligned to the requested edge
for (fid, x, y, w, h, al, pt, tx) in FIELDS:
    bb = bbox(ink, x - 0.8, y - 0.8, x + w + 0.8, y + h + 0.8)
    if bb is None:
        check(f'{fid}: has ink', False); continue
    inside = bb[0] >= x - 0.3 and bb[1] >= y - 0.3 and bb[2] <= x + w + 0.3 and bb[3] <= y + h + 0.3
    check(f'{fid}: ink inside its box (+-0.3 mm)', inside, f'ink x {bb[0]:.1f}..{bb[2]:.1f}  y {bb[1]:.1f}..{bb[3]:.1f}  box x {x}..{x+w} y {y}..{y+h}')
    if al == 'right':  edge = abs(bb[2] - (x + w))
    elif al == 'left': edge = abs(bb[0] - x)
    else:              edge = abs((bb[0] + bb[2]) / 2 - (x + w / 2))
    check(f'{fid}: {al}-aligned within 1.5 mm', edge <= 1.5, f'{edge:.2f} mm')

print(f'\n{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
