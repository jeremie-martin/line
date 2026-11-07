import json, numpy as np
d = json.load(open('analysis/signals.json'))
def gauss(a, sig):
    R = int(3 * sig); k = np.exp(-np.arange(-R, R + 1) ** 2 / (2 * sig * sig)); k /= k.sum()
    return np.convolve(np.pad(a, R, mode='edge'), k, mode='valid')
FS = 10  # signal grid, Hz
def swings(x, frac=.15):
    # direction changes larger than frac of the p5–p95 range, per minute
    rng = np.percentile(x, 95) - np.percentile(x, 5) or 1; th = frac * rng
    n = 0; d0 = 0; ref = x[0]
    for v in x:
        if d0 >= 0 and v > ref: ref = v; d0 = 1 if d0 == 0 else d0
        elif d0 <= 0 and v < ref: ref = v; d0 = -1 if d0 == 0 else d0
        if d0 == 1 and v < ref - th: n += 1; d0 = -1; ref = v
        elif d0 == -1 and v > ref + th: n += 1; d0 = 1; ref = v
    return n / (len(x) / FS / 60)
rows = {s: [] for s in [.5, 1, 2, 3, 4, 6]}
corr = []; drops = {}
for song, r in d.items():
    T = r['n'] / 40; n = int(T * FS); hits = np.array(r['hits'])
    imp = np.zeros(n)
    for t, s, a in hits:
        i = int(t * FS)
        if 0 <= i < n: imp[i] += (0.5 + s) * FS
    for sig in rows:
        rows[sig].append(swings(gauss(imp, sig * FS)))
    L = np.array(r['loud']); L = np.interp(np.arange(n) / FS, np.arange(len(L)) / 30, L)
    corr.append(float(np.corrcoef(gauss(imp, 2 * FS), gauss(L, 2 * FS))[0, 1]))
    # drop: biggest rise of slow loudness across a ±2.5 s gap, relative to the song's range
    S = gauss(L, 1.0 * FS); w = int(2.5 * FS); lo, hi = np.percentile(S, 5), np.percentile(S, 95)
    rise = np.zeros(n)
    rise[w:n - w] = (S[2 * w:] - S[:n - 2 * w]) / max(hi - lo, 1e-6)
    i = int(np.argmax(rise)); t = i / FS
    # sustained: stays above the mid level for how long after the rise
    mid = (lo + hi) / 2; k = i
    while k < n and S[k] > mid: k += 1
    names = [p[1] for p in r['phases'] if abs(p[0] - t) < 3]
    drops[song] = (round(t, 1), round(float(rise[i]), 2), round((k - i) / FS, 1), names)
print('impact-rate swings/min by gaussian sigma (median across songs):')
for s, v in rows.items(): print(f'  sigma {s:>3} s: {np.median(v):5.1f} (p90 {np.percentile(v,90):5.1f})')
print('corr(impact rate, loudness) at sigma 2 s: median %.2f, min %.2f, max %.2f' % (np.median(corr), min(corr), max(corr)))
print('drop candidates: t, rise (× loudness range), sustained s, section near')
for s, v in drops.items(): print(f'  {s[:34]:34} {v}')
