import json, numpy as np
d = json.load(open('analysis/signals.json')); FS = 10
def gauss(a, sig):
    R = int(3 * sig); k = np.exp(-np.arange(-R, R + 1) ** 2 / (2 * sig * sig)); k /= k.sum()
    return np.convolve(np.pad(a, R, mode='edge'), k, mode='valid')
for song, r in d.items():
    T = r['n'] / 40; n = int(T * FS); hits = np.array(r['hits'])
    E = np.zeros(n)
    for t, s, a in hits:
        i = int(t * FS)
        if 0 <= i < n: E[i] += s * s * FS          # strong hits count much more than weak ones
    E = gauss(E, 2 * FS)
    L = np.array(r['loud']); L = gauss(np.interp(np.arange(n) / FS, np.arange(len(L)) / 30, L), 2 * FS)
    C = E / E.mean() * 0.6 + L / L.mean() * 0.4      # hit energy with the music's loudness
    th = np.percentile(C, 60)
    # longest run above the 60th percentile
    best = (0, 0); i = 0
    while i < n:
        if C[i] > th:
            j = i
            while j < n and C[j] > th: j += 1
            if j - i > best[1] - best[0]: best = (i, j)
            i = j
        else: i += 1
    a, b = best; inside = C[a:b].mean(); before = C[max(0, a - 50):a].mean() if a > 10 else C.mean(); outside = np.r_[C[:a], C[b:]].mean()
    # snap the start to the strongest hit within ±2 s of the run's start
    near = hits[(hits[:, 0] > a / FS - 2) & (hits[:, 0] < a / FS + 2)]
    t0 = near[np.argmax(near[:, 1]), 0] if len(near) else a / FS
    lens = (b - a) / FS
    contrast = inside / outside
    print(f"{song[:34]:34} span {t0:5.1f}–{b/FS:5.1f} ({lens:4.1f}s of {T:.0f}) in/out {contrast:.2f} in/before {inside/before:.2f}  {[p[1][:16] for p in r['phases'] if t0-3<p[0]<t0+3]}")
