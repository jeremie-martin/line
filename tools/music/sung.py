#!/usr/bin/env python3
"""Find the sung notes in the vocal stem: where a new note or syllable starts,
and how clearly it would be heard.

    ~/.venvs/line-stems/bin/python tools/music/sung.py --song=valhalla_40s

Reads generated/stems/<song>/vocals.wav and stems.json (tools/music/stems.py).

An attack is a rise of the vocal loudness (the stems.json envelope) by at least
MIN_RISE_DB from the dip before it: a new syllable, or a new word on the same
pitch. stems.py's spectral-flux onsets miss a word re-sung on the same pitch
(Valhalla 11.92 s); a loudness rise does not. The attack's time is the
spectral-flux peak of the vocal stem between the steepest point of the rise
and the loudness peak, close to the convention of events.json. A rise alone cannot tell a sung note from a breath, a consonant or noise
in a held note, so each attack is also asked whether what follows it is pitched:

  - tonality: the spectral flatness (80 Hz-5 kHz) of the vocal stem over the
    note's body, 50-250 ms after the attack. A pitched voice is a few harmonics
    (flatness about 0.005); noise is flat (about 0.56). An attack whose body is
    nearer noise than tone on a log scale (flatness above NOISE_FLATNESS, the
    geometric midpoint 0.05) is listed under "unpitched", not as a note.
  - voicing: pyin's highest voiced probability over the body. pyin follows one
    melody line, so it is high for a solo voice and low for chords (a choir, a
    pad); it is reported, with the pitch, but does not decide.

Flatness has no clean gap between voice and noise; a note or attack within a
factor of two of NOISE_FLATNESS is marked "borderline": confirm it by ear.

Each note records its time, the dip-to-peak rise in dB, its peak loudness (the
stems.json scale: a fraction of the mix's 99th-percentile RMS), its share of
the sound (vocal power over all stems' power at the peak), tonality, voicing,
pitch, the interval in semitones from the previous note when both are pitched
and less than a second apart, and length (until the voice falls 6 dB below the note's peak, or
the next attack), and a salience in 0..1:

    salience = min(1, rise_db / FULL_RISE_DB) * share

i.e. how big the jump is, and how much of what you hear at that moment is the
voice. A new pitch with little loudness rise (Trouble 0.86 s, +7 semitones,
3 dB) is found but gets a low salience; the interval is reported, not scored. The constants come from general reasoning (3 dB doubles the power; 12 dB
is a rise from a quarter of the amplitude; 0.05 is the log midpoint between a
tone and noise), not from fitting labels; docs/research/sung-notes-20261031.md
has the evaluation and says which labels informed the design.

Each note names the events.json event within MATCH_S, with its stems. music.ts
references a note by that event's time (event(t) in scripts/v0/core/measured.ts
matches within 30 ms); a note without one cannot be referenced yet.
Measures only; choosing landings is the author's job (docs/music-authoring.md).

Writes productions/<song>/sung.json and redraws the 5-second sheets with the
notes on the vocals lane (--no-sheets to skip; --contacts as in events.py).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import librosa
import numpy as np

SR, HOP = 22050, 256          # same grid as stems.py (11.6 ms frames)
FMIN, FMAX = 65.0, 1050.0     # C2..C6: the singing range, for pyin
BAND = (80.0, 5000.0)         # where a voice's harmonics carry, for flatness
MIN_RISE_DB = 3.0             # an attack at least doubles the power
FULL_RISE_DB = 12.0           # a rise from a quarter of the amplitude is a full attack
NOISE_FLATNESS = 0.05         # log midpoint between a tone (~0.005) and noise (~0.56)
BODY_S = (0.05, 0.25)         # a note's body, after its attack
LOOKBACK_S = 0.30             # how far back the dip before an attack is sought
PEAK_HALF_S = 0.035           # a loudness peak is the maximum within +-35 ms
MATCH_S = 0.05                # a note names the events.json event within 50 ms (events.py merges at 40)
END_DB = 6.0                  # a note ends when it falls to half its peak amplitude
STEMS = ("drums", "bass", "vocals", "other")


def frames(seconds: float) -> int:
    return max(1, round(seconds * SR / HOP))


def attacks(env: np.ndarray, flux: np.ndarray) -> list[tuple[int, int, float]]:
    """(onset frame, peak frame, rise dB) for each loudness peak that rises MIN_RISE_DB
    above the dip before it. The onset is the spectral-flux peak from the steepest point
    of the rise to just after the loudness peak (from the dip itself, a long rise can
    pick the consonant or breath before the vowel)."""
    smooth = np.convolve(env, np.ones(3) / 3, mode="same")
    db = 20 * np.log10(np.maximum(smooth, 1e-4))
    n, half, back = len(env), frames(PEAK_HALF_S), frames(LOOKBACK_S)
    out, prev_peak = [], 0
    for p in range(1, n - 1):
        if smooth[p] < smooth[max(0, p - half):p + half + 1].max() or smooth[p] == smooth[p - 1]:
            continue
        a = max(prev_peak, p - back)
        m = a + int(np.argmin(smooth[a:p + 1]))
        prev_peak = p
        if p > m and db[p] - db[m] >= MIN_RISE_DB:
            steep = m + 1 + int(np.argmax(np.diff(db[m:p + 1])))
            out.append((steep + int(np.argmax(flux[steep:p + 3])), p, float(db[p] - db[m])))
    return out


def detect(vocals: np.ndarray, stems: dict) -> tuple[list[dict], list[dict]]:
    times = np.array(stems["times"])
    n = len(times)
    fit = lambda a: np.pad(a[:n], (0, max(0, n - len(a))))  # noqa: E731
    env = np.array(stems["stems"]["vocals"]["rms"])
    acc = np.sqrt(sum(np.array(stems["stems"][s]["rms"]) ** 2 for s in STEMS if s != "vocals"))

    S = np.abs(librosa.stft(vocals, n_fft=2048, hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    flat = fit(librosa.feature.spectral_flatness(S=S[(freqs >= BAND[0]) & (freqs <= BAND[1])])[0])
    f0, _, vprob = librosa.pyin(vocals, fmin=FMIN, fmax=FMAX, sr=SR, hop_length=HOP, frame_length=2048)
    f0, vprob = fit(f0), np.convolve(fit(vprob), np.ones(3) / 3, mode="same")

    flux = fit(librosa.onset.onset_strength(y=vocals, sr=SR, hop_length=HOP))
    found = attacks(env, flux)
    notes, unpitched = [], []
    for k, (i, p, rise) in enumerate(found):
        nxt = found[k + 1][0] if k + 1 < len(found) else n
        body = slice(min(i + frames(BODY_S[0]), nxt - 1), max(min(i + frames(BODY_S[1]), nxt), i + frames(BODY_S[0]) + 1))
        flatness = float(np.median(flat[body]))
        voicing = float(vprob[body].max())
        share = float(env[p] ** 2 / max(env[p] ** 2 + acc[p] ** 2, 1e-12))
        rec = {"t": round(float(times[i]), 3), "rise_db": round(rise, 1), "peak": round(float(env[p]), 3),
               "share": round(share, 2), "flatness": round(flatness, 3), "voicing": round(voicing, 2),
               "salience": round(min(1.0, rise / FULL_RISE_DB) * share, 2)}
        if NOISE_FLATNESS / 2 <= flatness <= NOISE_FLATNESS * 2:
            rec["borderline"] = True
        if flatness > NOISE_FLATNESS:
            unpitched.append(rec)
            continue
        hz = f0[body][vprob[body] >= 0.5]
        hz = hz[np.isfinite(hz)]
        midi = float(np.round(librosa.hz_to_midi(np.median(hz)))) if len(hz) else None
        rec["pitch"] = librosa.midi_to_note(midi) if midi is not None else None
        prev = notes[-1] if notes else None
        if midi is not None and prev and prev.get("_midi") is not None and times[i] - prev["t"] <= 1.0:
            rec["interval"] = int(midi - prev["_midi"])
        quiet = np.nonzero(env[p:nxt] < env[p] * 10 ** (-END_DB / 20))[0]
        rec["dur"] = round(float(times[min(p + quiet[0] if len(quiet) else nxt, n - 1)] - times[i]), 2)
        rec["_midi"] = midi
        notes.append(rec)
    for rec in notes:
        del rec["_midi"]
    return notes, unpitched


def name_events(records: list[dict], events_path: Path) -> None:
    if not events_path.exists():
        return
    events = json.loads(events_path.read_text())["events"]
    ts = np.array([e["t"] for e in events])
    for r in records:
        j = int(np.argmin(np.abs(ts - r["t"])))
        r["event"] = {"t": events[j]["t"], "stems": sorted(events[j]["sources"])} if abs(ts[j] - r["t"]) <= MATCH_S + 1e-9 else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--song", required=True)
    ap.add_argument("--contacts")
    ap.add_argument("--no-sheets", action="store_true")
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    base = root / "generated" / "stems" / args.song
    stems = json.loads((base / "stems.json").read_text())
    vocals, _ = librosa.load(base / "vocals.wav", sr=SR, mono=True)
    notes, unpitched = detect(vocals, stems)
    name_events(notes + unpitched, root / "productions" / args.song / "events.json")
    out = root / "productions" / args.song / "sung.json"
    record = {
        "schema": "line.music-sung.v1", "song": args.song,
        "source": "vocals stem (demucs htdemucs): loudness rises, spectral flatness, librosa pyin",
        "loudness_unit": stems["loudness_unit"], "salience": "min(1, rise_db / 12) * share",
        "notes": notes, "unpitched": unpitched}
    out.write_text(json.dumps(record, indent=0, ensure_ascii=False))
    print(f"wrote {out}  ({len(notes)} notes, {len(unpitched)} unpitched attacks)")
    if not args.no_sheets:
        import events as ev   # tools/music/events.py
        drums = json.loads((base / "drums.json").read_text())
        contacts = json.loads(Path(args.contacts).read_text()) if args.contacts else None
        print(f"rendered {ev.render_sheets(args.song, root, stems, drums, contacts, record)} sheets in {base / 'sheets'}")


if __name__ == "__main__":
    main()
