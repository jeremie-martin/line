#!/usr/bin/env python3
"""
v7-consensus ensemble for shelter_81s.mp3 — the "successful" drum-detection
method, faithfully reproduced from beats/extract_{,stems,madmom,quantize} +
extract_consensus.py, but on the 81s shelter cut and writing into
beats/shelter81/ so the existing beats/audio.mp3 (drums/believer) artifacts
are untouched.

Stages (same logic, same constants as the originals):
  1. librosa on the mix  : steady beat grid + percussive drum onsets + bass
     onsets + agglomerative sections.               (extract.py)
  2. librosa on the demucs drums stem : whole-stem onsets + kick/snare/hat
     mel-band onsets.                               (extract_stems.py)
  3. madmom : RNN onsets on mix + drums stem; DBN beats + downbeats (grid).
                                                    (extract_madmom.py)
  4. quantize every stream to 1/16-beat of the madmom grid, ±200 ms tol.
                                                    (extract_quantize.py)
  5. consensus : 5 streams vote (rnn_drums, stem_drums, band_kick, band_snare,
     band_hat), min 3 votes, exact grid-time match. (extract_consensus.py)

Usage:
    /tmp/mm310/bin/python beats/shelter81_ensemble.py
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

# ── compat shims (madmom 0.16.1 vs py3.10) ─────────────────────────────────
import collections
import collections.abc
for _n in ["MutableSequence", "MutableMapping", "Mapping", "Sequence", "Callable",
           "Iterable", "MutableSet", "Set", "Hashable"]:
    if not hasattr(collections, _n):
        setattr(collections, _n, getattr(collections.abc, _n))
import warnings
warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import librosa  # noqa: E402
from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor  # noqa: E402
from madmom.features.onsets import RNNOnsetProcessor, OnsetPeakPickingProcessor  # noqa: E402

# ── constants (mirrors of the originals) ───────────────────────────────────
SR = 22050
HOP = 512
N_MELS = 128
BASS_HZ_MAX = 200.0
DRUM_BANDS = {"kick": (0, 100), "snare": (200, 2000), "hat": (4000, None)}
SUBDIVISION = 4      # 1/16-beat grid
TOL_MS = 200.0       # snap-only tolerance
STREAMS = ["rnn_drums", "stem_drums", "band_kick", "band_snare", "band_hat"]
MIN_VOTES = 3

HERE = Path(__file__).parent
AUDIO = HERE / "shelter_81s.mp3"
DRUMS_STEM = HERE / "shelter81" / "stems" / "htdemucs" / "shelter_81s" / "drums.wav"
OUTDIR = HERE / "shelter81"
DUR = 81.0


# ── stage 1: librosa on the mix (extract.py) ──────────────────────────────
def steady_beat_grid(onset_env, duration):
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=SR, hop_length=HOP, start_bpm=100.0)
    bt = librosa.frames_to_time(beat_frames, sr=SR, hop_length=HOP)
    period = float(np.median(np.diff(bt)))
    pre, t = [], bt[0] - period
    while t > 0:
        pre.append(t); t -= period
    pre.reverse()
    post, t = [], bt[-1] + period
    while t < duration:
        post.append(t); t += period
    return np.concatenate([np.array(pre), bt, np.array(post)]), period


def librosa_mix(y, duration):
    y_harm, y_perc = librosa.effects.hpss(y)
    env = librosa.onset.onset_strength(y=y_perc, sr=SR, hop_length=HOP)
    beat_times, period = steady_beat_grid(env, duration)
    d_frames = librosa.onset.onset_detect(y=y_perc, sr=SR, hop_length=HOP, units="frames", backtrack=True)
    d_times = librosa.frames_to_time(d_frames, sr=SR, hop_length=HOP)
    d_str = [float(env[min(f, len(env) - 1)]) for f in d_frames]
    mel_freqs = librosa.mel_frequencies(n_mels=N_MELS + 2, fmin=0, fmax=SR / 2)
    bass_end = int(np.searchsorted(mel_freqs, BASS_HZ_MAX))
    multi = librosa.onset.onset_strength_multi(y=y, sr=SR, hop_length=HOP, n_mels=N_MELS, channels=[0, bass_end, N_MELS])
    bass_env = multi[0]
    b_frames = librosa.onset.onset_detect(onset_envelope=bass_env, sr=SR, hop_length=HOP, units="frames", backtrack=True)
    b_times = librosa.frames_to_time(b_frames, sr=SR, hop_length=HOP)
    return {
        "beat_grid_period": period,
        "drum_onsets": [float(t) for t in d_times],
        "bass_onsets": [float(t) for t in b_times],
        "drum_strengths": d_str,
    }


# ── stage 2: librosa on the drums stem (extract_stems.py) ─────────────────
def band_onsets(y, fmin, fmax):
    mel_freqs = librosa.mel_frequencies(n_mels=N_MELS + 2, fmin=0, fmax=SR / 2)
    lo = int(np.searchsorted(mel_freqs, fmin))
    hi = N_MELS if fmax is None else int(np.searchsorted(mel_freqs, fmax))
    if hi <= lo:
        hi = lo + 1
    multi = librosa.onset.onset_strength_multi(y=y, sr=SR, hop_length=HOP, n_mels=N_MELS, channels=[0, lo, hi, N_MELS])
    frames = librosa.onset.onset_detect(onset_envelope=multi[1], sr=SR, hop_length=HOP, units="frames", backtrack=True)
    return [float(t) for t in librosa.frames_to_time(frames, sr=SR, hop_length=HOP)]


def librosa_stems(y_drums):
    oenv = librosa.onset.onset_strength(y=y_drums, sr=SR, hop_length=HOP)
    frames = librosa.onset.onset_detect(onset_envelope=oenv, sr=SR, hop_length=HOP, units="frames", backtrack=True)
    stem_drums = [float(t) for t in librosa.frames_to_time(frames, sr=SR, hop_length=HOP)]
    return {"stem_drums": stem_drums,
            **{f"band_{k}": band_onsets(y_drums, fmin, fmax) for k, (fmin, fmax) in DRUM_BANDS.items()}}


# ── stage 3: madmom (extract_madmom.py) ───────────────────────────────────
def rnn_onsets(path):
    proc_rnn = RNNOnsetProcessor()
    proc_peak = OnsetPeakPickingProcessor(fps=100, threshold=0.35)
    return [float(t) for t in proc_peak(proc_rnn(str(path)))]


def madmom_streams():
    print("  madmom RNN onsets (mix + drums stem) + DBN beats ...", flush=True)
    onsets_mix = rnn_onsets(AUDIO)
    onsets_drums = rnn_onsets(DRUMS_STEM)
    beats = DBNBeatTrackingProcessor(fps=100)(RNNBeatProcessor()(str(AUDIO)))
    beats = beats[beats < DUR]
    return {"rnn_mix": onsets_mix, "rnn_drums": onsets_drums, "beats": [float(t) for t in beats]}


# ── stage 4: quantize (extract_quantize.py) ───────────────────────────────
def local_beat(beats, t):
    i = int(np.searchsorted(beats, t))
    if i == 0:
        return beats[1] - beats[0], beats[0]
    if i >= len(beats):
        return beats[-1] - beats[-2], beats[-1]
    return beats[i] - beats[i - 1], beats[i - 1]


def snap_stream(onsets, beats):
    """Per-stream phase-corrected snap to 1/SUBDIVISION grid (extract_quantize)."""
    if len(beats) < 2 or len(onsets) == 0:
        return []
    raw_drifts = []
    for t in onsets:
        period, b0 = local_beat(beats, t)
        frac = (t - b0) / period
        snap = round(frac * SUBDIVISION) / SUBDIVISION
        raw_drifts.append((frac - snap) * period * 1000)
    phase = float(np.median(raw_drifts))
    kept, seen = [], set()
    for t in onsets:
        t_corr = t - phase / 1000.0
        period, b0 = local_beat(beats, t_corr)
        frac = (t_corr - b0) / period
        snap_idx = round(frac * SUBDIVISION)
        snap_t = b0 + (snap_idx / SUBDIVISION) * period
        if abs(t_corr - snap_t) * 1000 <= TOL_MS:
            key = round(snap_t * 1000)
            if key not in seen:
                seen.add(key)
                kept.append({"t": float(snap_t), "grid": snap_idx % SUBDIVISION})
    return kept


# ── stage 5: consensus (extract_consensus.py) ─────────────────────────────
def consensus(snapped):
    events = []
    for key in STREAMS:
        for k in snapped.get(key, []):
            events.append((round(k["t"] * 1000), key))
    events.sort()
    clusters = []
    for ms, src in events:
        if clusters and (ms - clusters[-1]["first_ms"]) <= 0:
            clusters[-1]["times"].append(ms)
            clusters[-1]["sources"].add(src)
        else:
            clusters.append({"first_ms": ms, "times": [ms], "sources": {src}})
    out = []
    for c in clusters:
        if len(c["sources"]) < MIN_VOTES:
            continue
        c["times"].sort()
        med = c["times"][len(c["times"]) // 2] / 1000.0
        out.append({"t": round(med, 4), "votes": len(c["sources"]), "sources": sorted(c["sources"])})
    return out


def main():
    print(f"[1/5] librosa on mix ...", flush=True)
    y, _ = librosa.load(str(AUDIO), sr=SR, mono=True)
    mix = librosa_mix(y, DUR)
    print(f"      mix drum onsets={len(mix['drum_onsets'])}  bass={len(mix['bass_onsets'])}  "
          f"librosa period={mix['beat_grid_period']*1000:.1f}ms", flush=True)

    print(f"[2/5] librosa on drums stem ...", flush=True)
    yd, _ = librosa.load(str(DRUMS_STEM), sr=SR, mono=True)
    stems = librosa_stems(yd)
    for k, v in stems.items():
        print(f"      {k:12s}: {len(v)}", flush=True)

    print(f"[3/5] madmom ...", flush=True)
    mm = madmom_streams()
    print(f"      rnn_mix={len(mm['rnn_mix'])}  rnn_drums={len(mm['rnn_drums'])}  "
          f"beats={len(mm['beats'])}", flush=True)
    beats = np.array(mm["beats"])

    print(f"[4/5] quantize to 1/{SUBDIVISION} grid (±{TOL_MS:.0f}ms) ...", flush=True)
    raw_streams = {
        "rnn_drums": mm["rnn_drums"],
        "stem_drums": stems["stem_drums"],
        "band_kick": stems["band_kick"],
        "band_snare": stems["band_snare"],
        "band_hat": stems["band_hat"],
        "rnn_mix": mm["rnn_mix"],          # extra, not in the 5
        "lib_drum": mix["drum_onsets"],    # extra
    }
    snapped = {}
    for name, ts in raw_streams.items():
        s = snap_stream(ts, beats)
        snapped[name] = s
        print(f"      {name:11s}: {len(ts):4d} -> {len(s):4d} snapped", flush=True)

    print(f"[5/5] consensus (min {MIN_VOTES}/{len(STREAMS)} streams) ...", flush=True)
    cons = consensus(snapped)
    print(f"      -> {len(cons)} consensus hits  ({len(cons)/DUR:.2f}/s)", flush=True)

    # grid-position histogram of the consensus (which 1/16 slots fire)
    hist = Counter(c["t"] for c in cons)
    grid_hist = Counter()
    for c in cons:
        period, b0 = local_beat(beats, c["t"])
        frac = (c["t"] - b0) / period
        grid_hist[round(frac * SUBDIVISION) % SUBDIVISION] += 1
    print("      consensus 1/16 grid-position histogram:", flush=True)
    total = max(sum(grid_hist.values()), 1)
    for pos in range(SUBDIVISION):
        n = grid_hist.get(pos, 0)
        anchor = " <- beat" if pos == 0 else (" <- &/offbeat" if pos == SUBDIVISION // 2 else "")
        print(f"        {pos}/{SUBDIVISION}: {n:4d}  {'#' * int(40 * n / total)}{anchor}", flush=True)

    out = {
        "audio": AUDIO.name,
        "duration": DUR,
        "madmom_beats": mm["beats"],
        "streams_snapped_counts": {k: len(v) for k, v in snapped.items()},
        "consensus_streams": STREAMS,
        "min_votes": MIN_VOTES,
        "n_consensus": len(cons),
        "consensus": cons,
        "mix": {"librosa_period_ms": round(mix["beat_grid_period"] * 1000, 2),
                "n_drum_onsets": len(mix["drum_onsets"]), "n_bass_onsets": len(mix["bass_onsets"])},
        "drum_onsets_mix": mix["drum_onsets"],
        "bass_onsets_mix": mix["bass_onsets"],
    }
    outpath = OUTDIR / "ensemble.json"
    outpath.write_text(json.dumps(out, indent=2))
    print(f"\nwrote {outpath} ({outpath.stat().st_size/1024:.1f} KiB)", flush=True)

    # also emit a compact consensus-only onset list (the {t} form the spec uses)
    conspath = OUTDIR / "consensus.json"
    conspath.write_text(json.dumps({
        "source": "shelter 81s v7-consensus ensemble (5 streams, min 3 votes)",
        "n_events": len(cons),
        "onsets": [{"t": c["t"], "votes": c["votes"]} for c in cons],
    }, indent=2))
    print(f"wrote {conspath}", flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
