#!/usr/bin/env python3
"""
madmom structural analysis of shelter_81s.mp3 — the "understand the music" step.

Applies the collections.abc shim (madmom 0.16.1 does `from collections import
MutableSequence`, removed in py3.10) BEFORE importing madmom, so it runs under
the /tmp/mm310 py3.10 venv where madmom is installed.

Outputs beats/shelter81/madmom.json:
  beats, downbeats, positions, meter, tempo_bpm, ibi_ms,
  phrases_4bar (4-bar phrase starts), energy (onset-activation bucket contour).

Also prints a readable summary.

Usage:
    /tmp/mm310/bin/python beats/shelter81_madmom.py
"""
from __future__ import annotations

import json
from pathlib import Path

# ── compat shims (must precede madmom import) ──────────────────────────────
import collections
import collections.abc

for _n in ["MutableSequence", "MutableMapping", "Mapping", "Sequence", "Callable",
           "Iterable", "MutableSet", "Set", "Hashable"]:
    if not hasattr(collections, _n):
        setattr(collections, _n, getattr(collections.abc, _n))

import numpy as np  # noqa: E402
from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor  # noqa: E402
from madmom.features.downbeats import (  # noqa: E402
    RNNDownBeatProcessor, DBNDownBeatTrackingProcessor,
)
from madmom.features.onsets import RNNOnsetProcessor  # noqa: E402

HERE = Path(__file__).parent
AUDIO = HERE / "shelter_81s.mp3"
OUTDIR = HERE / "shelter81"
OUTDIR.mkdir(exist_ok=True)
DUR = 81.0
BUCKET = 1.0  # 1s energy buckets — finer than analyze_music's 2s for an 81s cut


def main() -> None:
    print(f"loading madmom models + analyzing {AUDIO.name} ...", flush=True)

    print("[beats · DBN]", flush=True)
    beats = DBNBeatTrackingProcessor(fps=100)(RNNBeatProcessor()(str(AUDIO)))
    beats = beats[beats < DUR]
    ibi = np.diff(beats)
    median_ibi = float(np.median(ibi))
    bpm = 60.0 / median_ibi
    print(f"  n_beats={len(beats)}  median_IBI={median_ibi*1000:.1f}ms -> {bpm:.2f} BPM", flush=True)
    print("  per-8s-window BPM:", flush=True)
    window_bpms = []
    for w0 in range(0, int(DUR), 8):
        bs = beats[(beats >= w0) & (beats < w0 + 8)]
        if len(bs) > 1:
            wbpm = 60.0 / float(np.median(np.diff(bs)))
            window_bpms.append((w0, wbpm))
            print(f"    {w0:3d}-{w0+8:3d}s: {wbpm:5.2f} BPM ({len(bs)} beats)", flush=True)

    print("[downbeats · DBN]", flush=True)
    db = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)(
        RNNDownBeatProcessor()(str(AUDIO)))
    in_range = db[(db[:, 0] < DUR)]
    positions = [int(p) for _, p in in_range]
    downbeats = in_range[in_range[:, 1] == 1][:, 0]
    meter = int(max(positions)) if positions else 4
    n_bars = len(downbeats)
    bar_period = float(np.median(np.diff(downbeats))) if len(downbeats) >= 2 else float("nan")
    print(f"  meter={meter}  n_bars={n_bars}  median_bar={bar_period:.3f}s", flush=True)
    print(f"  downbeat times: {np.round(downbeats, 2).tolist()}", flush=True)
    phrases = downbeats[::4]
    print(f"  4-bar phrase starts: {np.round(phrases, 2).tolist()}", flush=True)

    print(f"[energy · onset activation, {BUCKET:.0f}s buckets]", flush=True)
    act = RNNOnsetProcessor()(str(AUDIO))
    fps = 100
    peak = float(max(1e-6, act[:int(DUR * fps)].max()))
    energy = []
    b = 0.0
    while b < DUR:
        seg = act[int(b * fps):int((b + BUCKET) * fps)]
        m = float(seg.mean()) if len(seg) else 0.0
        energy.append({"t0": round(b, 2), "mean": round(m, 4),
                       "bar": int(m / peak * 50)})
        print(f"    {b:5.1f}-{b+BUCKET:5.1f}s  {m:.3f}  {'#' * int(m / peak * 50)}", flush=True)
        b += BUCKET

    out = {
        "audio": AUDIO.name,
        "duration": DUR,
        "tempo_bpm": round(bpm, 3),
        "median_ibi_ms": round(median_ibi * 1000, 2),
        "meter": meter,
        "n_bars": n_bars,
        "bar_period_s": round(bar_period, 4),
        "beats": [round(float(t), 4) for t in beats],
        "downbeats": [round(float(t), 4) for t in downbeats],
        "positions": positions,
        "phrases_4bar": [round(float(t), 4) for t in phrases],
        "window_bpms": [(w0, round(wb, 2)) for w0, wb in window_bpms],
        "energy": energy,
        "energy_peak": round(peak, 4),
    }
    outpath = OUTDIR / "madmom.json"
    outpath.write_text(json.dumps(out, indent=2))
    print(f"\nwrote {outpath} ({outpath.stat().st_size/1024:.1f} KiB)", flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
