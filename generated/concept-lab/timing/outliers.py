import glob, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
src = open(os.path.join(os.path.dirname(__file__), 'timeline.py')).read().split('rows = []; per = {}')[0]
exec(src)
out = []
for ride in sorted(glob.glob(f'{ROOT}/generated/music-library-round2/rides/*-s202')):
    song = os.path.basename(ride)[:-5]; r = json.load(open(glob.glob(ride + '/*-production.json')[0])); e = r['impactEvaluation']
    t, fx = onset_env(f'{ROOT}/productions/{song}/audio.mp3')
    # the song's global offset, independent of any per-hit choice: slide the target comb across the onset curve and take the best lag
    tg = np.array([x['frame'] / FPS for x in e['targets'] if (x.get('impact') or 0) > .4]); lags = np.arange(-.12, .1201, .0025)
    fxs = fx / np.median(fx[fx > 0]); score = [np.mean(np.minimum(np.interp(tg - l, t, fxs), 30)) for l in lags]
    best = lags[int(np.argmax(score))]; peak = max(score) / np.median(score)
    tc = []; ta = []
    for m in e['account']['matches']:
        g = e['targets'][m['target']]; ev = e['events'][m['event']]; tt = g['frame'] / FPS
        if ev['strength'] < .25: continue
        i = np.where(np.abs(t - tt) < .09)[0]
        if not len(i): continue
        k = i[np.argmax(fx[i])]
        if fx[k] / (np.median(fx[max(0, k - 80):k + 80]) + 1e-6) > 3: tc.append(ev['contactStart'] / FPS - t[k]); ta.append(tt - t[k])
    out.append((song, 1000 * np.median(tc), 1000 * np.median(ta), 1000 * -best, peak, len(tc)))
out.sort(key=lambda x: x[1])
print('song                                      touch−attack  target−attack  comb lag (target−audio)  comb sharpness  n')
for s, a, b, c, p, n in out: print(f'{s[:40]:40} {a:+9.1f}    {b:+9.1f}      {c:+9.1f}              {p:6.2f}      {n}')
