# Run from the repository root: python3 generated/concept-lab/timing/attack.py
"""Where the beat's audible attack sits, relative to an impact's first touch, onset and peak: time-locked averages of the
sound's 1 ms RMS envelope around every answered hit of strength >= 0.4 (no onset detector). Current lab rides."""
import glob, json, subprocess, numpy as np
FPS, SR = 40, 44100
SONGS = {'petrunko': 'petrunko_selection', 'lua': 'lua_na_praca_selection', 'los': 'los_voltaje_selection', 'batidao': 'no_batidao_selection',
         'burn': 'let_the_world_burn_selection', 'coma': 'montagem_coma_selection', 'tomada': 'montagem_tomada_super_slowed_selection', 'circus': 'circus_minimus_77s'}
lo, hi = int(-.12 * SR), int(.12 * SR); t = np.arange(lo, hi) / SR * 1000
tot = {k: [] for k in ('contactStart', 'onset', 'peakFrame')}
for key, song in SONGS.items():
    r = json.load(open(glob.glob(f'generated/concept-lab/rides/{key}/*-production.json')[0])); e = r['impactEvaluation']
    y = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f'productions/{song}/audio.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32)
    env = np.sqrt(np.convolve(y * y, np.ones(44) / 44, 'same')); row = []
    for anchor in tot:
        st = []
        for m in e['account']['matches']:
            ev = e['events'][m['event']]
            if ev['strength'] < .4: continue
            c = int(round(ev[anchor] / FPS * SR))
            if c + lo < 0 or c + hi >= len(y): continue
            w = env[c + lo:c + hi]; st.append(w / (w.max() + 1e-9))
        M = np.mean(st, 0); M = (M - M[:200].min()) / (M.max() - M[:200].min()); half = t[np.argmax(M >= .5)]
        tot[anchor].append(half); row.append(f'{anchor} {half:+6.1f}')
    print(f'{key:9} n {len(st):3}  attack relative to: ' + '  '.join(row) + ' ms')
print('mean over songs: ' + '  '.join(f'{a} {np.mean(v):+.1f} ms (range {min(v):+.0f} to {max(v):+.0f})' for a, v in tot.items()))
