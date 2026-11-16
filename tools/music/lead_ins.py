"""What the recording does over the song and just before each section change, as rows of digits to read.

  python3 tools/music/lead_ins.py [SONG ...]        (all songs with a lab scene when none is named)

For each song (its scene in generated/lab-rides/<song>.json gives the sections; generated/concept-lab/prepare-rides.mjs
makes it): loudness, sub bass (20-110 Hz), bass, mid, high and onset flux in 0.5 s steps, each as a digit 0-9 of the
song's own 98th percentile; the spec's asked impacts on the same line; and for every section change the 3 s before and
1.5 s after in 0.1 s steps. Written for placing zoom moves: a lead-in (a fill, a pause, a swell, a pickup) shows as the
level changing before the bar line. It measures and prints; it decides nothing. Needs ffmpeg and numpy.
"""
import glob
import json
import os
import subprocess
import sys

import numpy as np

RATE, WINDOW, HOP = 22050, 2048, 441  # Hz, samples, samples (20 ms)


def digest(song: str) -> list[str]:
    """Lines for one song. Rows are (n_steps,) digit strings; times are song seconds."""
    scene = json.load(open(f"generated/lab-rides/{song}.json"))
    end = scene["span"][1]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"productions/{song}/audio.mp3", "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype=np.float32)
    n = (len(pcm) - WINDOW) // HOP
    frames = pcm[np.arange(WINDOW)[None, :] + HOP * np.arange(n)[:, None]] * np.hanning(WINDOW)
    mag = np.abs(np.fft.rfft(frames, axis=1))
    freq = np.fft.rfftfreq(WINDOW, 1 / RATE)
    t = (np.arange(n) * HOP + WINDOW / 2) / RATE

    def band(lo: float, hi: float) -> np.ndarray:
        return np.sqrt((mag[:, (freq >= lo) & (freq < hi)] ** 2).sum(1))

    def scaled(v: np.ndarray) -> np.ndarray:
        return v / max(1e-9, np.percentile(v, 98))

    flux = np.r_[0, np.maximum(0, np.diff(np.log1p(mag), axis=0)).sum(1)]
    rows = {"loud": scaled(band(0, RATE / 2)), "sub ": scaled(band(20, 110)), "bass": scaled(band(110, 300)),
            "mid ": scaled(band(300, 3000)), "high": scaled(band(5000, RATE / 2)), "hits": scaled(flux)}

    def digits(v: np.ndarray, step: float, t0: float, t1: float) -> str:
        out, x = "", t0
        while x < t1 - 1e-9:
            m = (t >= x) & (t < x + step)
            out += str(min(9, int(round(9 * float(v[m].mean()))))) if m.any() else " "
            x += step
        return out

    lines = [f"\n=== {song}  {end:.1f} s  drop={scene['drop']}",
             "sections: " + " | ".join(f"{p['t0']:.2f} {p['name']}" for p in scene["phases"]),
             "lanes: " + " ; ".join(f"{z['id']} ({z['name']})" for z in scene["zooms"]),
             "      " + "".join(f"{x:<20d}" for x in range(0, int(end) + 1, 10))[:int(end * 2) + 1] + "   (one character = 0.5 s)"]
    lines += [f"{name}  {digits(v, 0.5, 0, end)}" for name, v in rows.items()]
    asked = [" "] * int(end * 2 + 1)
    for target in (scene.get("account") or {}).get("targets") or []:
        if target.get("beat") is None or target.get("impact") is None:
            continue
        i = int(target["beat"] * 2)
        if i < len(asked):
            asked[i] = str(max(int(asked[i]) if asked[i] != " " else 0, min(9, int(round(9 * target["impact"])))))
    lines.append("ask   " + "".join(asked))
    for p in scene["phases"][1:]:
        b = p["t0"]
        lines.append(f"  @{b:.2f} {p['name']}: 3 s before | 1.5 s after, 0.1 s steps   " + "  ".join(
            f"{name.strip()} {digits(rows[name], 0.1, b - 3, b)}|{digits(rows[name], 0.1, b, b + 1.5)}" for name in ("loud", "sub ", "hits", "mid ")))
    return lines


if __name__ == "__main__":
    songs = sys.argv[1:] or sorted(os.path.basename(f)[:-5] for f in glob.glob("generated/lab-rides/*.json"))
    for name in songs:
        print("\n".join(digest(name)))
