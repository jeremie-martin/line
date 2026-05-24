"""
madmom RNN-based onset detection + DBN downbeat tracking, as a 'ground truth'
second opinion against the librosa pipeline.

madmom doesn't ship a drum-piece model in its open distribution, so this is
NOT kick/snare/hat — it's instrument-agnostic onsets + a 4/4 downbeat grid.

Outputs detection_madmom.json with:
  onsets_mix:   onset times on the full mix
  onsets_drums: onset times on the demucs drums stem
  beats:        downbeat-tracker beats
  downbeats:    every "1" of the bar (i.e. bar starts)
  meter:        beats-per-bar guess (should be 4 for Believer)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

# madmom 0.16.1 ships compiled .pyx that references the removed np.int /
# np.float / np.bool aliases. Restore them as harmless typedefs before madmom
# imports — this is the standard workaround documented in madmom issue trackers.
for alias, real in (("int", int), ("float", float), ("bool", bool), ("object", object), ("complex", complex)):
    if not hasattr(np, alias):
        setattr(np, alias, real)

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)

from madmom.features.onsets import RNNOnsetProcessor, OnsetPeakPickingProcessor
from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor

HERE = Path(__file__).parent
MIX  = HERE / "audio.mp3"
DRUMS = HERE / "stems" / "drums.mp3"
OUT  = HERE / "detection_madmom.json"


def rnn_onsets(audio_path):
    proc_rnn  = RNNOnsetProcessor()
    proc_peak = OnsetPeakPickingProcessor(fps=100, threshold=0.35)
    print(f"  RNN forward pass on {audio_path.name} ...")
    act = proc_rnn(str(audio_path))
    onsets = proc_peak(act)
    return [float(t) for t in onsets]


def downbeats(audio_path, beats_per_bar=(3, 4)):
    proc_rnn = RNNDownBeatProcessor()
    proc_dbn = DBNDownBeatTrackingProcessor(beats_per_bar=list(beats_per_bar), fps=100)
    print(f"  downbeat RNN+DBN on {audio_path.name} ...")
    act = proc_rnn(str(audio_path))
    grid = proc_dbn(act)  # shape (N, 2): [time, beat-position-in-bar]
    times = [float(t) for t, _ in grid]
    positions = [int(p) for _, p in grid]
    return times, positions


def main():
    out = {"audio_file": MIX.name}

    print("[onsets · mix]")
    out["onsets_mix"] = rnn_onsets(MIX)
    print(f"  → {len(out['onsets_mix'])} onsets")

    print("\n[onsets · drums stem]")
    out["onsets_drums"] = rnn_onsets(DRUMS)
    print(f"  → {len(out['onsets_drums'])} onsets")

    print("\n[downbeats · mix]")
    times, positions = downbeats(MIX)
    out["beats"]     = times
    out["positions"] = positions   # 1 = downbeat
    out["downbeats"] = [t for t, p in zip(times, positions) if p == 1]
    # Infer meter from the modal max position
    meter = int(max(positions)) if positions else 4
    out["meter"] = meter
    print(f"  → {len(times)} beats, {len(out['downbeats'])} downbeats, meter={meter}")
    if len(out["downbeats"]) >= 2:
        bar_period = np.median(np.diff(out["downbeats"]))
        print(f"  bar period: {bar_period:.3f}s ↔ {60*meter/bar_period:.2f} BPM")

    OUT.write_text(json.dumps(out))
    print(f"\nwrote {OUT} ({OUT.stat().st_size/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
