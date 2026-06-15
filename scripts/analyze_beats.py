#!/usr/bin/env python3
"""
Minimal music → beat map for Line Rider specs.

The clean, single-purpose alternative to analyze_rhythm.py (which is a heavy
madmom pipeline producing a 9-score grid + transient layer). This does just
what we need to "get the beats right":

  - librosa beat tracking  → a steady tempo grid (the 4/4 pulse)
  - onset-strength + RMS    → a per-beat intensity in [0,1] (impact hint)
  - optional click track    → beats mixed over the audio for EAR validation

Output is a small, human-readable JSON: { audio, duration, tempo_bpm,
beats: [{t, strength}] }. We author the actual spec contacts FROM this by
musical judgment — the map is a scaffold, not the source of truth.

  python analyze_beats.py --audio cut.wav --out cut.beatmap.json \
      [--clicks cut.clicks.wav] [--min-gap 0.0] [--sr 22050]
"""
import argparse
import json

import numpy as np
import librosa


def sample_at(times, vals, t, win=0.05):
    """Max of `vals` within ±win seconds of t (0 if none)."""
    m = (times >= t - win) & (times <= t + win)
    return float(vals[m].max()) if m.any() else 0.0


def normalize(a):
    """Robust [0,1] scaling by the 95th percentile (resists outliers)."""
    if len(a) == 0:
        return a
    p = float(np.percentile(a, 95))
    return np.clip(a / (p if p > 0 else 1.0), 0.0, 1.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--clicks", default=None, help="write beats-over-audio wav for ear validation")
    ap.add_argument("--min-gap", type=float, default=0.0, help="drop the weaker of any beat pair closer than this (s)")
    ap.add_argument("--sr", type=int, default=22050)
    args = ap.parse_args()

    y, sr = librosa.load(args.audio, sr=args.sr, mono=True)
    dur = len(y) / sr

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    tempo = float(np.atleast_1d(tempo).ravel()[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_t = librosa.times_like(onset_env, sr=sr)
    rms = librosa.feature.rms(y=y)[0]
    rms_t = librosa.times_like(rms, sr=sr)

    on = normalize(np.array([sample_at(onset_t, onset_env, t) for t in beat_times]))
    rm = normalize(np.array([sample_at(rms_t, rms, t) for t in beat_times]))
    strength = np.round(0.6 * on + 0.4 * rm, 3)  # simple, transparent blend

    # optional min-gap guard (keep the stronger of any too-close pair)
    keep = []
    for i, t in enumerate(beat_times):
        if args.min_gap > 0 and keep and (t - beat_times[keep[-1]]) < args.min_gap:
            if strength[i] > strength[keep[-1]]:
                keep[-1] = i
            continue
        keep.append(i)
    sel = list(keep)

    beats = [{"t": round(float(beat_times[i]), 3), "strength": float(strength[i])} for i in sel]
    json.dump(
        {"audio": args.audio, "duration": round(dur, 3), "tempo_bpm": round(tempo, 1), "beats": beats},
        open(args.out, "w"),
        indent=2,
    )

    gaps = np.diff([beat_times[i] for i in sel]) if len(sel) > 1 else np.array([0.0])
    print(
        f"tempo {tempo:.1f} BPM | {len(sel)} beats over {dur:.1f}s "
        f"(~{len(sel)/dur:.2f}/s) | gap min {gaps.min():.2f}s med {np.median(gaps):.2f}s max {gaps.max():.2f}s"
    )
    print(f"beatmap → {args.out}")

    if args.clicks:
        import soundfile as sf
        click = librosa.clicks(times=[beat_times[i] for i in sel], sr=sr, length=len(y), click_freq=2000.0)
        mix = 0.7 * (y / (np.abs(y).max() or 1.0)) + 0.6 * click
        sf.write(args.clicks, np.clip(mix, -1, 1), sr)
        print(f"clicks → {args.clicks}")


if __name__ == "__main__":
    main()
