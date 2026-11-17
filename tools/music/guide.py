#!/usr/bin/env python3
"""Whether a ride lands what the owner's guide asks.

    python3 tools/music/guide.py --song=SONG RIDE_FOLDER [RIDE_FOLDER ...]

productions/<song>/guide.json (generated/concept-lab/closing/guides.mjs, from the ear board) holds, per passage the owner
set, what the ride should follow there and the notes that selects. For each passage this prints how many of its notes the
ride asks a landing on (within 50 ms), the notes it leaves out, and the landings it asks there that are not guide notes.
Neither list is an error by itself: the guide is set by ear in a minute, so it can hold a stray note or miss one; the author
says why in the spec. RIDE_FOLDER holds a compile's manifest.json. Reads only.
"""
import bisect
import json
import sys

NEAR = 0.05  # seconds


def nearest(times, t):
    i = bisect.bisect(times, t)
    return min((times[j] for j in (i - 1, i) if 0 <= j < len(times)), key=lambda x: abs(x - t), default=1e9)


if __name__ == "__main__":
    song = next(a[7:] for a in sys.argv[1:] if a.startswith("--song="))
    guide = json.load(open(f"productions/{song}/guide.json"))
    for folder in [a for a in sys.argv[1:] if not a.startswith("--")]:
        cell = json.load(open(f"{folder}/manifest.json"))["cells"][0]
        asked = sorted(x["frame"] / 40 for x in cell["impactEvaluation"]["targets"])
        print(f"{folder}  ({len(asked)} landings, ride {'complete' if cell.get('valid') else 'NOT complete'})")
        for p in guide["passages"]:
            notes = [n["t"] for n in p["notes"]]
            inside = [t for t in asked if p["from"] - NEAR <= t < p["to"] + NEAR]
            missing = [t for t in notes if abs(nearest(inside, t) - t) > NEAR]
            extra = [t for t in inside if abs(nearest(notes, t) - t) > NEAR]
            print(f"   {p['from']:6.2f}-{p['to']:6.2f} {'+'.join(p['follow']):14s} {len(notes) - len(missing):3d} of {len(notes):3d} guide notes landed; "
                  f"{len(extra):3d} other landings")
            if missing:
                print("      not landed: " + " ".join(f"{t:.2f}" for t in missing))
            if extra:
                print("      not in the guide: " + " ".join(f"{t:.2f}" for t in extra))
