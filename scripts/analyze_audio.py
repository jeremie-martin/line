#!/usr/bin/env python3
"""
analyze_audio.py — a neutral, layered DESCRIPTION of a piece of music.

Design principle (read this before adding anything):

    The analyzer MEASURES. The spec DECIDES. Nothing in between hides a decision.

Every field below is a measurement of what the audio *is* — energy, onsets,
timbre, a tempo/beat hypothesis. None of it is a verdict about what the Line
Rider track *should do* (no "contact", "support", "impact", "is_beat" scores).
Those are authoring choices and they live in the spec, made by a human reading
these layers (ideally in the dashboard, with their ears), under the physical
gap budget. There is no single correct spec for a given song, so the analyzer
must not pretend to compute one — it gives you the evidence to choose well.

Why this shape (the lesson that produced it): a previous analyzer emitted
weighted "contact/event/impact" scores. Those scores quietly baked in the rule
"onset/energy ⇒ beat", and a beat tracker that extrapolates a constant pulse
over a percussion-free intro then produced phantom beats that an author trusted.
The fix is NOT a smarter threshold inside the analyzer (the next song breaks it
the same way). The fix is to surface the raw, corroborating evidence — kick-band
energy, percussive-vs-harmonic split, per-onset band content, and the beat grid
annotated with the measured percussion under each beat — and let the author
judge. For that song the kick band is flat-zero until the real drop; any reader
sees it instantly, with no magic number.

Output layers (all interpretation-neutral):
  - frames.*        continuous envelopes on a shared time grid (energy by band,
                    HPSS percussive/harmonic split, onset strength, novelty),
                    each normalized to the track's own max for that layer.
  - onsets[]        detected onset events, each annotated with measured strength,
                    percussive ratio, and per-band content — so off-grid /
                    syncopated hits are visible, not only the grid.
  - tempo           BPM estimates (madmom + librosa cross-check).
  - beat_grid       the madmom DBN beat HYPOTHESIS — explicitly a hypothesis —
                    with each beat annotated by the MEASURED local percussive /
                    sub-band / onset energy, so extrapolated (percussion-free)
                    beats are obvious.
  - downbeats[]     madmom downbeat hypothesis with bar position.
  - segments[]      timbral/energy segmentation (agglomerative), each summarized
                    by its measured energy profile — structure (intro / drop /
                    breakdown) emerges from the data, not from labels.

Usage:
    /tmp/mm310/bin/python scripts/analyze_audio.py --audio beats/luna_bala_44s.mp3 \
      --out beats/luna_bala_44s.audio.json
    # add --window 0:9 to print a finer console table for a region

Dependencies: the madmom + librosa stack in /tmp/mm310 (see docs).
"""
from __future__ import annotations

import argparse
import collections
import collections.abc
import json
import math
import warnings
from pathlib import Path
from typing import Any

# madmom compatibility on modern Python/numpy.
for _name in [
    "MutableSequence", "MutableMapping", "Mapping", "Sequence", "Callable",
    "Iterable", "MutableSet", "Set", "Hashable",
]:
    if not hasattr(collections, _name):
        setattr(collections, _name, getattr(collections.abc, _name))

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="madmom")

import numpy as np  # noqa: E402

with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=DeprecationWarning)
    for _alias, _real in (
        ("int", int), ("float", float), ("bool", bool), ("object", object), ("complex", complex),
    ):
        if not hasattr(np, _alias):
            setattr(np, _alias, _real)

import librosa  # noqa: E402

SR = 22050
HOP = 512

# Frequency bands (Hz). Descriptive, not magic: "sub" is the kick/bass-drum
# region, the single most useful layer for telling a real beat from a melodic
# onset. The rest split the spectrum into broad, readable regions.
BANDS = {
    "sub": (30.0, 140.0),     # kick / bass-drum fundamental
    "low": (140.0, 400.0),    # bass body, low toms
    "mid": (400.0, 2000.0),   # snare body, vocals, leads
    "high": (2000.0, 8000.0), # hats, cymbals, presence/air
}


def norm_max(values: np.ndarray) -> np.ndarray:
    """Normalize to the track's own max for this layer → [0, 1]. Preserves true
    zeros (a silent band stays 0), so 'no kick here' survives normalization.
    Compare shapes within a track, not absolute levels across tracks/layers."""
    values = np.asarray(values, dtype=float)
    m = float(np.max(values)) if values.size else 0.0
    if not math.isfinite(m) or m <= 1e-12:
        return np.zeros_like(values)
    return np.clip(values / m, 0.0, 1.0)


def r(values: np.ndarray, ndigits: int = 4) -> list[float]:
    return [round(float(x), ndigits) for x in np.asarray(values, dtype=float)]


def sample_at(times: np.ndarray, values: np.ndarray, t: float, win_s: float = 0.06) -> float:
    """Max of `values` within ±win_s of time t (0 if none). Used to read a
    continuous layer's MEASURED value at a discrete event time."""
    if len(values) == 0:
        return 0.0
    m = (times >= t - win_s) & (times <= t + win_s)
    return float(np.max(values[m])) if np.any(m) else 0.0


def band_energy(S: np.ndarray, freqs: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """Mean magnitude across the [lo, hi) Hz bins, per frame."""
    mask = (freqs >= lo) & (freqs < hi)
    if not np.any(mask):
        return np.zeros(S.shape[1], dtype=float)
    return S[mask].mean(axis=0)


def median_period(times: np.ndarray) -> float | None:
    if len(times) < 2:
        return None
    diffs = np.diff(times)
    diffs = diffs[np.isfinite(diffs) & (diffs > 0)]
    return float(np.median(diffs)) if len(diffs) else None


# ─────────────────────────── continuous layers ───────────────────────────

def analyze_frames(y: np.ndarray, sr: int, hop: int) -> dict[str, np.ndarray]:
    """All continuous envelopes on one shared frame grid."""
    S = np.abs(librosa.stft(y, hop_length=hop, n_fft=2048))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    n = S.shape[1]
    times = librosa.frames_to_time(np.arange(n), sr=sr, hop_length=hop)

    rms = librosa.feature.rms(S=S, hop_length=hop)[0]

    # Harmonic/percussive source separation: the layer that distinguishes a
    # drum hit from a sustained/melodic onset.
    y_harm, y_perc = librosa.effects.hpss(y, margin=3.0)
    rms_h = librosa.feature.rms(y=y_harm, hop_length=hop)[0]
    rms_p = librosa.feature.rms(y=y_perc, hop_length=hop)[0]
    n = min(n, len(rms), len(rms_h), len(rms_p))

    perc_ratio = rms_p[:n] / np.maximum(rms_p[:n] + rms_h[:n], 1e-9)

    bands = {name: band_energy(S, freqs, lo, hi)[:n] for name, (lo, hi) in BANDS.items()}

    onset_full = librosa.onset.onset_strength(S=librosa.power_to_db(S**2), sr=sr, hop_length=hop)[:n]
    onset_perc = librosa.onset.onset_strength(y=y_perc, sr=sr, hop_length=hop)[:n]

    # Structural novelty: how fast the timbre is changing (peaks ≈ section edges).
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)[:, :n]
    mfcc_z = librosa.util.normalize(mfcc, axis=1)
    novelty = np.sqrt(np.sum(np.diff(mfcc_z, axis=1, prepend=mfcc_z[:, :1]) ** 2, axis=0))

    return {
        "times": times[:n],
        "rms": norm_max(rms[:n]),
        "percussive_rms": norm_max(rms_p[:n]),
        "harmonic_rms": norm_max(rms_h[:n]),
        "percussive_ratio": np.clip(perc_ratio, 0.0, 1.0),
        "band_sub": norm_max(bands["sub"]),
        "band_low": norm_max(bands["low"]),
        "band_mid": norm_max(bands["mid"]),
        "band_high": norm_max(bands["high"]),
        "onset_strength": norm_max(onset_full),
        "onset_strength_percussive": norm_max(onset_perc),
        "novelty": norm_max(novelty),
        # kept raw (un-normalized) for source attribution math below
        "_y_perc": y_perc,
    }


# ─────────────────────────── discrete onsets ───────────────────────────

def analyze_onsets(frames: dict[str, np.ndarray], sr: int, hop: int) -> list[dict[str, Any]]:
    """Detected onset events, each annotated with MEASURED attributes only:
    strength, percussive ratio, and per-band content at that instant."""
    times = frames["times"]
    onset_env = frames["onset_strength"]
    peaks = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, hop_length=hop,
        backtrack=False, units="frames",
    )
    out: list[dict[str, Any]] = []
    for f in peaks:
        f = int(f)
        if f >= len(times):
            continue
        t = float(times[f])
        bands = {b: round(float(frames[f"band_{b}"][f]), 4) for b in BANDS}
        out.append({
            "t": round(t, 3),
            "strength": round(float(onset_env[f]), 4),
            "percussive_ratio": round(float(frames["percussive_ratio"][f]), 4),
            "bands": bands,
        })
    return out


# ─────────────────────────── beat / downbeat hypothesis ───────────────────────────

def analyze_beats(audio: Path, duration: float, frames: dict[str, np.ndarray]) -> dict[str, Any]:
    """madmom DBN beat + downbeat HYPOTHESIS, annotated with the measured local
    percussion under each beat. The hypothesis extrapolates a roughly constant
    pulse and WILL place beats where there is no percussion — the annotations
    make that visible; they are facts, not a beat/no-beat ruling."""
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor

    times = frames["times"]

    beat_act = RNNBeatProcessor()(str(audio))
    beats = DBNBeatTrackingProcessor(fps=100)(beat_act)
    beats = np.asarray([b for b in beats if 0.0 <= b <= duration], dtype=float)

    db_act = RNNDownBeatProcessor()(str(audio))
    downbeats = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)(db_act)
    # downbeats: array of [time, beat_position_in_bar]
    db_times = np.asarray([row[0] for row in downbeats if 0.0 <= row[0] <= duration], dtype=float)
    db_pos = {round(float(row[0]), 2): int(row[1]) for row in downbeats if 0.0 <= row[0] <= duration}

    def meter_pos_for(t: float) -> int | None:
        i, best = None, 1e9
        for dt, pos in db_pos.items():
            d = abs(dt - t)
            if d < best:
                best, i = d, pos
        return i if best <= 0.10 else None

    beat_rows = []
    for t in beats:
        beat_rows.append({
            "t": round(float(t), 3),
            "meter_pos": meter_pos_for(float(t)),
            # MEASURED local evidence under this hypothesized beat:
            "percussive": round(sample_at(times, frames["percussive_rms"], float(t)), 4),
            "band_sub": round(sample_at(times, frames["band_sub"], float(t)), 4),
            "onset_strength": round(sample_at(times, frames["onset_strength"], float(t)), 4),
            "harmonic": round(sample_at(times, frames["harmonic_rms"], float(t)), 4),
        })

    period = median_period(beats)
    return {
        "note": (
            "HYPOTHESIS from madmom DBN beat tracking. It models a roughly constant "
            "pulse and extrapolates beats through sections with little or no "
            "percussion. Cross-check each beat's measured `percussive` / `band_sub` "
            "before treating it as a real landing — beats sitting on ~0 percussion "
            "are extrapolated, not played."
        ),
        "period_s": round(period, 4) if period else None,
        "bpm": round(60.0 / period, 2) if period else None,
        "beats": beat_rows,
        "downbeats": [round(float(t), 3) for t in db_times],
    }


# ─────────────────────────── structure ───────────────────────────

def analyze_segments(frames: dict[str, np.ndarray], sr: int, hop: int, target: int) -> list[dict[str, Any]]:
    """Timbral/energy segmentation (agglomerative on MFCC + band energies). Each
    segment is summarized by its measured mean energy profile, so structure
    (intro vs drop vs breakdown) is read off the data, not assigned by label."""
    times = frames["times"]
    n = len(times)
    if n < 8:
        return []
    stack = np.vstack([
        frames["rms"], frames["percussive_rms"], frames["harmonic_rms"],
        frames["band_sub"], frames["band_low"], frames["band_mid"], frames["band_high"],
    ])
    k = int(max(2, min(target, n // 8)))
    bounds = librosa.segment.agglomerative(stack, k)
    bound_frames = sorted(set([0] + [int(b) for b in bounds] + [n]))

    segs: list[dict[str, Any]] = []
    for a, b in zip(bound_frames[:-1], bound_frames[1:]):
        if b <= a:
            continue
        sl = slice(a, b)
        segs.append({
            "t0": round(float(times[a]), 3),
            "t1": round(float(times[min(b, n - 1)]), 3),
            "mean_rms": round(float(np.mean(frames["rms"][sl])), 4),
            "mean_percussive": round(float(np.mean(frames["percussive_rms"][sl])), 4),
            "mean_harmonic": round(float(np.mean(frames["harmonic_rms"][sl])), 4),
            "mean_band_sub": round(float(np.mean(frames["band_sub"][sl])), 4),
            "mean_band_high": round(float(np.mean(frames["band_high"][sl])), 4),
            "onset_density_hz": round(float(np.mean(frames["onset_strength_percussive"][sl])), 4),
        })
    return segs


# ─────────────────────────── driver ───────────────────────────

def analyze(audio: Path, duration: float | None, sr: int, hop: int, segments: int) -> dict[str, Any]:
    print(f"loading {audio} ...")
    y, sr = librosa.load(str(audio), sr=sr, mono=True, duration=duration)
    dur = float(len(y) / sr)
    print(f"  {dur:.2f}s @ {sr} Hz")

    print("continuous layers (energy bands, HPSS, onsets, novelty) ...")
    frames = analyze_frames(y, sr, hop)
    frames.pop("_y_perc", None)

    print("onset events ...")
    onsets = analyze_onsets(frames, sr, hop)

    print("beat / downbeat hypothesis (madmom) ...")
    beat_grid = analyze_beats(audio, dur, frames)

    print("structure segmentation ...")
    segs = analyze_segments(frames, sr, hop, segments)

    # librosa tempo cross-check (API moved across librosa versions)
    _tempo_fn = getattr(getattr(librosa.feature, "rhythm", None), "tempo", None) \
        or getattr(librosa.beat, "tempo", None)
    lib_tempo = float(np.atleast_1d(
        _tempo_fn(onset_envelope=frames["onset_strength"], sr=sr, hop_length=hop)
    )[0]) if _tempo_fn else 0.0

    times = frames["times"]
    fps = sr / hop
    return {
        "audio": str(audio),
        "duration": round(dur, 3),
        "sample_rate": sr,
        "analysis": {"frame_rate_hz": round(fps, 4), "hop": hop, "n_frames": int(len(times))},
        "tempo": {
            "madmom_bpm": beat_grid["bpm"],
            "librosa_bpm": round(lib_tempo, 2),
            "period_s": beat_grid["period_s"],
        },
        "frames": {
            "times": r(times, 3),
            "rms": r(frames["rms"]),
            "percussive_rms": r(frames["percussive_rms"]),
            "harmonic_rms": r(frames["harmonic_rms"]),
            "percussive_ratio": r(frames["percussive_ratio"]),
            "band_sub": r(frames["band_sub"]),
            "band_low": r(frames["band_low"]),
            "band_mid": r(frames["band_mid"]),
            "band_high": r(frames["band_high"]),
            "onset_strength": r(frames["onset_strength"]),
            "onset_strength_percussive": r(frames["onset_strength_percussive"]),
            "novelty": r(frames["novelty"]),
        },
        "onsets": onsets,
        "beat_grid": beat_grid,
        "segments": segs,
    }


def parse_window(window: str | None) -> tuple[float, float] | None:
    if not window:
        return None
    a, b = window.split(":")
    return float(a), float(b)


def print_summary(result: dict[str, Any], window: tuple[float, float] | None) -> None:
    t = result["tempo"]
    print(f"\ntempo: madmom {t['madmom_bpm']} BPM / librosa {t['librosa_bpm']} BPM "
          f"(period {t['period_s']}s)")

    print("\n=== SEGMENTS (timbral/energy; structure emerges from the data) ===")
    print(f"{'t0':>6} {'t1':>6} {'rms':>5} {'perc':>5} {'harm':>5} {'sub':>5} {'high':>5} {'pOns':>5}")
    for s in result["segments"]:
        print(f"{s['t0']:>6.2f} {s['t1']:>6.2f} {s['mean_rms']:>5.2f} {s['mean_percussive']:>5.2f} "
              f"{s['mean_harmonic']:>5.2f} {s['mean_band_sub']:>5.2f} {s['mean_band_high']:>5.2f} "
              f"{s['onset_density_hz']:>5.2f}")

    # Per-0.5s continuous read of the most diagnostic layers.
    fr = result["frames"]
    times = np.asarray(fr["times"])
    lo, hi = window if window else (0.0, result["duration"])
    print(f"\n=== ENERGY LAYERS, 0.5s means {lo:.1f}-{hi:.1f}s "
          f"(rms / percussive / sub-kick / harmonic / onset%) ===")
    print(f"{'t':>5} {'rms':>5} {'perc':>5} {'sub':>5} {'harm':>5} {'pOns':>5}")
    for b in np.arange(lo, hi, 0.5):
        m = (times >= b) & (times < b + 0.5)
        if not np.any(m):
            continue
        def mean(k: str) -> float:
            return float(np.mean(np.asarray(fr[k])[m]))
        print(f"{b:>5.1f} {mean('rms'):>5.2f} {mean('percussive_rms'):>5.2f} "
              f"{mean('band_sub'):>5.2f} {mean('harmonic_rms'):>5.2f} "
              f"{mean('onset_strength_percussive'):>5.2f}")

    print("\n=== BEAT GRID (HYPOTHESIS — measured percussion under each beat) ===")
    print("    a beat with ~0 `sub`/`perc` is extrapolated pulse, not a played beat")
    print(f"{'t':>6} {'pos':>3} {'perc':>5} {'sub':>5} {'onset':>5} {'harm':>5}")
    for beat in result["beat_grid"]["beats"]:
        if window and not (lo <= beat["t"] <= hi):
            continue
        print(f"{beat['t']:>6.2f} {str(beat['meter_pos']):>3} {beat['percussive']:>5.2f} "
              f"{beat['band_sub']:>5.2f} {beat['onset_strength']:>5.2f} {beat['harmonic']:>5.2f}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audio", required=True, help="audio file to analyze")
    ap.add_argument("--out", help="output JSON path (default: <audio>.audio.json)")
    ap.add_argument("--duration", type=float, help="seconds to analyze from the start")
    ap.add_argument("--sr", type=int, default=SR, help=f"resample rate (default {SR})")
    ap.add_argument("--hop", type=int, default=HOP, help=f"STFT hop (default {HOP})")
    ap.add_argument("--segments", type=int, default=12, help="target number of structural segments")
    ap.add_argument("--window", help="print finer console tables for START:END seconds only")
    ap.add_argument("--json-only", action="store_true", help="suppress console summary")
    args = ap.parse_args()

    audio = Path(args.audio)
    out = Path(args.out) if args.out else audio.with_suffix(".audio.json")
    result = analyze(audio, args.duration, args.sr, args.hop, args.segments)

    out.write_text(json.dumps(result, indent=1))
    size_kb = out.stat().st_size / 1024
    print(f"\nwrote {out}  ({size_kb:.1f} KiB)")

    if not args.json_only:
        print_summary(result, parse_window(args.window))


if __name__ == "__main__":
    main()
