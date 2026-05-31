#!/usr/bin/env python3
"""
Music structure analysis with madmom — a *listening aid*, not a beat generator.

This is the tool used to understand how a song is structured (tempo, meter,
phrase boundaries, energy contour) so a human/agent can design an expressive
Line Rider spec on top of the existing detected beats. It does NOT produce the
contacts the compiler uses — those come from the drum-detection JSON in beats/.

What it prints
--------------
1. BEATS / TEMPO  — RNNBeatProcessor -> DBNBeatTrackingProcessor.
   median inter-beat-interval -> BPM, plus per-window BPM to spot tempo drift.
2. DOWNBEATS / BARS — RNNDownBeatProcessor -> DBNDownBeatTrackingProcessor.
   bar-1 times -> meter (4/4 etc.), bar count, and 4-bar phrase boundaries
   (use these as your section t0/t1 so changes land on musical phrase lines).
3. ENERGY TIMELINE — RNNOnsetProcessor onset-activation function, averaged into
   buckets -> an ASCII intensity contour that reveals intro / build / verse /
   chorus / outro. Map this to your air/speed/grain arc.

Install (madmom is a 2018 library; needs an old Python + pins)
--------------------------------------------------------------
    uv python install 3.10
    uv venv --python 3.10 /tmp/mm310
    uv pip install --python /tmp/mm310/bin/python "cython<3.0" "numpy==1.23.5" \
        "scipy<1.11" "setuptools<81" mido
    uv pip install --python /tmp/mm310/bin/python --no-build-isolation madmom
    /tmp/mm310/bin/python scripts/analyze_music.py --audio beats/audio.mp3 --duration 56

(The compat shim below re-aliases the collections ABCs madmom expects on <3.10.)

Usage
-----
    /tmp/mm310/bin/python scripts/analyze_music.py [--audio PATH] [--duration S] [--bucket S]
"""
import argparse

# compat shim: madmom 0.16.1 predates py3.10 (collections ABCs moved to collections.abc)
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


def main() -> None:
    ap = argparse.ArgumentParser(description="madmom structural analysis (listening aid)")
    ap.add_argument("--audio", default="beats/audio.mp3", help="audio file (mp3/wav)")
    ap.add_argument("--duration", type=float, default=56.0, help="seconds to analyze from the start")
    ap.add_argument("--bucket", type=float, default=2.0, help="energy-timeline bucket size, seconds")
    args = ap.parse_args()
    audio, dur, bucket = args.audio, args.duration, args.bucket

    print("=== BEATS / TEMPO ===", flush=True)
    beats = DBNBeatTrackingProcessor(fps=100)(RNNBeatProcessor()(audio))
    beats = beats[beats < dur]
    ibi = np.diff(beats)
    print(f"n_beats={len(beats)}  median_IBI={np.median(ibi):.3f}s -> {60 / np.median(ibi):.1f} BPM", flush=True)
    for w0 in range(0, int(dur), 8):
        bs = beats[(beats >= w0) & (beats < w0 + 8)]
        if len(bs) > 1:
            print(f"  {w0:3d}-{w0 + 8:3d}s: {60 / np.median(np.diff(bs)):5.1f} BPM ({len(bs)} beats)")

    print("=== DOWNBEATS / BARS ===", flush=True)
    db = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)(RNNDownBeatProcessor()(audio))
    downbeats = db[(db[:, 1] == 1) & (db[:, 0] < dur)][:, 0]
    print(f"n_bars={len(downbeats)}  median_bar={np.median(np.diff(downbeats)):.2f}s "
          f"(4/4 if ~= 4x the beat interval)", flush=True)
    print(f"downbeat times: {np.round(downbeats, 2).tolist()}", flush=True)
    print(f"4-bar phrase boundaries: {np.round(downbeats[::4], 2).tolist()}", flush=True)

    print(f"=== ENERGY TIMELINE (onset activation, {bucket:.0f}s buckets) ===", flush=True)
    act = RNNOnsetProcessor()(audio)
    fps = 100
    peak = max(1e-6, act[:int(dur * fps)].max())
    b = 0.0
    while b < dur:
        seg = act[int(b * fps):int((b + bucket) * fps)]
        if len(seg):
            m = float(seg.mean())
            print(f"  {b:5.1f}-{b + bucket:5.1f}s  {m:.3f}  {'#' * int(m / peak * 50)}")
        b += bucket
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
