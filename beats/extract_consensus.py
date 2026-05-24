"""
Export the v7 consensus onsets (same logic as the dashboard) to JSON.

Streams = the 5 currently-voting ones in the dashboard:
    rnn_drums  · stem_drums  · band_kick  · band_snare  · band_hat
Min votes  = 3
Window     = 0 ms (exact-match on snapped grid time)

Usage:
    python extract_consensus.py                     # full song → drums_consensus.json
    python extract_consensus.py 0 30 drums_0_30s    # 0–30 s slice → drums_0_30s.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent

STREAMS    = ["rnn_drums", "stem_drums", "band_kick", "band_snare", "band_hat"]
MIN_VOTES  = 3
WINDOW_MS  = 0  # exact grid-time match


def consensus(corrected: dict, streams=STREAMS, min_votes=MIN_VOTES, window_ms=WINDOW_MS):
    events = []
    for key in streams:
        s = corrected["streams"].get(key)
        if not s:
            continue
        for k in s["kept"]:
            events.append((round(k["t"] * 1000), key))
    events.sort()

    clusters = []
    for ms, src in events:
        if clusters and (ms - clusters[-1]["first_ms"]) <= window_ms:
            clusters[-1]["times"].append(ms)
            clusters[-1]["sources"].add(src)
        else:
            clusters.append({"first_ms": ms, "times": [ms], "sources": {src}})

    out = []
    for c in clusters:
        if len(c["sources"]) < min_votes:
            continue
        c["times"].sort()
        med = c["times"][len(c["times"]) // 2] / 1000.0
        out.append({
            "t":       round(med, 4),
            "votes":   len(c["sources"]),
            "sources": sorted(c["sources"]),
        })
    return out


def main():
    t0 = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    t1 = float(sys.argv[2]) if len(sys.argv) > 2 else None
    name = sys.argv[3] if len(sys.argv) > 3 else "drums_consensus"

    corr = json.load(open(HERE / "detection_corrected.json"))
    hits = consensus(corr)
    if t1 is not None:
        hits = [h for h in hits if t0 <= h["t"] <= t1]

    out = {
        "source":      "detection_corrected.json (v6 snapped streams)",
        "ensemble":    STREAMS,
        "min_votes":   MIN_VOTES,
        "window_ms":   WINDOW_MS,
        "range_s":     [t0, t1] if t1 is not None else None,
        "n_events":    len(hits),
        "onsets":      hits,
    }
    out_path = HERE / f"{name}.json"
    out_path.write_text(json.dumps(out, indent=2))
    print(f"wrote {out_path}  ({len(hits)} events, {out_path.stat().st_size/1024:.1f} KiB)")
    if hits:
        rate = len(hits) / (t1 - t0 if t1 is not None else hits[-1]["t"] - hits[0]["t"])
        print(f"  density: {rate:.2f} hits/s")
        print(f"  first 6: {[h['t'] for h in hits[:6]]}")


if __name__ == "__main__":
    main()
