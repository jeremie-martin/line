#!/usr/bin/env python3
"""The notes of each separated stem, found the same way in all four, and what repeats in each bar.

    python3 tools/music/lines.py SONG [SONG ...] [--from=S --to=S] [--marks]

Reads productions/<song>/audio.mp3 and generated/stems/<song>/{drums,bass,other,vocals}.wav (tools/music/stems.py).
Writes productions/<song>/lines.json and prints a digest to read. Needs ffmpeg and numpy only.

Why it exists (REWORK.md, November 17, "what the owner's marks showed"): an author who cannot hear chose landings from
detectors made for other questions. Sung notes are found by a loudness dip before each note, so a fast or chopped voice loses
most of its syllables (15 to 44% of the owner's voice marks on four songs); a figure that returns every bar inside one stem
was nowhere to be seen; and hits were sized by a sound's level where its attack is what is heard.

A note here is an attack: a peak of the stem's spectral rise standing above its surroundings, one per 90 ms at most. The same
detector and thresholds serve every stem; nothing is tuned per song. Each note records:
  t       when (the stem's own sharpest rise), seconds of the song
  attack  how sharp, as a fraction of that stem's own 95th percentile (1 = one of this stem's sharpest)
  heard   how much the whole mix rises there, on the mix's own scale: what a listener gets, whatever the stem
  loud    the stem's loudness just after, as a fraction of its own 95th percentile
  share   the stem's part of the mix's power there (0 to 1)
A stem is a separation, not a role: a sampled or processed voice often lands in `other`, and one audible sound can leave a
note in two stems. Nothing here selects landings.

The digest folds each block of four bars onto one bar of sixteen slots: per stem, the slots where a note returns in at least
three of the four bars, written as its mean attack (1-9); `·` where a note falls in one or two bars. A row like
`9...4..4..4.9...` is a figure; `9...9...9...9...` a pulse. The bar is a hypothesis: the lag (1.2 to 4.6 s) at which the
mix's rises repeat best, with that repetition's strength printed beside it; under about 0.4, do not trust the fold.
`--marks` adds the owner's marks (productions/<song>/notes.json, tags voice and mark) as rows, to check the view against
his ear; an author reading a song for the first time leaves it off.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

import numpy as np

RATE, WINDOW, HOP = 22050, 1024, 128  # Hz, samples, samples (5.8 ms)
STEMS = ("drums", "bass", "other", "vocals")
ABOVE, APART, SLOTS, BLOCK = 0.15, 0.09, 16, 4  # a note stands this far above its surroundings; seconds between notes


def measure(path: str) -> tuple[np.ndarray, np.ndarray]:
    """(rise, level) of a recording, every HOP samples: summed positive change of the log spectrum, and RMS. Shapes (n,)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"], stdout=subprocess.PIPE, check=True).stdout
    pcm = np.frombuffer(raw, dtype=np.float32)
    n = max(0, (len(pcm) - WINDOW) // HOP)
    mag = np.abs(np.fft.rfft(pcm[np.arange(WINDOW)[None, :] + HOP * np.arange(n)[:, None]] * np.hanning(WINDOW), axis=1))
    return np.r_[0, np.maximum(0, np.diff(np.log1p(100 * mag), axis=0)).sum(1)], np.sqrt((mag ** 2).mean(1))


def notes(rise: np.ndarray, level: np.ndarray, mix_rise: np.ndarray, mix_level: np.ndarray) -> list[dict]:
    """The attacks of one stem (see the module text)."""
    time = lambda i: (i * HOP + WINDOW / 2) / RATE
    around, after, top, mix_top = int(0.4 * RATE / HOP), int(0.12 * RATE / HOP), np.percentile(rise, 95) or 1, np.percentile(mix_rise, 95) or 1
    found: list[dict] = []
    for i in range(3, len(rise) - 3):
        if rise[i] < rise[i - 3:i + 4].max() or rise[i] <= np.median(rise[max(0, i - around):i + around]) + ABOVE * top:
            continue
        loud = float(level[i:i + after].max())
        note = {"t": round(time(i), 3), "attack": float(rise[i] / top), "heard": float(mix_rise[max(0, i - 3):i + 4].max() / mix_top),
                "loud": loud, "share": float(min(1, loud ** 2 / max(1e-12, (mix_level[i:i + after] ** 2).max())))}
        if found and note["t"] - found[-1]["t"] < APART:
            if note["attack"] > found[-1]["attack"]:
                found[-1] = note
        else:
            found.append(note)
    full = np.percentile([n["loud"] for n in found], 95) if found else 1
    return [{**n, "attack": round(n["attack"], 2), "heard": round(n["heard"], 2), "loud": round(n["loud"] / (full or 1), 2), "share": round(n["share"], 2)} for n in found]


def bar_of(mix_rise: np.ndarray) -> tuple[float, float]:
    """(seconds, strength 0-1): the lag between 1.2 and 4.6 s at which the mix's rises repeat best."""
    f = mix_rise - mix_rise.mean()
    spectrum = np.fft.rfft(f, 2 * len(f))
    repeat = np.fft.irfft(spectrum * np.conj(spectrum))[:len(f)]
    lo, hi = int(1.2 * RATE / HOP), min(len(f) - 1, int(4.6 * RATE / HOP))
    k = lo + int(np.argmax(repeat[lo:hi]))
    return k * HOP / RATE, float(repeat[k] / repeat[0])


def read(song: str) -> dict:
    mix_rise, mix_level = measure(f"productions/{song}/audio.mp3")
    stems = {s: measure(f"generated/stems/{song}/{s}.wav") for s in STEMS}
    n = min(len(mix_rise), *(len(v[0]) for v in stems.values()))
    lines = {s: notes(v[0][:n], v[1][:n], mix_rise[:n], mix_level[:n]) for s, v in stems.items()}
    bar, strength = bar_of(mix_rise[:n])
    # slot 0 is where the sharpest drum attacks fall (the sharpest of any stem when the drums are nearly silent)
    lead = lines["drums"] if len(lines["drums"]) >= 8 else [x for v in lines.values() for x in v]
    sharp = sorted(lead, key=lambda x: -x["attack"])[:max(4, len(lead) // 4)]
    beat = bar / 4
    phase = float(np.angle(np.mean([np.exp(2j * np.pi * x["t"] / beat) for x in sharp])) / (2 * np.pi) * beat) % beat if sharp else 0.0
    return {"song": song, "seconds": round(n * HOP / RATE, 2), "bar": {"seconds": round(bar, 3), "repeats": round(strength, 2), "first": round(phase, 3)}, "stems": lines}


def digest(data: dict, t0: float, t1: float, marks: dict[str, list[float]]) -> list[str]:
    bar, first = data["bar"]["seconds"], data["bar"]["first"]
    slot = lambda t: int(round(((t - first) % bar) / bar * SLOTS)) % SLOTS
    out = [f"\n=== {data['song']}  {data['seconds']} s  bar {bar} s (repeats {data['bar']['repeats']}; a hypothesis)  {SLOTS} slots per bar, {BLOCK} bars per row",
           "    digit = mean attack (1-9) of a note returning in that slot in 3 or 4 of the bars; · = in 1 or 2; share = the stem's part of the mix on its notes",
           f"{'from':>7}  " + "  ".join(f"{s:<{SLOTS}} shr" for s in STEMS) + ("  " + "  ".join(f"{k:<{SLOTS}}" for k in marks) if marks else "")]
    start = first + bar * np.floor((t0 - first) / bar)
    while start < min(t1, data["seconds"]):
        end, cells = start + BLOCK * bar, []
        for s in STEMS:
            inside = [x for x in data["stems"][s] if start <= x["t"] < end]
            row = []
            for k in range(SLOTS):
                here = [x for x in inside if slot(x["t"]) == k]
                row.append(" " if not here else "·" if len(here) < 3 else str(max(1, min(9, int(round(4 * np.mean([x["attack"] for x in here])))))))
            cells.append("".join(row) + f" {int(round(100 * np.mean([x['share'] for x in inside]))) if inside else 0:3d}")
        for times in marks.values():
            row = [" "] * SLOTS
            for t in times:
                if start <= t < end:
                    k = slot(t); row[k] = str(min(9, (int(row[k]) if row[k] != " " else 0) + 1))
            cells.append("".join(row))
        out.append(f"{max(0, start):7.2f}  " + "  ".join(cells))
        start = end
    return out


if __name__ == "__main__":
    options = {a.split("=")[0][2:]: (a.split("=") + [""])[1] for a in sys.argv[1:] if a.startswith("--")}
    for name in [a for a in sys.argv[1:] if not a.startswith("--")]:
        result = read(name)
        with open(f"productions/{name}/lines.json", "w") as handle:
            json.dump(result, handle, separators=(",", ":"))
        marks: dict[str, list[float]] = {}
        if "marks" in options and os.path.exists(f"productions/{name}/notes.json"):
            for note in json.load(open(f"productions/{name}/notes.json"))["notes"]:
                for tag in note.get("tags") or []:
                    if tag in ("voice", "mark") and note.get("scope") == "moment":
                        marks.setdefault(tag, []).append(note["t"])
        print("\n".join(digest(result, float(options.get("from") or 0), float(options.get("to") or 1e9), marks)))
