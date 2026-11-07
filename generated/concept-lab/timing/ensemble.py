"""Time-locked average of the sound around every strong hit, aligned on first touch. Needs no onset detector: the rise is simply where it is."""
import glob, json, os, subprocess
import numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); FPS = 40; SR = 44100
SONGS = ['los_voltaje_selection', 'los_voltaje_slowed_selection', 'los_voltaje_ultra_slowed_selection', 'montagem_coma_selection', 'petrunko_selection', 'no_batidao_selection', 'lua_na_praca_selection', 'passo_bem_solto_selection']
fig, ax = plt.subplots(2, 4, figsize=(15, 6)); res = []
lo = (-.12, .12)
for a, song in zip(ax.flat, SONGS):
    ride = glob.glob(f'{ROOT}/generated/music-library-round2/rides/{song}-s*')[0]; r = json.load(open(glob.glob(ride + '/*-production.json')[0])); e = r['impactEvaluation']
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{ROOT}/productions/{song}/audio.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(pcm, np.float32); env = np.sqrt(np.convolve(y * y, np.ones(44) / 44, 'same'))  # 1 ms RMS
    bands = {'full': env}
    # low band alone: the kick
    k = np.fft.rfft(y); f = np.fft.rfftfreq(len(y), 1 / SR); l = np.fft.irfft(k * (f < 200), len(y)); h = np.fft.irfft(k * (f > 2000), len(y))
    bands['<200 Hz'] = np.sqrt(np.convolve(l * l, np.ones(44) / 44, 'same')); bands['>2 kHz'] = np.sqrt(np.convolve(h * h, np.ones(44) / 44, 'same'))
    t = np.arange(int(lo[0] * SR), int(lo[1] * SR)) / SR * 1000; line = {}
    for name, ev0 in bands.items():
        st = []
        for m in e['account']['matches']:
            ev = e['events'][m['event']]
            if ev['strength'] < .4: continue
            c = int(ev['contactStart'] / FPS * SR)
            if c + int(lo[0] * SR) < 0 or c + int(lo[1] * SR) >= len(y): continue
            w = ev0[c + int(lo[0] * SR):c + int(lo[1] * SR)]; st.append(w / (w.max() + 1e-9))
        M = np.mean(st, 0); M = (M - M[:200].min()) / (M.max() - M[:200].min()); line[name] = M
        half = t[np.argmax(M >= .5)]; a.plot(t, M, label=f'{name}: half at {half:+.0f} ms'); res.append((song, name, half, len(st)))
    a.axvline(0, color='k', lw=1); a.set_title(song[:30], fontsize=9, loc='left'); a.legend(fontsize=7)
plt.tight_layout(); plt.savefig(os.path.join(os.path.dirname(__file__), 'ensemble.png'), dpi=65)
for s, n, h, c in res: print(f'{s[:36]:36} {n:8} half-rise {h:+6.1f} ms relative to first touch (n {c})')
