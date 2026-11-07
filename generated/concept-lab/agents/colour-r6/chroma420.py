"""4:2:0 test. For each still in stills/ (and synthetic thin diagonal strokes), encode with x264 yuv420p at
qp 0 (only the chroma subsampling) and crf 30 (a compressed upload stand-in), decode, and report how much of the
ink line's and pencil line's difference from the paper survives (OKLab ΔE, and its chromatic part).
Run: python3 -I chroma420.py  (from this folder; needs ffmpeg, numpy, PIL)"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))

def tokens():
    js = "const {readFileSync}=await import('node:fs');const s=readFileSync('../../lab.js','utf8');const L=Function('return '+s.match(/const SCHEMES = (\\{[\\s\\S]*?\\n\\});/)[1])();const {CANDIDATES}=await import('./schemes.js');console.log(JSON.stringify({...L,...CANDIDATES}))"
    return json.loads(subprocess.run(['/usr/bin/node', '--input-type=module', '-e', js], cwd=HERE, capture_output=True, text=True, check=True).stdout)

def lin(c):
    c = np.asarray(c, float) / 255
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def oklab(c):
    r, g, b = np.moveaxis(lin(c), -1, 0)
    l = np.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b); m = np.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b); s = np.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b)
    return np.stack([.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s], -1)
rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)

def roundtrip(img, tag, crf):
    src, out = f'/tmp/c420-{os.getpid()}-{tag}.png', f'/tmp/c420-{os.getpid()}-{tag}-d.png'
    Image.fromarray(img).save(src)
    q = ['-qp', '0'] if crf == 0 else ['-crf', str(crf)]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:v', 'libx264', *q, '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-f', 'h264', src + '.h264'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src + '.h264', '-vf', 'scale=in_color_matrix=bt709:out_color_matrix=bt709', '-pix_fmt', 'rgb24', out], check=True)
    d = np.array(Image.open(out).convert('RGB'))
    for f in (src, out, src + '.h264'): os.remove(f)
    return d

def retain(src, dec, colour, paper, tol=6):
    """Median over pixels drawn exactly in `colour`: ΔE(decoded, paper)/ΔE(colour, paper), and the same for chroma (a,b) only."""
    m = np.abs(src.astype(int) - rgb(colour)).sum(2) <= tol
    if m.sum() < 20: return None
    P, C, D = oklab(rgb(paper)), oklab(rgb(colour)), oklab(dec[m].astype(float))
    full = np.linalg.norm(D - P, axis=1) / np.linalg.norm(C - P)
    cab = np.linalg.norm(C[1:] - P[1:])
    chrom = np.linalg.norm(D[:, 1:] - P[1:], axis=1) / cab if cab > 0.01 else np.full(len(D), np.nan)
    return float(np.median(full)), float(np.nanmedian(chrom)) if cab > 0.01 else None, int(m.sum())

def synthetic(p, width):
    """Diagonal strokes of `width` px (4x supersampled, then reduced), ink and pencil, on paper."""
    S = 4; im = Image.new('RGB', (480 * S, 480 * S), p['paper']); d = ImageDraw.Draw(im)
    for i in range(6):
        y = (40 + 70 * i) * S
        d.line([(20 * S, y), (460 * S, y + 50 * S)], fill=p['ink' if i % 2 == 0 else 'pencil'], width=int(width * S))
    return np.array(im.resize((480, 480), Image.LANCZOS))

def line_mask_retain(src, dec, colour, paper):
    """For anti-aliased synthetic strokes: pixels within 25 % (ΔE) of the stroke colour in the source."""
    P, C = oklab(rgb(paper)), oklab(rgb(colour)); S = oklab(src.astype(float))
    m = np.linalg.norm(S - C, axis=2) < 0.25 * np.linalg.norm(C - P)
    D = oklab(dec[m].astype(float)); Sm = S[m]
    full = np.median(np.linalg.norm(D - P, axis=1)) / np.median(np.linalg.norm(Sm - P, axis=1))
    cab = np.linalg.norm(C[1:] - P[1:])
    chrom = (np.median(np.linalg.norm(D[:, 1:] - P[1:], axis=1)) / np.median(np.linalg.norm(Sm[:, 1:] - P[1:], axis=1))) if cab > 0.02 else None
    # halo: paper pixels next to the stroke (source exactly paper) that the decode tints; p95 chromatic ΔE
    near = m.copy()
    for _ in range(3): near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    bare = near & (np.linalg.norm(S - P, axis=2) < 0.004)
    halo = float(np.percentile(np.linalg.norm(oklab(dec[bare].astype(float))[:, 1:] - P[1:], axis=1), 95)) if bare.sum() > 20 else 0.0
    return float(full), chrom, halo

if __name__ == '__main__':
    T = tokens(); names = sys.argv[1:] or [k for k in T if os.path.exists(f'{HERE}/stills/{k}-petrunko-20.png')]
    print('scheme      | real still, qp0 / crf30: ink ΔE kept, ink chroma kept, pencil ΔE kept | synthetic 2 px ink ΔE, chroma kept, chroma halo on bare paper p95 (crf30)')
    for k in names:
        p = T[k]; row = [k.ljust(11)]
        f = f'{HERE}/stills/{k}-petrunko-20.png'
        if os.path.exists(f):
            s = np.array(Image.open(f).convert('RGB'))
            for crf in (0, 30):
                dd = roundtrip(s, k, crf); a = retain(s, dd, p['ink'], p['paper']); b = retain(s, dd, p['pencil'], p['paper'])
                fm = lambda v: '  - ' if v is None else f'{100 * v:3.0f}%'
                row.append(f"| {fm(a and a[0])} {fm(a and a[1])} {fm(b and b[0])}")
        s = synthetic(p, 2); dd = roundtrip(s, k + 'syn', 30); a = line_mask_retain(s, dd, p['ink'], p['paper'])
        row.append(f"| {100 * a[0]:3.0f}% {'  -' if a[1] is None else f'{100 * a[1]:3.0f}%'} halo {a[2]:.3f}")
        print(' '.join(row))
