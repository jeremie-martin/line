#!/usr/bin/env python3
"""Descriptive vocal measurements, never words, salience scores or landing choices.

python tools/music/vocal_evidence.py --song SONG
Requires numpy, librosa and ffmpeg. Output: productions/SONG/vocal-evidence.json.
The algorithm never reads listener annotations or specification contacts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import librosa
import numpy as np

SR = 22050
HOP = 256
WINDOW = 1024


def measurements(samples: np.ndarray, sr: int = SR, hop: int = HOP, window: int = WINDOW) -> dict:
    """Centered RMS (amplitude) and adjacent-frame spectral cosine distance, shape (frames,).

    Spectra use a Hann window and 200–6000 Hz. Cosine distance describes a change
    in spectral shape, independently of overall gain; it does not identify its
    cause. One silent spectrum gives null distance, not a fabricated observation.
    The window spans ~46 ms: timestamps are window centers, not onset estimates.
    """
    x = np.asarray(samples, dtype=float)
    if x.ndim != 1 or not len(x) or not np.isfinite(x).all():
        raise ValueError("expected a finite nonempty mono waveform")
    if sr <= 0 or hop <= 0 or window < 4 or window % 2:
        raise ValueError("positive sample rate/hop and an even window >= 4 required")
    padded = np.pad(x, (window // 2, window // 2))
    frames = np.lib.stride_tricks.sliding_window_view(padded, window)[::hop][: (len(x) + hop - 1) // hop]
    rms = np.sqrt(np.mean(frames**2, axis=1))
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(window), axis=1))
    frequencies = np.fft.rfftfreq(window, 1 / sr)
    band = spectrum[:, (frequencies >= 200) & (frequencies <= 6000)]
    norm = np.linalg.norm(band, axis=1)
    valid = (norm[1:] > 1e-12) & (norm[:-1] > 1e-12)
    change = np.full(len(frames), np.nan)
    dots = np.sum(band[1:] * band[:-1], axis=1)
    change[1:][valid] = np.clip(1 - dots[valid] / (norm[1:][valid] * norm[:-1][valid]), 0, 1)
    return {
        "rms": np.round(rms, 7).tolist(),
        "spectralChange": [round(float(v), 7) if np.isfinite(v) else None for v in change],
    }


def band_flux(samples: np.ndarray, sr: int = SR, hop: int = HOP, window: int = WINDOW) -> list[dict]:
    """Positive log-mel changes in three fixed filter-center bands, dB per frame.

    All bands use the same 64-filter spectrogram. Adjacent differences are placed
    at the later centered STFT frame, with no additional onset-detector time shift.
    Filter supports overlap band boundaries. These are not voice/consonant labels.
    """
    x = np.asarray(samples, dtype=float)
    if x.ndim != 1 or not len(x) or not np.isfinite(x).all():
        raise ValueError("expected a finite nonempty mono waveform")
    if sr < 16000 or hop <= 0 or window < 4 or window % 2:
        raise ValueError("sample rate >= 16000 Hz, positive hop and even window >= 4 required")
    centers = librosa.mel_frequencies(n_mels=66, fmin=80, fmax=8000)[1:-1]
    boundaries = [0, int(np.searchsorted(centers, 1000)), int(np.searchsorted(centers, 3000)), 64]
    power = librosa.feature.melspectrogram(
        y=x, sr=sr, n_fft=window, hop_length=hop, n_mels=64, fmin=80, fmax=8000,
        window="hann", center=True, pad_mode="constant", power=2,
    )
    log_power = librosa.power_to_db(power, ref=1.0, amin=1e-10, top_db=None)
    flux = librosa.onset.onset_strength_multi(
        S=log_power, n_fft=window, hop_length=hop, channels=boundaries,
        lag=1, max_size=1, center=False,
    )[:, :(len(x) + hop - 1) // hop]
    return [
        {"name": name, "filterCenterHz": [low, high],
         "values": [None] + np.round(values[1:], 7).tolist()}
        for name, low, high, values in zip(
            ["low", "mid", "high"], [80, 1000, 3000], [1000, 3000, 8000], flux,
        )
    ]


def attack_landmarks(rms: list[float], candidates: list[dict], sr: int = SR, hop: int = HOP) -> list[dict]:
    """Preceding RMS minimum and steepest linear-amplitude rise, in audio seconds.

    A backtracked minimum is a measured landmark, not an onset boundary. The
    steepest rise is the later of its two adjacent frame centers. Search ends
    at the candidate's nearest frame; a non-rising interval has no rise landmark.
    Original candidate times are never shifted. A clip-start fallback is explicit.
    """
    env = np.asarray(rms, dtype=float)
    if env.ndim != 1 or not len(env) or not np.isfinite(env).all() or np.any(env < 0) or sr <= 0 or hop <= 0:
        raise ValueError("expected finite nonnegative RMS frames and positive sample rate/hop")
    if not candidates:
        return []
    times = np.array([c["t"] for c in candidates], dtype=float)
    if not np.isfinite(times).all() or np.any(times < 0) or np.any(times >= len(env) * hop / sr):
        raise ValueError("expected finite candidate times within the RMS timeline")
    indices = np.clip(np.floor(times * sr / hop + .5).astype(int), 0, len(env) - 1)
    minima = librosa.onset.onset_backtrack(indices, env)
    results = []
    for i, m in zip(indices, minima):
        slope = np.diff(env[m:i + 1]) * sr / hop
        rise = int(np.argmax(slope)) if len(slope) else None
        present = rise is not None and slope[rise] > 0
        results.append({
            "precedingMinimumT": round(float(m * hop / sr), 7),
            "minimumAtClipStart": bool(m == 0),
            "steepestRiseT": round(float((m + rise + 1) * hop / sr), 7) if present else None,
            "risePerSecond": round(float(slope[rise]), 7) if present else None,
        })
    return results


def build(root: Path, song: str) -> dict:
    base = root / "generated/stems" / song
    production = root / "productions" / song
    paths = [production / "audio.mp3", base / "vocals.wav", base / "stems.json", Path(__file__).resolve()]
    sung_path = production / "sung.json"
    sung = json.loads(sung_path.read_text()) if sung_path.exists() else {}
    if sung_path.exists():
        paths.append(sung_path)
    inputs = [{"path": str(p.relative_to(root)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(base / "vocals.wav"), "-f", "f32le", "-ar", str(SR), "-ac", "1", "-",
    ])
    samples = np.frombuffer(raw, dtype="<f4")
    stems = json.loads((base / "stems.json").read_text())
    if abs(float(stems["times"][-1]) - len(samples) / SR) > .1:
        raise ValueError("vocal waveform and saved stem timeline disagree in duration")
    candidates = [dict(o, kind="spectral-onset") for o in stems["stems"]["vocals"]["onsets"]]
    # Retain both legacy classifier outputs. Their classification is an estimate,
    # not an instruction to include or exclude an articulation.
    for field, kind in [("notes", "pitched-estimate"), ("unpitched", "unpitched-estimate")]:
        candidates.extend(dict(o, kind=kind) for o in sung.get(field, []))
    candidates.sort(key=lambda o: (o["t"], o["kind"]))
    measured = measurements(samples)
    for candidate, landmarks in zip(candidates, attack_landmarks(measured["rms"], candidates)):
        candidate["landmarks"] = landmarks
    return {
        "analysisVersions": {"numpy": np.__version__, "librosa": librosa.__version__},
        "schema": "line.vocal-evidence.v1", "song": song, "inputs": inputs,
        "source": "Demucs vocal stem: may contain multiple voices and instrumental leakage",
        "sampleRate": SR, "hopSamples": HOP, "windowSamples": WINDOW,
        "duration": len(samples) / SR,
        "definitions": {
            "time": "i * hopSamples / sampleRate; centered windows with zero padding at clip edges",
            "rms": "linear amplitude of the decoded vocal stem; no normalization by song or viewport",
            "spectralChange": "cosine distance between adjacent Hann-window magnitude spectra, 200–6000 Hz; null if unavailable",
            "candidates": "original source timestamps; unfiltered legacy estimates, not word boundaries or impact requests",
            "landmarks": "preceding RMS minimum and steepest positive linear RMS rise up to the candidate frame; frame centers, not an onset interval or confidence bounds",
            "bandFlux": "mean positive adjacent log-mel power change, dB/frame; 64 Hann-window mel filters grouped by center frequency (overlapping supports), 80–1000/1000–3000/3000–8000 Hz; power floor 1e-10; no normalization or extra onset time shift; first frame null",
        },
        **measured, "bandFlux": band_flux(samples), "candidates": candidates,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--song", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    if not (root / "productions" / args.song).is_dir() or Path(args.song).name != args.song:
        parser.error("song must name a production directory")
    result = build(root, args.song)
    out = root / "productions" / args.song / "vocal-evidence.json"
    out.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    print(f"{args.song}: {len(result['rms'])} frames, {len(result['candidates'])} unfiltered candidates -> {out}")
