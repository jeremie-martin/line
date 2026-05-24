"""
Per-stem onset detection using Demucs-separated audio.

This is the "high-quality" path:
  1. Demucs splits the mix into  drums / bass / vocals / other.
  2. Onset detect each stem independently (no cross-contamination).
  3. The drums stem is further split into three mel bands:
        kick      (<  100 Hz)
        snare     (200 - 2000 Hz)
        hat       (> 4000 Hz)
     Now that the drums are isolated, this banding is unambiguous —
     no bass guitar / vocal leakage into the "kick" band.

All steps are stock librosa idioms.

Run:
    python extract_stems.py

Reads ./stems/htdemucs/audio/{drums,bass,vocals,other}.wav
Writes ./detection_stems.json
"""
from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np

SR = 22050
HOP = 512

STEM_DIR = Path(__file__).parent / "stems" / "htdemucs" / "audio"
OUT_PATH = Path(__file__).parent / "detection_stems.json"

DRUM_BANDS = {
    # name      : (fmin_hz, fmax_hz)
    "kick":  (0,    100),
    "snare": (200,  2000),
    "hat":   (4000, None),  # None ⇒ sr/2
}


def onsets_with_strength(y, sr, hop):
    """Standard onset_detect; return list of {t, strength}."""
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    frames = librosa.onset.onset_detect(
        onset_envelope=oenv, sr=sr, hop_length=hop, units="frames", backtrack=True,
    )
    times = librosa.frames_to_time(frames, sr=sr, hop_length=hop)
    strengths = [float(oenv[min(f, len(oenv) - 1)]) for f in frames]
    return [{"t": float(t), "strength": s} for t, s in zip(times, strengths)], oenv


def band_onsets(y, sr, hop, fmin, fmax):
    """Mel-band restricted onset detection — librosa's onset_strength_multi
    idiom but with explicit Hz cutoffs converted to mel-bin indices."""
    n_mels = 128
    mel_freqs = librosa.mel_frequencies(n_mels=n_mels + 2, fmin=0, fmax=sr / 2)
    lo = int(np.searchsorted(mel_freqs, fmin))
    hi = n_mels if fmax is None else int(np.searchsorted(mel_freqs, fmax))
    if hi <= lo:
        hi = lo + 1
    multi = librosa.onset.onset_strength_multi(
        y=y, sr=sr, hop_length=hop, n_mels=n_mels,
        channels=[0, lo, hi, n_mels],
    )
    # multi[0]=0..lo, multi[1]=lo..hi, multi[2]=hi..n_mels
    band_env = multi[1]
    frames = librosa.onset.onset_detect(
        onset_envelope=band_env, sr=sr, hop_length=hop, units="frames", backtrack=True,
    )
    times = librosa.frames_to_time(frames, sr=sr, hop_length=hop)
    strengths = [float(band_env[min(f, len(band_env) - 1)]) for f in frames]
    return [{"t": float(t), "strength": s} for t, s in zip(times, strengths)]


def normalised_env(arr):
    a = np.asarray(arr, dtype=np.float32)
    a = a / max(float(a.max()), 1e-9)
    return [round(float(v), 4) for v in a.tolist()]


def main():
    print(f"reading stems from {STEM_DIR}")
    stems = {}
    for name in ("drums", "bass", "vocals", "other"):
        path = STEM_DIR / f"{name}.wav"
        y, sr = librosa.load(str(path), sr=SR, mono=True)
        stems[name] = y
        print(f"  {name}: {len(y)/sr:.2f}s")

    duration = max(len(y) / SR for y in stems.values())

    out = {
        "duration": duration,
        "sr": SR,
        "hop_s": HOP / SR,
        "stems": {},
        "drum_bands": {},
    }

    # Whole-stem onsets
    for name, y in stems.items():
        print(f"\n[{name}] onset_detect ...")
        onsets, oenv = onsets_with_strength(y, SR, HOP)
        out["stems"][name] = {
            "onsets": onsets,
            "envelope": normalised_env(oenv),
            "count": len(onsets),
        }
        print(f"  {len(onsets)} onsets ({len(onsets)/duration:.2f}/s)")

    # Drums stem: split into kick / snare / hat by mel band
    y_drums = stems["drums"]
    for name, (fmin, fmax) in DRUM_BANDS.items():
        print(f"\n[drum-band {name}] {fmin}–{fmax or 'top'} Hz ...")
        onsets = band_onsets(y_drums, SR, HOP, fmin, fmax)
        out["drum_bands"][name] = {
            "onsets": onsets,
            "count": len(onsets),
            "band_hz": [fmin, fmax],
        }
        print(f"  {len(onsets)} onsets ({len(onsets)/duration:.2f}/s)")

    OUT_PATH.write_text(json.dumps(out))
    print(f"\nwrote {OUT_PATH} ({OUT_PATH.stat().st_size/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
