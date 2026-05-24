"""
Extract beat / drum / bass onsets + section structure from an audio file.

All steps are stock librosa idioms — no per-song tuning.

  1. Load mono audio @ 22050 Hz.
  2. HPSS: harmonic + percussive split.
  3. Beat grid:
        a. librosa.beat.beat_track on the percussive onset envelope.
        b. Take median IBI as the canonical period.
        c. Extrapolate uniformly forward AND backward to cover [0, duration].
        Rationale: beat_track's dynamic-programming search sometimes truncates
        early/late even when onsets are strong. For a steady-tempo pop song
        the cleanest fix is to lock the grid to the detected period and let
        the *phase* come from the section that was tracked confidently.
  4. Drum onsets:  onset_detect on the percussive component.
  5. Bass onsets:  multi-band onset_strength → low mel bands only (< 200 Hz).
  6. Sections:     librosa.segment.agglomerative on chroma + MFCC stack.
  7. Envelope:     RMS at ~10 ms hop for waveform rendering.

Writes detection.json next to the input.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np

SR = 22050
HOP = 512  # ~23 ms
N_SECTIONS = 10
BASS_HZ_MAX = 200.0  # mel-band cutoff for the "bass" onset channel


def steady_beat_grid(onset_env, sr, hop, duration):
    """beat_track → take period + phase → extrapolate to full song.

    Returns (beat_times: np.ndarray, tempo_bpm: float, anchor_range: tuple).
    """
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=hop, start_bpm=125.0,
    )
    bt = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    tempo_val = float(np.atleast_1d(tempo)[0])

    # Use median IBI as period — robust to outliers / dropped beats.
    ibis = np.diff(bt)
    period = float(np.median(ibis))
    bpm_from_period = 60.0 / period

    # Extrapolate backward from first detected beat.
    pre = []
    t = bt[0] - period
    while t > 0:
        pre.append(t)
        t -= period
    pre.reverse()
    # Extrapolate forward.
    post = []
    t = bt[-1] + period
    while t < duration:
        post.append(t)
        t += period

    full = np.concatenate([np.array(pre), bt, np.array(post)])
    return full, bpm_from_period, (float(bt[0]), float(bt[-1]))


def main(audio_path: Path, out_path: Path) -> None:
    print(f"loading {audio_path} ...")
    y, sr = librosa.load(str(audio_path), sr=SR, mono=True)
    duration = len(y) / sr
    print(f"  {duration:.2f}s @ {sr} Hz")

    print("HPSS ...")
    y_harm, y_perc = librosa.effects.hpss(y)

    # -- Beat grid ---------------------------------------------------------
    print("beat grid (beat_track + uniform extrapolation) ...")
    onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr, hop_length=HOP)
    beat_times, tempo_val, anchor = steady_beat_grid(onset_env, sr, HOP, duration)
    print(f"  tempo: {tempo_val:.2f} BPM (from median IBI)")
    print(f"  anchor from beat_track: {anchor[0]:.2f}→{anchor[1]:.2f}s")
    print(f"  extrapolated grid: {len(beat_times)} beats, "
          f"{beat_times[0]:.2f}→{beat_times[-1]:.2f}s")

    # -- Drum onsets ------------------------------------------------------
    print("drum onsets ...")
    drum_frames = librosa.onset.onset_detect(
        y=y_perc, sr=sr, hop_length=HOP, units="frames", backtrack=True,
    )
    drum_times = librosa.frames_to_time(drum_frames, sr=sr, hop_length=HOP)
    drum_str = [float(onset_env[min(f, len(onset_env)-1)]) for f in drum_frames]
    print(f"  drum onsets: {len(drum_times)}")

    # -- Bass onsets (low mel bands) --------------------------------------
    print(f"bass onsets (mel bands < {BASS_HZ_MAX:.0f} Hz) ...")
    n_mels = 128
    mel_freqs = librosa.mel_frequencies(n_mels=n_mels + 2, fmin=0, fmax=sr / 2)
    bass_end = int(np.searchsorted(mel_freqs, BASS_HZ_MAX))
    onset_multi = librosa.onset.onset_strength_multi(
        y=y, sr=sr, hop_length=HOP, n_mels=n_mels,
        channels=[0, bass_end, n_mels],
    )
    bass_env = onset_multi[0]
    bass_frames = librosa.onset.onset_detect(
        onset_envelope=bass_env, sr=sr, hop_length=HOP, units="frames", backtrack=True,
    )
    bass_times = librosa.frames_to_time(bass_frames, sr=sr, hop_length=HOP)
    bass_str = [float(bass_env[min(f, len(bass_env)-1)]) for f in bass_frames]
    print(f"  bass onsets: {len(bass_times)}")

    # -- Sections ---------------------------------------------------------
    print("sections (agglomerative on chroma + MFCC) ...")
    chroma = librosa.feature.chroma_cqt(y=y_harm, sr=sr, hop_length=HOP)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=HOP, n_mfcc=13)
    feat = np.vstack([
        librosa.util.normalize(chroma, axis=1),
        librosa.util.normalize(mfcc,   axis=1),
    ])
    bounds = librosa.segment.agglomerative(feat, k=N_SECTIONS)
    bound_times = librosa.frames_to_time(bounds, sr=sr, hop_length=HOP)
    bound_times = np.concatenate([bound_times, [duration]])
    sections = [
        {"start": float(bound_times[i]), "end": float(bound_times[i+1])}
        for i in range(len(bound_times) - 1)
    ]

    # -- Envelopes for waveform render ------------------------------------
    print("envelope ...")
    rms_hop = int(sr * 0.010)
    rms = librosa.feature.rms(y=y, frame_length=rms_hop * 4, hop_length=rms_hop)[0]
    rms = rms / max(float(rms.max()), 1e-9)
    bass_env_norm = bass_env / max(float(bass_env.max()), 1e-9)

    out = {
        "audio_file":  audio_path.name,
        "duration":    duration,
        "sr":          sr,
        "tempo_bpm":   tempo_val,
        "beat_anchor": {"start": anchor[0], "end": anchor[1]},
        "beat_times":  [float(t) for t in beat_times],
        "drum_onsets": [{"t": float(t), "strength": s} for t, s in zip(drum_times, drum_str)],
        "bass_onsets": [{"t": float(t), "strength": s} for t, s in zip(bass_times, bass_str)],
        "sections":    sections,
        "envelope": {
            "hop_s": rms_hop / sr,
            "full":  [round(float(v), 4) for v in rms.tolist()],
            "bass_hop_s": HOP / sr,
            "bass":  [round(float(v), 4) for v in bass_env_norm.tolist()],
        },
    }

    out_path.write_text(json.dumps(out))
    print(f"wrote {out_path} ({out_path.stat().st_size/1024:.1f} KiB)")


if __name__ == "__main__":
    here = Path(__file__).parent
    audio = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "audio.mp3"
    out = here / "detection.json"
    main(audio, out)
