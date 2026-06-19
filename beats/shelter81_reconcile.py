#!/usr/bin/env python3
"""
Reconcile the madmom beat grid + ensemble consensus + energy contour into a
per-beat table that informs the spec's variable-density contact grid and the
per-beat impact map. Reads beats/shelter81/{madmom.json,ensemble.json}.

For each madmom beat it prints:
  idx, time, bar:beat (1-indexed), on-beat consensus votes, off-beat ("&")
  consensus votes (the 8th between this beat and next), energy bucket, and a
  derived impact hint (0..1 from on-beat vote saturation).

Also proposes section labels from the 4-bar phrases + energy contour.
"""
from __future__ import annotations

import json
from pathlib import Path

OUTDIR = Path(__file__).parent / "shelter81"
madmom = json.loads((OUTDIR / "madmom.json").read_text())
ens = json.loads((OUTDIR / "ensemble.json").read_text())

beats = madmom["beats"]
energy = {e["t0"]: e for e in madmom["energy"]}
phrases = madmom["phrases_4bar"]
cons = ens["consensus"]

# Bucket each consensus hit to the nearest beat (on-beat) or nearest "&" (mid).
onbeat_votes = [0] * len(beats)     # votes landing within ±0.15s of a beat
offbeat_votes = [0] * len(beats)    # votes landing near the "&" between beat i and i+1
for c in cons:
    t = c["t"]
    # nearest beat
    bi = min(range(len(beats)), key=lambda i: abs(beats[i] - t))
    d_on = abs(beats[bi] - t)
    # nearest "&": the midpoint of the gap t actually falls in. offbeat_votes[gi]
    # is the "&" between beat gi and gi+1, so a hit BEFORE its nearest beat belongs
    # to the previous gap (bi-1..bi), not the one after bi.
    gi = bi if t >= beats[bi] else bi - 1
    if 0 <= gi < len(beats) - 1:
        mid = 0.5 * (beats[gi] + beats[gi + 1])
    else:
        gi, mid = bi, beats[bi] + 0.3  # edge: no following beat, approximate "&"
    d_off = abs(mid - t)
    if d_on <= 0.15 and d_on <= d_off:
        onbeat_votes[bi] += c["votes"]
    elif d_off <= 0.15:
        offbeat_votes[gi] += c["votes"]

max_on = max(onbeat_votes) or 1

# Phrase boundaries -> section labels
phrase_set = set(round(p, 2) for p in phrases)
SECTIONS = [
    (0.33, 9.93, "INTRO", "#5b8def"),
    (9.93, 19.53, "GROOVE", "#3fb6a8"),
    (19.53, 29.13, "VERSE", "#6c8cf2"),
    (29.13, 38.73, "BUILD", "#f2b134"),
    (38.73, 48.33, "CHORUS1", "#f24f4f"),
    (48.33, 57.93, "CHORUS2", "#f24f4f"),
    (57.93, 67.53, "BREAKDN", "#a06cf2"),
    (67.53, 77.13, "DROP2", "#f0792f"),
    (77.13, 81.0, "OUTRO", "#7e57c2"),
]


def section_of(t):
    for t0, t1, name, col in SECTIONS:
        if t0 <= t < t1:
            return name
    return "OUTRO"


def energy_at(t):
    b = int(t)
    return energy.get(b, energy.get(b - 1, {"mean": 0, "bar": 0}))


print(f"{'idx':>3} {'time':>6} {'bar':>4} {'on':>3} {'off':>3} {'imp':>4} {'eng':>5}  sect       onbar  offbar")
print("-" * 78)
for i, t in enumerate(beats):
    bar_pos = (i % 4) + 1  # 1..4 (1 = downbeat)
    on = onbeat_votes[i]
    off = offbeat_votes[i]
    imp = on / max_on  # saturation of the strongest beat -> [0,1] impact proxy
    eng = energy_at(t)["mean"]
    bar = i // 4 + 1
    onbar = "#" * min(on, 9)
    offbar = "-" * min(off, 9)
    sect = section_of(t)
    marker = " <4bar" if round(t, 2) in phrase_set else ""
    print(f"{i:3d} {t:6.2f} {bar_pos:4d} {on:3d} {off:3d} {imp:4.2f} {eng:5.3f}  {sect:10s} {onbar:9s} {offbar}{marker}")

# Per-section aggregates
print("\n" + "=" * 60)
print("Per-section: mean on-beat votes, mean energy, beat count")
print("=" * 60)
for t0, t1, name, _ in SECTIONS:
    idx = [i for i, t in enumerate(beats) if t0 <= t < t1]
    if not idx:
        continue
    mean_on = sum(onbeat_votes[i] for i in idx) / len(idx)
    mean_eng = sum(energy_at(beats[i])["mean"] for i in idx) / len(idx)
    mean_imp = sum(onbeat_votes[i] / max_on for i in idx) / len(idx)
    print(f"  {name:9s} {t0:5.1f}-{t1:5.1f}s  beats={len(idx):2d}  "
          f"meanOn={mean_on:4.1f}  meanEng={mean_eng:.3f}  meanImp={mean_imp:.2f}")

# Save a machine-readable beat table for spec authoring
table = []
for i, t in enumerate(beats):
    table.append({
        "i": i, "t": round(t, 4), "bar_pos": (i % 4) + 1, "bar": i // 4 + 1,
        "on_votes": onbeat_votes[i], "off_votes": offbeat_votes[i],
        "impact_hint": round(onbeat_votes[i] / max_on, 3),
        "energy": round(energy_at(t)["mean"], 4),
        "section": section_of(t),
        "phrase_start": round(t, 2) in phrase_set,
    })
(OUTDIR / "beat_table.json").write_text(json.dumps(table, indent=2))
print(f"\nwrote {OUTDIR/'beat_table.json'} ({len(table)} beats)")
