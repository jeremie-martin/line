#!/usr/bin/env python3
"""Transcribe the drum stem into kick / snare / hat / tom / cymbal hits with ADTOF
(Zehren et al., "High-quality and reproducible automatic drum transcription from
crowdsourced data"; Frame_RNN, adtofAll, fold 0).

    TF_USE_LEGACY_KERAS=1 ~/.venvs/line-adtof/bin/python tools/music/drums.py --song=trouble_50s

Reads generated/stems/<song>/drums.wav (run tools/music/stems.py first); running
on the isolated drums suppresses melodic hits mistaken for toms. ADTOF reports
identity and timing, not strength: every velocity is the same, so loudness comes
from the stem measurements. Writes generated/stems/<song>/drums.json.
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import pretty_midi  # noqa: E402
from adtof.model.model import Model  # noqa: E402

PITCH = {35: "kick", 38: "snare", 42: "hat", 47: "tom", 49: "cymbal"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--song", required=True)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    stem = root / "generated" / "stems" / args.song / "drums.wav"
    model, hparams = Model.modelFactory(modelName="Frame_RNN", scenario="adtofAll", fold=0)
    assert model.weightLoadedFlag, "ADTOF weights did not load"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / stem.name).symlink_to(stem)
        (tmp / "out").mkdir()
        model.predictFolder(str(tmp / f"*{stem.suffix}"), str(tmp / "out"), **hparams)
        midi = next((tmp / "out").glob("*.mid*"), None)
        assert midi, "ADTOF produced no MIDI"
        notes = [n for inst in pretty_midi.PrettyMIDI(str(midi)).instruments for n in inst.notes]
    hits = sorted(({"t": round(float(n.start), 3), "class": PITCH.get(int(n.pitch), "other")} for n in notes), key=lambda h: h["t"])
    out = root / "generated" / "stems" / args.song / "drums.json"
    out.write_text(json.dumps({"schema": "line.music-drums.v1", "song": args.song, "model": "ADTOF Frame_RNN adtofAll fold 0",
                               "source": "demucs drums stem", "hits": hits}))
    counts = {c: sum(h["class"] == c for h in hits) for c in [*PITCH.values(), "other"]}
    print(f"wrote {out}  {counts}")


if __name__ == "__main__":
    main()
