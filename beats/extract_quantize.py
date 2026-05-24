"""
Rhythmic post-quantization of detected onset streams.

Given a beat grid (madmom DBN beats) and a set of detected onsets, for each
onset:
  1. Find its local beat period from the two surrounding beats.
  2. Compute the offset as a fraction of that period.
  3. Snap to the nearest 1/N subdivision (N = 16 by default — pop standard).
  4. If the snap distance exceeds TOL_MS, drop the onset (likely spurious).
  5. Otherwise, replace its time with the snapped time.

This is a standard music-information-retrieval idiom — "beat-synchronous
quantization" or "rhythmic snapping". It encodes the prior that produced pop
music hits on subdivisions and rejects onsets that don't.

Quantizes:
  - madmom RNN onsets on the Demucs drums stem  →  rnn_drums
  - madmom RNN onsets on the mix                →  rnn_mix
  - ADTOF kick / snare / hat / tom / cymbal     →  adt_*

Writes detection_corrected.json.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent

SUBDIVISION = 4    # 4 positions per beat → 16th-note grid (pop standard)
# Tolerance for keeping an onset (else it gets dropped).
# At SUBDIVISION=4 and 125 BPM the bin width is 120 ms, so the max possible
# drift to the nearest grid line is 60 ms. Setting TOL_MS = 200 ⇒ snap-only
# (nothing is ever dropped). Dial down to filter aggressively.
TOL_MS      = 200.0


def local_beat(beats: np.ndarray, t: float):
    i = int(np.searchsorted(beats, t))
    if i == 0:
        return beats[1] - beats[0], beats[0]
    if i >= len(beats):
        return beats[-1] - beats[-2], beats[-1]
    return beats[i] - beats[i-1], beats[i-1]


def signed_drift_to_grid(t: float, beats: np.ndarray, sub: int) -> float:
    """ms, +late / -early relative to the nearest sub-grid line."""
    period, b0 = local_beat(beats, t)
    frac = (t - b0) / period
    snap = round(frac * sub) / sub
    return (frac - snap) * period * 1000


def snap_to_grid(onsets: np.ndarray, beats: np.ndarray) -> dict:
    """Snap each onset to the nearest 1/SUBDIVISION-beat grid line, with
    per-stream phase correction: we measure the median signed drift first
    and treat that as the "groove" offset (e.g., kicks systematically late),
    then drop only onsets whose drift AFTER subtracting the groove offset
    exceeds TOL_MS.

    Returns {kept, dropped, grid_hist, phase_offset_ms, ...}.
    """
    if len(beats) < 2 or len(onsets) == 0:
        return {"kept": [], "dropped": [],
                "grid_hist": {}, "kept_count": 0, "dropped_count": 0,
                "dedup_collapsed": 0, "phase_offset_ms": 0.0}

    # 1. Per-stream phase offset: median signed drift vs the grid.
    raw_drifts = np.array([signed_drift_to_grid(t, beats, SUBDIVISION) for t in onsets])
    phase_offset_ms = float(np.median(raw_drifts))

    kept, dropped = [], []
    grid_hist = Counter()

    for t in onsets:
        # 2. Shift the onset by -phase_offset before snapping.
        t_corrected = t - phase_offset_ms / 1000.0
        period, b0 = local_beat(beats, t_corrected)
        frac = (t_corrected - b0) / period
        snap_idx = round(frac * SUBDIVISION)
        snap_frac = snap_idx / SUBDIVISION
        snap_t_corr = b0 + snap_frac * period
        # Snapped time in original frame = snap_t_corr + phase_offset.
        # We DON'T want to undo the groove; the goal of "make it land at the
        # right time" is to snap to the grid, so we emit the bare snap_t_corr.
        snap_t = snap_t_corr
        drift_ms = abs(t_corrected - snap_t_corr) * 1000

        if drift_ms <= TOL_MS:
            kept.append({
                "t":          float(snap_t),
                "t_original": float(t),
                "drift_ms":   round(float(drift_ms), 2),
                "grid_idx":   snap_idx % SUBDIVISION,
            })
            grid_hist[snap_idx % SUBDIVISION] += 1
        else:
            dropped.append({"t": float(t), "drift_ms": round(float(drift_ms), 2)})

    # Optional: dedup onsets that snap to the same grid line (keep first).
    seen = set()
    dedup = []
    for k in sorted(kept, key=lambda k: k["t"]):
        # Bucket by (b0 index, grid_idx) — multiple kept onsets snapping to the
        # exact same grid line collapse to one.
        key = round(k["t"] * 1000)
        if key in seen:
            continue
        seen.add(key)
        dedup.append(k)

    return {
        "kept": dedup,
        "dropped": dropped,
        "grid_hist": dict(grid_hist),
        "kept_count": len(dedup),
        "dropped_count": len(dropped),
        "dedup_collapsed": len(kept) - len(dedup),
        "phase_offset_ms": round(phase_offset_ms, 1),
    }


def report(label: str, result: dict, n_in: int):
    k, d = result["kept_count"], result["dropped_count"]
    rate = 100 * k / max(n_in, 1)
    phase = result["phase_offset_ms"]
    print(f"  {label:18s}  in={n_in:4d}  kept={k:4d} ({rate:5.1f}%)  dropped={d:3d}  phase={phase:+5.1f}ms  dedup={result['dedup_collapsed']}")


def main():
    detM = json.load(open(HERE / "detection_madmom.json"))
    beats = np.array(detM["beats"])
    print(f"beat grid: {len(beats)} beats, median IBI {np.median(np.diff(beats))*1000:.1f} ms\n")

    streams = {
        "rnn_drums": np.array(detM["onsets_drums"]),
        "rnn_mix":   np.array(detM["onsets_mix"]),
    }

    # v2 / v3 — librosa onset_detect on Demucs stems and on band-split drums.
    try:
        det2 = json.load(open(HERE / "detection_stems.json"))
        streams["stem_drums"]  = np.array([o["t"] for o in det2["stems"]["drums"]["onsets"]])
        streams["stem_bass"]   = np.array([o["t"] for o in det2["stems"]["bass"]["onsets"]])
        streams["band_kick"]   = np.array([o["t"] for o in det2["drum_bands"]["kick"]["onsets"]])
        streams["band_snare"]  = np.array([o["t"] for o in det2["drum_bands"]["snare"]["onsets"]])
        streams["band_hat"]    = np.array([o["t"] for o in det2["drum_bands"]["hat"]["onsets"]])
    except FileNotFoundError:
        print("(no detection_stems.json — skipping stem/band streams)")

    # ADTOF per-class (mix run — best F1)
    try:
        detA = json.load(open(HERE / "detection_adtof.json"))
        for cls in ("kick", "snare", "hat", "tom", "cymbal"):
            streams[f"adt_{cls}"] = np.array([h["t"] for h in detA["classes"][cls]])
    except FileNotFoundError:
        print("(no detection_adtof.json — skipping ADTOF streams)")

    out = {
        "source_beats":   "detection_madmom.json:beats",
        "subdivision":    SUBDIVISION,
        "tolerance_ms":   TOL_MS,
        "streams":        {},
    }

    print(f"quantizing to 1/{SUBDIVISION} grid, tolerance ±{TOL_MS:.0f} ms:")
    for name, ts in streams.items():
        r = snap_to_grid(ts, beats)
        out["streams"][name] = r
        report(name, r, len(ts))

    # Print grid-position histogram for the rnn_drums (the user's stream of interest).
    print(f"\nrnn_drums grid-position histogram ({SUBDIVISION} positions per beat):")
    hist = out["streams"]["rnn_drums"]["grid_hist"]
    total = max(sum(hist.values()), 1)
    for pos in range(SUBDIVISION):
        n = hist.get(pos, 0)
        bar = "#" * int(40 * n / total)
        anchor = "  ← beat" if pos == 0 else ("  ← &" if pos == SUBDIVISION // 2 else ("  ← e" if pos == SUBDIVISION // 4 else ("  ← a" if pos == 3 * SUBDIVISION // 4 else "")))
        print(f"  {pos:2d}/{SUBDIVISION} ({pos/SUBDIVISION:.3f}): {n:4d}  {bar}{anchor}")

    out_path = HERE / "detection_corrected.json"
    out_path.write_text(json.dumps(out))
    print(f"\nwrote {out_path} ({out_path.stat().st_size/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
