"""
ADTOF drum transcription — the actual purpose-built drum-piece transcription
model from "High-quality and reproducible automatic drum transcription from
crowdsourced data" (Zehren et al.).

Output classes (General MIDI drum map):
   35  BD   bass drum / kick
   38  SD   snare
   42  HH   hi-hat
   47  TT   tom toms
   49  CY+RD cymbals + ride

Usage:
    python extract_adtof.py                   # mix → detection_adtof.json
    python extract_adtof.py stems/drums.mp3   # stem → detection_adtof_stem.json

The model was trained on full mixes, but recent work (arxiv 2509.24853) shows
running it on a Demucs-isolated drums stem can suppress confounders like
synth/anchor hits that get misclassified as toms.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import pretty_midi as pm

# Quiet TF down before import
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

from adtof.model.model import Model

HERE = Path(__file__).parent
AUDIO = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "audio.mp3"
# Suffix the output so mix vs stem runs don't clobber each other.
suffix = "" if AUDIO.name == "audio.mp3" else "_stem"
OUT_JSON = HERE / f"detection_adtof{suffix}.json"
OUT_MIDI = HERE / f"detection_adtof{suffix}.mid"

PITCH_TO_LABEL = {
    35: "kick",
    38: "snare",
    42: "hat",
    47: "tom",
    49: "cymbal",
}


def main():
    print("loading Frame_RNN / adtofAll / fold 0 ...")
    model, hparams = Model.modelFactory(
        modelName="Frame_RNN", scenario="adtofAll", fold=0,
    )
    assert model.weightLoadedFlag

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        # Symlink the audio into a tmp folder (predictFolder takes a glob)
        link = td / AUDIO.name
        try:
            link.symlink_to(AUDIO.resolve())
        except OSError:
            shutil.copy(AUDIO, link)
        out_dir = td / "out"
        out_dir.mkdir()
        print(f"running model on {AUDIO} ...")
        model.predictFolder(str(td / "*.mp3"), str(out_dir), **hparams)

        midi_files = list(out_dir.glob("*.mid")) + list(out_dir.glob("*.midi"))
        assert midi_files, f"no MIDI produced — out_dir contents: {list(out_dir.iterdir())}"
        midi_path = midi_files[0]
        print(f"reading MIDI: {midi_path.name}")
        midi = pm.PrettyMIDI(str(midi_path))
        shutil.copy(midi_path, OUT_MIDI)

    classes = {label: [] for label in PITCH_TO_LABEL.values()}
    classes["other"] = []
    for inst in midi.instruments:
        for note in inst.notes:
            label = PITCH_TO_LABEL.get(int(note.pitch), "other")
            classes[label].append({"t": float(note.start), "velocity": int(note.velocity)})

    for label, hits in classes.items():
        hits.sort(key=lambda h: h["t"])
        print(f"  {label:6s}: {len(hits)} hits ({len(hits)/midi.get_end_time():.2f}/s)")

    out = {
        "audio_file": AUDIO.name,
        "duration":   float(midi.get_end_time()),
        "model":      "Frame_RNN / adtofAll / fold 0",
        "classes":    classes,
    }
    OUT_JSON.write_text(json.dumps(out))
    print(f"\nwrote {OUT_JSON} ({OUT_JSON.stat().st_size/1024:.1f} KiB)")
    print(f"  + {OUT_MIDI.name} ({OUT_MIDI.stat().st_size/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
