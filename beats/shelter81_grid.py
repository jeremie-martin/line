#!/usr/bin/env python3
"""
Build the variable-density contact grid for the shelter 81s spec, selecting
beats BY INDEX from the reconciled madmom grid (the grid has sub-period
jitter, so index selection is robust). 16 beats per 4-bar phrase; sections
start at indices 0/16/32/48/64/80/96/112/128.

Policy: dense (every beat) in rhythmic sections; sparse (long gaps) where the
music breathes; showpiece floats at the chorus1 vocal spot and the breakdown.
Per-contact impact from section + ensemble on-beat vote weight.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

table = json.loads((Path(__file__).parent / "shelter81" / "beat_table.json").read_text())
B = table  # B[i] = beat i


def imp_for(b, base, accent, hard_thresh, hard_val, build_frac=None):
    """impact for a beat: hard hits > downbeat accent > base, optional build ramp."""
    if b["on_votes"] >= hard_thresh:
        return hard_val
    v = base + (0.06 if b["bar_pos"] == 1 else 0.0)
    if build_frac is not None:
        v += 0.20 * build_frac
    return min(v, hard_val - 0.04)


contacts = []  # (t, impact, role)


def add(i, impact, role):
    contacts.append((round(B[i]["t"], 2), round(impact, 2), role))


# INTRO (0–15): every 2 beats, soft; final (15) lifts as drums hint
for i in [0, 2, 4, 6, 8, 10, 12, 14]:
    add(i, 0.10, "intro")
add(15, 0.18, "intro-lift")

# GROOVE (16–31): every beat; big hits (>=9 votes) hard
for i in range(16, 32):
    add(i, imp_for(B[i], 0.20, None, 9, 0.58), "groove")

# VERSE (32–47): every beat; the 13/14-vote peaks are the accents
for i in range(32, 48):
    if B[i]["on_votes"] >= 13:
        add(i, 0.60, "verse-peak")
    else:
        add(i, imp_for(B[i], 0.20, None, 9, 0.48), "verse")

# BUILD (48–63): every beat; impact ramps into the chorus
for i in range(48, 64):
    frac = (i - 48) / 15
    add(i, imp_for(B[i], 0.20, None, 9, 0.52, build_frac=frac), "build")

# CHORUS1 (64–79): dense open (64,65), FLOAT under vocal (->68, 1.8s), dense close
add(64, 0.40, "chorus1-hit")
add(65, 0.34, "chorus1-hit")
add(68, 0.16, "chorus1-float")  # 1.8s air under the vocal thin-spot
for i in range(69, 80):
    add(i, imp_for(B[i], 0.22, None, 9, 0.55), "chorus1-close")

# CHORUS2 (80–95): every beat, HARD — the climax slam section
for i in range(80, 96):
    add(i, imp_for(B[i], 0.40, None, 9, 0.62), "chorus2")

# BREAKDN (96–111): every 3 beats (1.8s) floaty, then a lift (110) to tighten
# into the drop — avoids a 2.4s strand across the 65.13->67.53 break->drop join.
for i in [96, 99, 102, 105, 108]:
    add(i, 0.12, "breakdn-float")
add(110, 0.18, "breakdn-lift")

# DROP2 (112–127): dense drop, tail, mini-break float, hard re-entry
for i in range(112, 120):
    add(i, imp_for(B[i], 0.34, None, 9, 0.58), "drop2")
add(120, 0.30, "drop2-tail")
add(123, 0.16, "drop2-float")
add(126, 0.20, "drop2-float")
add(127, 0.55, "drop2-reentry")

# OUTRO (128–134): every 2 beats, easing down
for i in [128, 130, 132, 134]:
    add(i, 0.22, "outro")

contacts = sorted(contacts, key=lambda c: c[0])

# ── report ────────────────────────────────────────────────────────────────
print(f"total contacts: {len(contacts)}")
gaps = [contacts[i + 1][0] - contacts[i][0] for i in range(len(contacts) - 1)]
print(f"gap stats: min={min(gaps):.2f}s  max={max(gaps):.2f}s  "
      f"mean={sum(gaps)/len(gaps):.2f}s  median={sorted(gaps)[len(gaps)//2]:.2f}s")
gapc = Counter(round(g, 2) for g in gaps)
print("gap histogram (s:count):", dict(sorted(gapc.items())))

# per-section contact counts + mean impact
print("\nper-section:")
for name in ["intro", "groove", "verse", "build", "chorus1", "chorus2", "breakdn", "drop2", "outro"]:
    grp = [c for c in contacts if c[2].startswith(name)]
    if grp:
        mi = sum(c[1] for c in grp) / len(grp)
        print(f"  {name:9s} n={len(grp):2d}  meanImpact={mi:.2f}  "
              f"t=[{grp[0][0]:.2f}..{grp[-1][0]:.2f}]")

# TS-ready beatTimes array
print("\n// === beatTimes (paste into spec) ===")
print("const beatTimes = [")
for i in range(0, len(contacts), 8):
    print("  " + ", ".join(f"{c[0]}" for c in contacts[i:i + 8]) + ",")
print("];")

out = [{"t": c[0], "impact": c[1], "role": c[2]} for c in contacts]
(Path(__file__).parent / "shelter81" / "grid.json").write_text(json.dumps(out, indent=2))
print(f"\nwrote beats/shelter81/grid.json ({len(out)} contacts)")
