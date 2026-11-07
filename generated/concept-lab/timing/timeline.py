"""The timeline of a hit on all 22 rides: the music's own attack against the ride's physical moments.
Reference is measured from the audio, per hit, never a fixed offset. Physics frames are 25 ms, so per-hit values are coarse; medians are not."""
import glob, json, os, subprocess, sys
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); FPS = 40; SR = 22050; HOP = 55; N = 512  # 2.5 ms hop
def onset_env(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(pcm, np.float32); w = np.hanning(N); n = (len(y) - N) // HOP
    fr = np.lib.stride_tricks.sliding_window_view(y, N)[::HOP][:n] * w
    m = np.log1p(1000 * np.abs(np.fft.rfft(fr, axis=1)))
    flux = np.maximum(0, m[3:] - m[:-3]).sum(1)         # rising energy across 7.5 ms
    t = (np.arange(len(flux)) + 1.5) * HOP / SR + N / 2 / SR  # centre of the rise
    return t, flux
rows = []; per = {}
for ride in sorted(glob.glob(f'{ROOT}/generated/music-library-round2/rides/*-s202')):
    song = os.path.basename(ride)[:-5]
    r = json.load(open(glob.glob(ride + '/*-production.json')[0])); e = r['impactEvaluation']
    t, fx = onset_env(f'{ROOT}/productions/{song}/audio.mp3'); s = []
    for m in e['account']['matches']:
        tg = e['targets'][m['target']]; ev = e['events'][m['event']]; tt = tg['frame'] / FPS
        i = np.where(np.abs(t - tt) < 0.09)[0]
        if not len(i): continue
        k = i[np.argmax(fx[i])]; sharp = fx[k] / (np.median(fx[max(0, k - 80):k + 80]) + 1e-6)
        s.append((t[k], sharp, tt, ev['contactStart'] / FPS, ev['onset'] / FPS, ev['peakFrame'] / FPS, ev['strength'], tg.get('impact') or 0))
    a = np.array(s); per[song] = a; rows.append(a)
A = np.vstack(rows); keep = (A[:, 1] > 3) & (A[:, 6] > .25)  # a clear attack in the music, and a hit you can see
B = A[keep]
print(f'{len(A)} matched hits on {len(rows)} rides; {len(B)} with a clear musical attack and real strength')
ms = lambda x: 1000 * x
for name, col in [('spec target (after the jolt)', 2), ('first touch', 3), ('event onset', 4), ('peak jolt frame', 5)]:
    d = ms(B[:, col] - B[:, 0]); q = np.percentile(d, [10, 25, 50, 75, 90])
    print(f'{name:30} minus music attack: median {q[2]:+6.1f} ms   p25–p75 {q[1]:+6.1f}…{q[3]:+6.1f}   p10–p90 {q[0]:+6.1f}…{q[4]:+6.1f}')
med = sorted((float(np.median(ms(a[(a[:,1]>3)&(a[:,6]>.25),3]-a[(a[:,1]>3)&(a[:,6]>.25),0]))), k[:30]) for k, a in per.items())
print('per ride, touch minus attack (median ms):', ' '.join(f'{m:+.0f}' for m, _ in med))
med2 = sorted(float(np.median(ms(a[(a[:,1]>3)&(a[:,6]>.25),5]-a[(a[:,1]>3)&(a[:,6]>.25),0]))) for a in per.values())
print('per ride, peak minus attack (median ms):', ' '.join(f'{m:+.0f}' for m in med2))
d = ms(B[:, 5] - B[:, 3]); print('peak minus touch: median', np.median(d), ' share 0 ms', (d == 0).mean().round(2), ' share ≥50 ms', (d >= 50).mean().round(2))
for lo, hi in [(.25, .5), (.5, .75), (.75, 1.01)]:
    k = (B[:, 6] >= lo) & (B[:, 6] < hi); print(f'strength {lo}–{hi}: n {k.sum()}, touch−attack {np.median(ms(B[k,3]-B[k,0])):+.1f}, peak−attack {np.median(ms(B[k,5]-B[k,0])):+.1f}')
np.save(os.path.join(os.path.dirname(__file__), 'hits.npy'), A)
