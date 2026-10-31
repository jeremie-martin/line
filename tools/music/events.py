#!/usr/bin/env python3
"""Merge the stem measurements and drum transcription into one event list, and
render close-up sheets for reading the music section by section.

    ~/.venvs/line-stems/bin/python tools/music/events.py --song=trouble_50s [--contacts=FILE.json]

An event is every onset in any stem; onsets within 40 ms of each other merge into
one event. Each event records, per stem present, its peak loudness and rise
(tools/music/stems.py), the drum classes ADTOF heard there, and the mix's peak
and rise. Its time is the onset of its sharpest rise. Nothing is selected or
scored: the event list is evidence for the author, not a contact list.

Writes productions/<song>/events.json (tracked beside the spec, which reads it)
and generated/stems/<song>/sheets/<t0>-<t1>.png: the mix spectrogram, one
loudness lane per stem with its onsets, drum classes, and, given --contacts
(a JSON list of {t, impact}), the spec's landings, sized by requested impact.
tools/music/sung.py redraws the sheets with its sung notes on the vocals lane.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import librosa
import librosa.display
import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import MultipleLocator  # noqa: E402

STEMS = ("drums", "bass", "vocals", "other")
COLORS = {"drums": "#c4483f", "bass": "#3a5f8a", "vocals": "#d4843a", "other": "#3e8f6c"}
DRUM_MARK = {"kick": "v", "snare": "s", "hat": "^", "tom": "D", "cymbal": "*", "other": "o"}
MERGE_S, DRUM_MATCH_S, WINDOW_S = 0.040, 0.050, 5.0


def build_events(stems: dict, drums: dict) -> list[dict]:
    times = np.array(stems["times"])
    mix_env = np.array(stems["mix"]["rms"])
    onsets = sorted(((o["t"], s, o) for s in STEMS for o in stems["stems"][s]["onsets"]), key=lambda x: x[0])
    groups: list[list] = []
    for item in onsets:
        if groups and item[0] - groups[-1][0][0] <= MERGE_S:
            groups[-1].append(item)
        else:
            groups.append([item])
    events = []
    for group in groups:
        sources: dict[str, dict] = {}
        for t, s, o in group:
            if s not in sources or o["rise"] > sources[s]["rise"]:
                sources[s] = {"t": t, "peak": o["peak"], "rise": o["rise"]}
        t = max(sources.values(), key=lambda v: v["rise"])["t"]
        if "drums" in sources:
            classes = sorted({h["class"] for h in drums["hits"] if abs(h["t"] - sources["drums"]["t"]) <= DRUM_MATCH_S})
            if classes:
                sources["drums"]["classes"] = classes
        i = int(np.searchsorted(times, t))
        pre, after = max(0, i - 9), min(len(mix_env), i + 5)
        peak = float(mix_env[i:after].max()) if i < after else 0.0
        events.append({"t": round(t, 3), "sources": sources,
                       "mix": {"peak": round(peak, 3), "rise": round(peak - float(mix_env[pre:i + 1].min()), 3)}})
    return events


def render_sheets(song: str, root: Path, stems: dict, drums: dict, contacts: list[dict] | None,
                  sung: dict | None = None) -> int:
    """sung: tools/music/sung.py's output; its notes are drawn on the vocals lane as
    triangles (height and opacity by salience), its unpitched attacks as grey crosses."""
    out = root / "generated" / "stems" / song / "sheets"
    out.mkdir(parents=True, exist_ok=True)
    y, sr = librosa.load(root / "productions" / song / "audio.mp3", sr=22050, mono=True)
    duration = len(y) / sr
    times = np.array(stems["times"])
    hop = 256
    S = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=1024, hop_length=hop)), ref=np.max)
    count = 0
    for t0 in np.arange(0, duration, WINDOW_S - 0.5):
        t1 = min(duration, t0 + WINDOW_S)
        fig, ax = plt.subplots(6, 1, figsize=(16, 11), sharex=True, gridspec_kw={"height_ratios": [3, 1, 1, 1, 1, 0.8]})
        a, b = int(t0 * sr / hop), int(t1 * sr / hop) + 1
        librosa.display.specshow(S[:, a:b], sr=sr, hop_length=hop, y_axis="log", ax=ax[0],
                                 x_coords=librosa.frames_to_time(np.arange(a, a + S[:, a:b].shape[1]), sr=sr, hop_length=hop))
        ax[0].set_ylabel("mix")
        m = (times >= t0) & (times <= t1)
        top = max(max(np.array(stems["stems"][s]["rms"])[m].max() for s in STEMS), 1e-6)
        for k, s in enumerate(STEMS, start=1):
            ax[k].fill_between(times[m], np.array(stems["stems"][s]["rms"])[m], color=COLORS[s], linewidth=0)
            ax[k].set_ylim(0, top * 1.1)
            ax[k].set_ylabel(s)
            for o in stems["stems"][s]["onsets"]:
                if t0 <= o["t"] <= t1:
                    ax[k].axvline(o["t"], color="k", lw=0.5, alpha=0.25 + 0.75 * min(1, o["rise"] / top))
        for note in (sung or {}).get("notes", []):
            if t0 <= note["t"] <= t1:
                ax[3].plot(note["t"], top * (0.3 + 0.75 * note["salience"]), "v", color="#7a3a00",
                           alpha=0.35 + 0.65 * note["salience"], ms=7)
        for note in (sung or {}).get("unpitched", []):
            if t0 <= note["t"] <= t1:
                ax[3].plot(note["t"], top * 0.3, "x", color="#777777", ms=6)
        for h in drums["hits"]:
            if t0 <= h["t"] <= t1:
                ax[1].plot(h["t"], top * 1.02, DRUM_MARK.get(h["class"], "o"), color="k", ms=6)
        ax[5].set_ylabel("spec")
        ax[5].set_ylim(0, 1.05)
        for c in contacts or []:
            if t0 <= c["t"] <= t1:
                ax[5].vlines(c["t"], 0, c.get("impact", 0.5), color="#5b2a86", lw=2)
                for axis in ax[:5]:
                    axis.axvline(c["t"], color="#5b2a86", lw=0.8, ls=":")
        ax[5].xaxis.set_major_locator(MultipleLocator(0.5))
        ax[5].xaxis.set_minor_locator(MultipleLocator(0.1))
        ax[5].set_xlim(t0, t1)
        ax[5].set_xlabel("time (s) — drum marks: v kick, s snare, ^ hat, D tom, * cymbal; purple: spec landings"
                         + ("; vocals lane: sung notes (higher = more salient), x unpitched" if sung else ""))
        fig.tight_layout()
        fig.savefig(out / f"{t0:05.1f}-{t1:05.1f}.png", dpi=80)
        plt.close(fig)
        count += 1
    return count


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--song", required=True)
    ap.add_argument("--contacts")
    ap.add_argument("--no-sheets", action="store_true")
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    base = root / "generated" / "stems" / args.song
    stems = json.loads((base / "stems.json").read_text())
    drums = json.loads((base / "drums.json").read_text())
    events = build_events(stems, drums)
    out = root / "productions" / args.song / "events.json"
    out.write_text(json.dumps({"schema": "line.music-events.v1", "song": args.song, "loudness_unit": stems["loudness_unit"],
                               "separation": stems["separation"], "drums": drums["model"], "events": events}, indent=0))
    print(f"wrote {out}  ({len(events)} events)")
    if not args.no_sheets:
        contacts = json.loads(Path(args.contacts).read_text()) if args.contacts else None
        print(f"rendered {render_sheets(args.song, root, stems, drums, contacts)} sheets in {base / 'sheets'}")


if __name__ == "__main__":
    main()
