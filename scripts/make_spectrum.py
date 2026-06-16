#!/usr/bin/env python3
"""
Extract a per-frame frequency spectrum from an audio file for the Remotion music
visualizer (a symmetric bar display in the vertical overlay).

ffmpeg decodes the mp3 to mono f32 PCM; we STFT it, bin magnitudes into log-spaced
frequency bands, apply a perceptual tilt + normalize + gamma, and smooth over time.
No librosa — just numpy + ffmpeg.

  python3 scripts/make_spectrum.py --audio=beats/tiki_tiki_48s.mp3 \
      --out=remotion/public/tiki_t10_r01_s36_vert.spectrum.json [--fps=30] [--bands=56]

Output JSON: { "fps", "bands", "frames": [[b0..bN-1 in 0..1], ...] }.
"""
import argparse, json, subprocess, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--audio", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--bands", type=int, default=56)
ap.add_argument("--sr", type=int, default=22050)
ap.add_argument("--fmin", type=float, default=40.0)
ap.add_argument("--fmax", type=float, default=10000.0)
a = ap.parse_args()

# decode to mono float32 PCM
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", a.audio, "-ac", "1", "-ar", str(a.sr), "-f", "f32le", "-"],
    stdout=subprocess.PIPE, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
if x.size == 0:
    sys.exit("no audio decoded")

N = 2048                                   # STFT window
win = np.hanning(N).astype(np.float32)
hop = a.sr / a.fps                          # samples per video frame
nframes = int(np.ceil(x.size / hop))
freqs = np.fft.rfftfreq(N, 1.0 / a.sr)

# log-spaced band edges -> index ranges into the rfft bins. Low bands are narrower
# than the FFT bin spacing (sr/N Hz), so some contain ZERO bins; those fall back to
# interpolating the magnitude at the band's geometric-center freq (else they'd be
# stuck at 0 — the "bars 2/3/6/10 always minimal" bug).
edges = np.geomspace(a.fmin, a.fmax, a.bands + 1)
centers = np.sqrt(edges[:-1] * edges[1:])
bin_idx = [np.where((freqs >= edges[b]) & (freqs < edges[b + 1]))[0] for b in range(a.bands)]
tilt = np.sqrt(np.maximum(freqs, 1.0))     # lift highs (pink-ish compensation)

spec = np.zeros((nframes, a.bands), dtype=np.float32)
for f in range(nframes):
    c = int(f * hop)
    lo = c - N // 2
    seg = np.zeros(N, dtype=np.float32)
    s0, s1 = max(0, lo), min(x.size, lo + N)
    if s1 > s0:
        seg[s0 - lo:s1 - lo] = x[s0:s1]
    mag = np.abs(np.fft.rfft(seg * win)) * tilt
    for b, idx in enumerate(bin_idx):
        spec[f, b] = mag[idx].mean() if idx.size else float(np.interp(centers[b], freqs, mag))

# perceptual: sqrt compress, normalize to a high percentile, gamma, clip
spec = np.sqrt(spec)
norm = np.percentile(spec, 99.0)
if norm > 0:
    spec /= norm
spec = np.clip(spec, 0.0, 1.0) ** 0.65

# temporal smoothing (EMA, attack faster than release for snappy-but-smooth bars)
sm = np.zeros_like(spec)
prev = np.zeros(a.bands, dtype=np.float32)
for f in range(nframes):
    cur = spec[f]
    rise = cur > prev
    prev = np.where(rise, 0.55 * prev + 0.45 * cur, 0.78 * prev + 0.22 * cur)
    sm[f] = prev

out = {"fps": a.fps, "bands": a.bands,
       "frames": [[round(float(v), 4) for v in row] for row in sm]}
with open(a.out, "w") as fh:
    json.dump(out, fh)
print(f"wrote {a.out}  {nframes} frames x {a.bands} bands  ({len(raw)//4} samples @ {a.sr}Hz)")
