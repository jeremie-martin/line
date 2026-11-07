"""Characterize candidate driving signals across all selection songs (saved rides, s202).
Output: analysis/signals.json, one record per song, and a printed table."""
import glob, json, os, subprocess, sys
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
FPS = 40
songs = sorted(d.split('/')[-1][:-5] for d in glob.glob(f'{ROOT}/generated/music-library-round2/rides/*-s202'))
out = {}
for song in songs:
    rec = json.load(open(glob.glob(f'{ROOT}/generated/music-library-round2/rides/{song}-s202/*-production.json')[0]))
    frames = np.array(rec['trace']['frames'], dtype=float)
    cx = frames[:, 0::2].mean(1); cy = frames[:, 1::2].mean(1)
    vx = np.gradient(cx) * FPS; vy = np.gradient(cy) * FPS; speed = np.hypot(vx, vy)
    ev = rec['impactEvaluation']; matches = {m['target']: m for m in ev['account']['matches']}
    hits = []
    for i, t in enumerate(ev['targets']):
        m = matches.get(i)
        if m is not None:
            e = ev['events'][m['event']]; hits.append((e['onset'] / FPS, e['strength'], t.get('impact') or 0))
    hits = np.array(hits)
    spath = f'{ROOT}/generated/concept-lab/data/{song}.spectrum.json'
    if not os.path.exists(spath):
        subprocess.run([sys.executable, f'{ROOT}/scripts/make_spectrum.py', f'--audio={ROOT}/productions/{song}/audio.mp3', f'--out={spath}'], check=True, capture_output=True)
    sp = json.load(open(spath)); S = np.array(sp['frames'])
    comp = json.load(open(f'{ROOT}/productions/{song}/composition.json'))
    out[song] = {'n': len(cx), 'vx': vx[::4].round(1).tolist(), 'vy': vy[::4].round(1).tolist(), 'speed': speed[::4].round(1).tolist(),
                 'hits': hits.round(3).tolist(), 'loud': S.mean(1).round(4).tolist(), 'phases': [(p['t'], p['name']) for p in comp['phases']]}
    q = lambda a, p: float(np.percentile(a, p))
    print(f"{song[:34]:34} speed p10/50/90 {q(speed,10):4.0f}/{q(speed,50):4.0f}/{q(speed,90):4.0f}  vx p10/50/90 {q(vx,10):5.0f}/{q(vx,50):4.0f}/{q(vx,90):4.0f}  vy p10/50/90 {q(vy,10):5.0f}/{q(vy,50):4.0f}/{q(vy,90):4.0f}  left-going {100*(vx<-20).mean():4.1f}%  hits/s {len(hits)/(len(cx)/FPS):.2f}")
json.dump(out, open(f'{ROOT}/generated/concept-lab/analysis/signals.json', 'w'))
