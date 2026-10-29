#!/usr/bin/env python3
"""Separate a song into instrument stems and measure each one.

    ~/.venvs/line-stems/bin/python tools/music/stems.py --song=trouble_50s

Demucs (htdemucs) splits productions/<song>/audio.mp3 into drums, bass, vocals
and other under generated/stems/<song>/ (skipped if already there). Each stem is
then measured on one shared time grid:

  - rms:      loudness envelope, as a fraction of the MIX's 99th-percentile RMS,
              so stems are comparable with each other (a quiet stem stays quiet);
  - onsets:   librosa onset times in that stem, each with its local peak loudness
              (same scale) and its rise: peak minus the quietest level in the
              100 ms before, i.e. how much the stem jumps at that moment.

Measures only. Choosing which events become landings is the author's job
(docs/music-authoring.md). Writes generated/stems/<song>/stems.json.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import librosa
import numpy as np

STEMS = ("drums", "bass", "vocals", "other")
SR, HOP = 22050, 256  # 11.6 ms frames


def separate(audio: Path, out: Path) -> None:
    if all((out / f"{s}.wav").exists() for s in STEMS):
        return
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, "-m", "demucs", "-n", "htdemucs", "-j", "8", "--out", tmp, str(audio)], check=True)
        produced = Path(tmp) / "htdemucs" / audio.stem
        for s in STEMS:
            shutil.move(str(produced / f"{s}.wav"), out / f"{s}.wav")


def rms(y: np.ndarray) -> np.ndarray:
    return librosa.feature.rms(y=y, hop_length=HOP)[0]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--song", required=True)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    audio = root / "productions" / args.song / "audio.mp3"
    out = root / "generated" / "stems" / args.song
    separate(audio, out)

    mix, _ = librosa.load(audio, sr=SR, mono=True)
    mix_rms = rms(mix)
    scale = float(np.percentile(mix_rms, 99))
    n = len(mix_rms)
    times = librosa.frames_to_time(np.arange(n), sr=SR, hop_length=HOP)
    pre = round(0.100 / (HOP / SR))
    after = round(0.050 / (HOP / SR))

    def stem_record(y: np.ndarray) -> dict:
        env = rms(y)[:n] / scale
        env = np.pad(env, (0, n - len(env)))
        frames = librosa.onset.onset_detect(y=y, sr=SR, hop_length=HOP, backtrack=False)
        onsets = []
        for f in frames[frames < n]:
            peak = float(env[f:f + after + 1].max())
            floor = float(env[max(0, f - pre):f + 1].min())
            onsets.append({"t": round(float(times[f]), 3), "peak": round(peak, 3), "rise": round(peak - floor, 3)})
        return {"rms": [round(float(v), 4) for v in env], "onsets": onsets}

    record = {
        "schema": "line.music-stems.v1",
        "song": args.song,
        "separation": "demucs htdemucs",
        "frame_s": HOP / SR,
        "loudness_unit": "fraction of the mix's 99th-percentile RMS",
        "times": [round(float(t), 4) for t in times],
        "mix": stem_record(mix),
        "stems": {},
    }
    for s in STEMS:
        y, _ = librosa.load(out / f"{s}.wav", sr=SR, mono=True)
        record["stems"][s] = stem_record(y)
    (out / "stems.json").write_text(json.dumps(record))
    counts = ", ".join(f"{s} {len(record['stems'][s]['onsets'])}" for s in STEMS)
    print(f"wrote {out / 'stems.json'}  (onsets: mix {len(record['mix']['onsets'])}, {counts})")


if __name__ == "__main__":
    main()
