"""What each geometry delivers on saved rides (report only): for every gap,
its realized geometry (family, and whether the upper rail was touched) and
length; the catch it builds at its start (the hit of the beat there: strength
error, early share) and the airtime over the gap against its ask.
python3 tools/research/geometry_map.py ARM_DIR"""
import json, glob, sys, statistics as st, collections as C
arm = sys.argv[1]
by = C.defaultdict(lambda: {'n': 0, 'err': [], 'early': 0, 'hits': 0, 'air': [], 'airhigh': []})
for f in glob.glob(arm + '/cells/*[0-9].json'):
    c = json.load(open(f))
    if c['case']['bench']['stratum'] in ('E', 'H') or not c.get('geometry'): continue
    secs, beats = c['geometry']['sections'], c['impact3']['perBeat']
    air = {g: (t, a) for g, ax, t, a in c['gaps'] if ax == 'air' and a is not None}
    for i, s in enumerate(secs):
        if i == 0: continue
        L = s['frames']; band = '<12' if L < 12 else '12-23' if L < 24 else '24-39' if L < 40 else '40+'
        k = (s['family'] + ('+rail' if s['guideFrames'] > 0 else ''), band); d = by[k]; d['n'] += 1
        b = beats[i - 1] if i - 1 < len(beats) else None
        if b and b['hit'] and b['requested'] is not None:
            d['hits'] += 1; d['err'].append(b['hit']['strength'] - b['requested']); d['early'] += b['hit']['offset'] == -1
        if i in air:
            t, a = air[i]; d['air'].append(a - t)
            if t >= .75: d['airhigh'].append(a - t)
fams = sorted({k[0] for k in by}); bands = ['<12', '12-23', '24-39', '40+']
print('cells: gaps | catch strength error | early | air error (all asks) | air error (asks >= 0.75)')
for fam in fams:
    print(fam)
    for band in bands:
        d = by.get((fam, band))
        if not d or d['n'] < 20: continue
        m = lambda xs: f"{st.mean(xs):+.3f}" if len(xs) >= 10 else '   —  '
        print(f"  {band:6s} {d['n']:5d} | {m(d['err'])} | {d['early'] / max(1, d['hits']):5.1%} | {m(d['air'])} | {m(d['airhigh'])} (n={len(d['airhigh'])})")
