#!/usr/bin/env python3
"""How a ride's requested landings compare with the owner's marks on a song.

    python3 tools/music/marks.py --song=SONG RIDE_FOLDER [RIDE_FOLDER ...]

The owner sometimes marks by hand what he hears (the spec dashboard; productions/<song>/notes.json, moments tagged `voice`:
a syllable the ride should follow, or `mark`: an event of the main rhythm that should get an impact). His marks are quick
and approximate, and cover only the passages he chose, so this is a check, never a target: an author must not read the marks
of a song before writing its spec, and nothing is to be tuned until it scores well here. For each tag, inside the span his
marks cover and within 70 ms: how many of his marks the ride asks a landing on (found), how many of the ride's landings there
fall on a mark (on a mark), and the median requested strength on and off his marks. RIDE_FOLDER holds a compile's
manifest.json. Reads only; needs nothing but Python.
"""
import bisect
import json
import statistics
import sys

TOLERANCE = 0.07


def nearest(times, t):
    i = bisect.bisect(times, t)
    return min((times[j] for j in (i - 1, i) if 0 <= j < len(times)), key=lambda x: abs(x - t), default=1e9)


if __name__ == "__main__":
    song = next(a[7:] for a in sys.argv[1:] if a.startswith("--song="))
    notes = [n for n in json.load(open(f"productions/{song}/notes.json"))["notes"] if n.get("scope") == "moment"]
    for folder in [a for a in sys.argv[1:] if not a.startswith("--")]:
        cell = json.load(open(f"{folder}/manifest.json"))["cells"][0]
        asked = sorted((x["frame"] / 40, x["impact"]) for x in cell["impactEvaluation"]["targets"])
        print(f"{folder}  ({len(asked)} landings, ride {'complete' if cell.get('valid') else 'NOT complete'})")
        for tag in ("voice", "mark"):
            marks = sorted(n["t"] for n in notes if tag in (n.get("tags") or []))
            if not marks:
                continue
            inside = [(t, s) for t, s in asked if marks[0] - 0.1 <= t <= marks[-1] + 0.1]
            times = [t for t, _ in inside]
            found = sum(abs(nearest(times, t) - t) <= TOLERANCE for t in marks)
            on = [s for t, s in inside if abs(nearest(marks, t) - t) <= TOLERANCE]
            off = [s for t, s in inside if abs(nearest(marks, t) - t) > TOLERANCE]
            median = lambda v: f"{statistics.median(v):.2f}" if v else "  - "
            print(f"   {tag:5s} {len(marks):3d} marks {marks[0]:5.1f}-{marks[-1]:5.1f} s: found {found:3d} ({100 * found / len(marks):3.0f}%)   "
                  f"{len(inside):3d} landings there, {len(on):3d} on a mark ({100 * len(on) / max(1, len(inside)):3.0f}%)   strength on {median(on)} off {median(off)}")
