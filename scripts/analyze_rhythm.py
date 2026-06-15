#!/usr/bin/env python3
"""
Reusable rhythm-analysis aid for authoring Line Rider specs.

This is deliberately NOT a spec generator. It separates:

  1. metrical layer: primary beats vs faster pulse/subdivision grid;
  2. event evidence: percussive, bass, RNN-onset, and energy-change strength;
  3. numeric authoring scores: contact/support/impact plausibility.

The goal is to produce evidence that a human can inspect. A subdivision can have
strong bass/onset evidence without being promoted to a primary beat.

Usage:
    /tmp/mm310/bin/python scripts/analyze_rhythm.py --audio beats/tiki_tiki_48s.mp3 \
      --out beats/tiki_tiki_48s.rhythm.json --window 6:13

Dependencies are the same old-Python analysis stack used by
scripts/analyze_music.py (madmom + librosa in /tmp/mm310).
"""
from __future__ import annotations

import argparse
import collections
import collections.abc
import json
import math
import warnings
from pathlib import Path
from typing import Any

# madmom compatibility on modern Python/numpy.
for _name in [
    "MutableSequence", "MutableMapping", "Mapping", "Sequence", "Callable",
    "Iterable", "MutableSet", "Set", "Hashable",
]:
    if not hasattr(collections, _name):
        setattr(collections, _name, getattr(collections.abc, _name))

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="madmom")

import numpy as np  # noqa: E402

with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=DeprecationWarning)
    for _alias, _real in (
        ("int", int), ("float", float), ("bool", bool), ("object", object), ("complex", complex),
    ):
        if not hasattr(np, _alias):
            setattr(np, _alias, _real)

import librosa  # noqa: E402
from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor  # noqa: E402
from madmom.features.downbeats import (  # noqa: E402
    RNNDownBeatProcessor,
    DBNDownBeatTrackingProcessor,
)
from madmom.features.onsets import RNNOnsetProcessor, OnsetPeakPickingProcessor  # noqa: E402


SR = 22050
HOP = 512
ATTACK_HOP = 64
RNN_FPS = 100
PRIMARY_MATCH_S = 0.10
PULSE_MATCH_S = 0.10
LOCAL_MAX_S = 0.07
ATTACK_LOOKBACK_S = 0.12
ATTACK_LOOKAHEAD_S = 0.035
BASS_HZ_MAX = 200.0


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def safe_median_diff(xs: np.ndarray) -> float | None:
    if len(xs) < 2:
        return None
    diffs = np.diff(xs)
    diffs = diffs[np.isfinite(diffs) & (diffs > 0)]
    if len(diffs) == 0:
        return None
    return float(np.median(diffs))


def nearest_index(xs: np.ndarray, t: float) -> tuple[int | None, float | None]:
    if len(xs) == 0:
        return None, None
    i = int(np.searchsorted(xs, t))
    candidates = []
    if i < len(xs):
        candidates.append(i)
    if i > 0:
        candidates.append(i - 1)
    best = min(candidates, key=lambda j: abs(float(xs[j]) - t))
    return best, float(xs[best])


def local_max(values: np.ndarray, fps: float, t: float, radius_s: float = LOCAL_MAX_S) -> float:
    if len(values) == 0:
        return 0.0
    center = int(round(t * fps))
    radius = max(1, int(round(radius_s * fps)))
    lo = max(0, center - radius)
    hi = min(len(values), center + radius + 1)
    if lo >= hi:
        return 0.0
    return float(np.max(values[lo:hi]))


def local_peak_time(
    values: np.ndarray,
    fps: float,
    t: float,
    lookback_s: float = ATTACK_LOOKBACK_S,
    lookahead_s: float = ATTACK_LOOKAHEAD_S,
) -> tuple[float | None, float]:
    if len(values) == 0:
        return None, 0.0
    lo = max(0, int(math.floor((t - lookback_s) * fps)))
    hi = min(len(values), int(math.ceil((t + lookahead_s) * fps)) + 1)
    if lo >= hi:
        return None, 0.0
    i = lo + int(np.argmax(values[lo:hi]))
    return float(i / fps), float(values[i])


def normalize(values: np.ndarray, pct: float = 95.0) -> np.ndarray:
    if len(values) == 0:
        return values
    scale = float(np.percentile(values, pct))
    if not math.isfinite(scale) or scale <= 1e-9:
        scale = float(np.max(values))
    if not math.isfinite(scale) or scale <= 1e-9:
        return np.zeros_like(values)
    return np.clip(values / scale, 0.0, 1.0)


def energy_jump(rms: np.ndarray, hop_s: float, t: float, span_s: float = 1.2) -> float:
    if len(rms) == 0:
        return 0.0
    i0 = int(max(0, math.floor((t - span_s) / hop_s)))
    i1 = int(max(0, math.floor(t / hop_s)))
    i2 = int(min(len(rms), math.ceil((t + span_s) / hop_s)))
    if i1 <= i0 or i2 <= i1:
        return 0.0
    before = float(np.mean(rms[i0:i1]))
    after = float(np.mean(rms[i1:i2]))
    denom = max(before, after, 1e-6)
    return clamp((after - before) / denom * 1.4, -1.0, 1.0)


def make_uniform_grid(anchor: float, period: float, duration: float) -> np.ndarray:
    if period <= 0:
        return np.array([], dtype=float)
    times = []
    t = anchor
    while t - period > 0:
        t -= period
    while t < duration:
        if t >= 0:
            times.append(t)
        t += period
    return np.array(times, dtype=float)


def choose_pulse_grid(
    primary_beats: np.ndarray,
    downbeat_times: np.ndarray,
    librosa_beats: np.ndarray,
    duration: float,
) -> tuple[np.ndarray, str]:
    primary_period = safe_median_diff(primary_beats)

    candidates: list[tuple[str, np.ndarray, float | None]] = [
        ("madmom_downbeat_grid", downbeat_times, safe_median_diff(downbeat_times)),
        ("librosa_percussive_grid", librosa_beats, safe_median_diff(librosa_beats)),
    ]
    if primary_period is not None and len(primary_beats):
        candidates.extend([
            ("primary_grid", primary_beats, primary_period),
            ("primary_half_subdivision", make_uniform_grid(float(primary_beats[0]), primary_period / 2, duration), primary_period / 2),
        ])

    # Prefer a faster grid at about half the primary-beat period when available.
    if primary_period is not None:
        target = primary_period / 2
        viable = [
            (name, grid, period)
            for name, grid, period in candidates
            if period is not None and len(grid) > 3 and 0.72 * target <= period <= 1.28 * target
        ]
        if viable:
            name, grid, _period = min(viable, key=lambda item: abs(float(item[2]) - target))
            return grid, name

    viable = [(name, grid, period) for name, grid, period in candidates if period is not None and len(grid) > 3]
    if viable:
        name, grid, _period = min(viable, key=lambda item: float(item[2]))
        return grid, name
    return primary_beats, "primary_grid"


def beat_track_grid(onset_env: np.ndarray, sr: int, hop: int, duration: float) -> tuple[np.ndarray, float | None]:
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop,
        start_bpm=120.0,
    )
    times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    times = times[(times >= 0) & (times <= duration)]
    period = safe_median_diff(times)
    if period is None:
        return times, None

    # Extend the confident tracked period to cover the requested duration.
    full = make_uniform_grid(float(times[0]), period, duration) if len(times) else times
    tempo_val = float(np.atleast_1d(tempo)[0]) if np.size(tempo) else 60.0 / period
    return full, tempo_val


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge0 == edge1:
        return 1.0 if x >= edge1 else 0.0
    t = clamp((x - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def local_percentile_score(values: np.ndarray, i: int, radius: int = 4) -> float:
    if len(values) == 0:
        return 0.0
    lo = max(0, i - radius)
    hi = min(len(values), i + radius + 1)
    window = values[lo:hi]
    if len(window) < 3:
        return 0.5
    floor = float(np.percentile(window, 20))
    ceil = float(np.percentile(window, 90))
    if ceil - floor <= 1e-6:
        return 0.5
    return clamp((float(values[i]) - floor) / (ceil - floor))


def metrical_score(is_primary: bool, meter_pos: int | None) -> float:
    if is_primary:
        return 1.0
    if meter_pos == 1:
        return 0.55
    if meter_pos is not None:
        return 0.42
    return 0.28


def event_score(evidence: dict[str, float]) -> float:
    return clamp(
        0.42 * evidence["madmom_onset"] +
        0.35 * evidence["percussive"] +
        0.23 * evidence["bass"]
    )


def body_score(evidence: dict[str, float]) -> float:
    rms = evidence["rms"]
    lift = max(0.0, evidence["energy_jump"])
    lift_credit = 0.25 if rms >= 0.18 else 0.08
    return clamp(rms + lift_credit * lift)


def contact_score(
    *,
    is_primary: bool,
    metrical: float,
    event: float,
    body: float,
    lift: float,
    fall: float,
) -> float:
    low_body = 1.0 - smoothstep(0.28, 0.62, body)
    decay_factor = clamp(1.0 - 0.65 * fall * low_body)
    body_gate = 0.60 + 0.40 * smoothstep(0.12, 0.52, body)
    base = 0.44 * event + 0.28 * body + 0.22 * metrical + 0.06 * lift
    contact = base * body_gate * decay_factor
    if is_primary and event >= 0.78 and body >= 0.35:
        contact += 0.08
    if not is_primary and event >= 0.86 and body >= 0.55:
        contact += 0.10
    return clamp(contact)


def support_score(*, metrical: float, contact: float, body: float) -> float:
    return clamp(0.65 * metrical + 0.25 * (1.0 - contact) + 0.10 * (1.0 - body))


def impact_score(*, contact: float, body: float, prominence: float, fall: float) -> float:
    low_body = 1.0 - smoothstep(0.28, 0.62, body)
    return clamp(
        0.10 +
        0.55 * contact +
        0.22 * body +
        0.13 * prominence -
        0.16 * fall * low_body
    )


def analyze(audio_path: Path, duration_arg: float | None) -> dict[str, Any]:
    print(f"loading {audio_path} ...", flush=True)
    y, sr = librosa.load(str(audio_path), sr=SR, mono=True)
    duration = len(y) / sr
    if duration_arg is not None:
        duration = min(duration, duration_arg)
        y = y[: int(round(duration * sr))]
    print(f"  {duration:.2f}s @ {sr} Hz", flush=True)

    print("librosa features ...", flush=True)
    y_harm, y_perc = librosa.effects.hpss(y)
    perc_env_raw = librosa.onset.onset_strength(y=y_perc, sr=sr, hop_length=HOP)
    perc_env = normalize(perc_env_raw)
    attack_env = normalize(
        librosa.onset.onset_strength(y=y_perc, sr=sr, hop_length=ATTACK_HOP, n_fft=512)
    )

    n_mels = 128
    mel_freqs = librosa.mel_frequencies(n_mels=n_mels + 2, fmin=0, fmax=sr / 2)
    bass_end = int(np.searchsorted(mel_freqs, BASS_HZ_MAX))
    onset_multi = librosa.onset.onset_strength_multi(
        y=y,
        sr=sr,
        hop_length=HOP,
        n_mels=n_mels,
        channels=[0, bass_end, n_mels],
    )
    bass_env = normalize(np.asarray(onset_multi[0]))

    rms_hop = int(sr * 0.010)
    rms = librosa.feature.rms(y=y, frame_length=rms_hop * 4, hop_length=rms_hop)[0]
    rms = normalize(rms, 99.0)

    print("madmom beats/onsets ...", flush=True)
    beat_act = RNNBeatProcessor()(str(audio_path))
    primary_beats = DBNBeatTrackingProcessor(fps=RNN_FPS)(beat_act)
    primary_beats = primary_beats[(primary_beats >= 0) & (primary_beats <= duration)]

    downbeat_grid = DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=RNN_FPS)(
        RNNDownBeatProcessor()(str(audio_path))
    )
    downbeat_grid = downbeat_grid[(downbeat_grid[:, 0] >= 0) & (downbeat_grid[:, 0] <= duration)]
    downbeat_times = downbeat_grid[:, 0] if len(downbeat_grid) else np.array([], dtype=float)
    downbeat_positions = downbeat_grid[:, 1].astype(int) if len(downbeat_grid) else np.array([], dtype=int)

    rnn_onset_act = RNNOnsetProcessor()(str(audio_path))
    rnn_onset_norm = normalize(np.asarray(rnn_onset_act))
    rnn_onsets = OnsetPeakPickingProcessor(fps=RNN_FPS, threshold=0.25)(rnn_onset_act)
    rnn_onsets = rnn_onsets[(rnn_onsets >= 0) & (rnn_onsets <= duration)]

    librosa_grid, librosa_tempo = beat_track_grid(perc_env_raw, sr, HOP, duration)
    pulse_grid, pulse_source = choose_pulse_grid(primary_beats, downbeat_times, librosa_grid, duration)

    primary_period = safe_median_diff(primary_beats)
    pulse_period = safe_median_diff(pulse_grid)

    grid_rows: list[dict[str, Any]] = []
    for pulse_i, t_raw in enumerate(pulse_grid):
        t = float(t_raw)
        if t < 0 or t > duration:
            continue
        primary_i, primary_t = nearest_index(primary_beats, t)
        primary_dist = abs(primary_t - t) if primary_t is not None else float("inf")
        is_primary = primary_dist <= PRIMARY_MATCH_S

        down_i, down_t = nearest_index(downbeat_times, t)
        meter_pos = None
        if down_i is not None and down_t is not None and abs(down_t - t) <= PULSE_MATCH_S:
            meter_pos = int(downbeat_positions[down_i])

        madmom_onset = local_max(rnn_onset_norm, RNN_FPS, t)
        perc_onset = local_max(perc_env, sr / HOP, t)
        bass_onset = local_max(bass_env, sr / HOP, t)
        rms_local = local_max(rms, 1.0 / (rms_hop / sr), t, 0.10)
        jump = energy_jump(rms, rms_hop / sr, t)

        evidence = {
            "madmom_onset": round(madmom_onset, 3),
            "percussive": round(perc_onset, 3),
            "bass": round(bass_onset, 3),
            "rms": round(rms_local, 3),
            "energy_jump": round(jump, 3),
        }

        _nearest_rnn_i, nearest_rnn_t = nearest_index(rnn_onsets, t)
        onset_dist = abs(nearest_rnn_t - t) if nearest_rnn_t is not None else None
        attack_t, attack_strength = local_peak_time(attack_env, sr / ATTACK_HOP, t)
        metrical = metrical_score(is_primary, meter_pos)
        event = event_score(evidence)
        body = body_score(evidence)
        lift = max(0.0, jump)
        fall = max(0.0, -jump)
        event_t = t
        event_source = "grid"
        if is_primary and primary_t is not None:
            event_t = primary_t
            event_source = "primary"
        elif attack_t is not None:
            event_t = attack_t
            event_source = "attack"
        elif nearest_rnn_t is not None and onset_dist is not None and onset_dist <= PULSE_MATCH_S:
            event_t = nearest_rnn_t
            event_source = "rnn_onset"
        grid_rows.append({
            "t": round(t, 4),
            "grid": {
                "pulse_index": pulse_i,
                "is_primary": is_primary,
                "meter_pos": meter_pos,
                "primary_index": primary_i if is_primary else None,
                "primary_t": round(float(primary_t), 4) if is_primary and primary_t is not None else None,
                "primary_distance": round(float(primary_dist), 4) if math.isfinite(primary_dist) else None,
            },
            "evidence": evidence,
            "nearest_rnn_onset": round(float(nearest_rnn_t), 4) if nearest_rnn_t is not None else None,
            "nearest_rnn_onset_dist": round(float(onset_dist), 4) if onset_dist is not None else None,
            "timing": {
                "grid_t": round(t, 4),
                "event_t": round(float(event_t), 4),
                "event_source": event_source,
                "event_delta": round(float(event_t - t), 4),
                "attack_t": round(float(attack_t), 4) if attack_t is not None else None,
                "attack_strength": round(float(attack_strength), 3),
            },
            "_raw_scores": {
                "metrical": metrical,
                "event": event,
                "body": body,
                "lift": lift,
                "decay": fall,
            },
        })

    event_values = np.array([row["_raw_scores"]["event"] for row in grid_rows], dtype=float)
    body_values = np.array([row["_raw_scores"]["body"] for row in grid_rows], dtype=float)
    for i, row in enumerate(grid_rows):
        raw = row.pop("_raw_scores")
        event_prom = local_percentile_score(event_values, i)
        body_prom = local_percentile_score(body_values, i)
        prominence = clamp(0.45 * event_prom + 0.55 * body_prom)
        contact = contact_score(
            is_primary=bool(row["grid"]["is_primary"]),
            metrical=raw["metrical"],
            event=raw["event"],
            body=raw["body"],
            lift=raw["lift"],
            fall=raw["decay"],
        )
        row["scores"] = {
            "metrical": round(raw["metrical"], 3),
            "event": round(raw["event"], 3),
            "body": round(raw["body"], 3),
            "lift": round(raw["lift"], 3),
            "decay": round(raw["decay"], 3),
            "prominence": round(prominence, 3),
            "contact": round(contact, 3),
            "support": round(support_score(metrical=raw["metrical"], contact=contact, body=raw["body"]), 3),
            "impact": round(impact_score(contact=contact, body=raw["body"], prominence=prominence, fall=raw["decay"]), 3),
        }

    strongest_events = [
        {
            "t": row["t"],
            "scores": row["scores"],
            "grid": row["grid"],
        }
        for row in sorted(grid_rows, key=lambda item: item["scores"]["contact"], reverse=True)[:16]
    ]

    bucket_s = 2.0
    energy = []
    b = 0.0
    while b < duration:
        lo = int(b / (rms_hop / sr))
        hi = int(min(len(rms), (b + bucket_s) / (rms_hop / sr)))
        energy.append({
            "t0": round(b, 3),
            "t1": round(min(duration, b + bucket_s), 3),
            "rms": round(float(np.mean(rms[lo:hi])) if hi > lo else 0.0, 3),
        })
        b += bucket_s

    return {
        "schema": "line.rhythm_analysis.v2",
        "audio_file": str(audio_path),
        "duration": round(duration, 4),
        "score_definitions": {
            "metrical": "how strongly this row belongs to the primary/pulse grid",
            "event": "combined onset evidence from madmom, percussive onset, and bass onset",
            "body": "local loudness/body with small credit for rising energy",
            "lift": "positive local energy change",
            "decay": "negative local energy change",
            "prominence": "local relative strength among nearby pulse rows",
            "contact": "numeric plausibility that this row can carry a musical landing",
            "support": "numeric usefulness for quiet grid-aligned support/continuity",
            "impact": "suggested relative impact only if the row is selected as a contact",
        },
        "tempo_layers": {
            "primary": {
                "source": "madmom.DBnBeatTrackingProcessor",
                "bpm": round(60.0 / primary_period, 3) if primary_period else None,
                "period_s": round(primary_period, 4) if primary_period else None,
                "count": int(len(primary_beats)),
            },
            "pulse": {
                "source": pulse_source,
                "bpm": round(60.0 / pulse_period, 3) if pulse_period else None,
                "period_s": round(pulse_period, 4) if pulse_period else None,
                "count": int(len(pulse_grid)),
            },
            "librosa_percussive": {
                "bpm": round(float(librosa_tempo), 3) if librosa_tempo is not None else None,
                "count": int(len(librosa_grid)),
            },
        },
        "primary_beats": [round(float(t), 4) for t in primary_beats],
        "rnn_onsets": [round(float(t), 4) for t in rnn_onsets],
        "beats": [round(float(t), 4) for t in primary_beats],
        "onsets_mix": [round(float(t), 4) for t in rnn_onsets],
        "grid": grid_rows,
        "strongest_events": strongest_events,
        "energy": energy,
    }


def parse_window(raw: str | None) -> tuple[float, float] | None:
    if not raw:
        return None
    left, sep, right = raw.partition(":")
    if not sep:
        raise ValueError("--window must be START:END")
    return float(left), float(right)


def print_table(result: dict[str, Any], window: tuple[float, float] | None) -> None:
    rows = result["grid"]
    if window is not None:
        t0, t1 = window
        rows = [row for row in rows if t0 <= row["t"] <= t1]

    print("\n=== RHYTHM GRID ===")
    print("time    P pos  event body  jump  prom  contact support impact  perc bass rnn")
    for row in rows:
        ev = row["evidence"]
        grid = row["grid"]
        scores = row["scores"]
        primary = "1" if grid["is_primary"] else "0"
        print(
            f"{row['t']:6.3f}  {primary:>1s} "
            f"{str(grid['meter_pos'] or '-'):>3s}  "
            f"{scores['event']:5.2f} {scores['body']:4.2f} "
            f"{ev['energy_jump']:5.2f}  {scores['prominence']:4.2f}  "
            f"{scores['contact']:7.2f} {scores['support']:7.2f} {scores['impact']:6.2f}  "
            f"{ev['percussive']:4.2f} {ev['bass']:4.2f} {ev['madmom_onset']:4.2f}"
        )


def main() -> None:
    ap = argparse.ArgumentParser(description="Reusable rhythm-analysis aid")
    ap.add_argument("--audio", required=True, help="audio file to analyze")
    ap.add_argument("--out", help="output JSON path (default: <audio>.rhythm.json)")
    ap.add_argument("--duration", type=float, help="seconds to analyze from the start")
    ap.add_argument("--window", help="print only START:END seconds in the console table")
    ap.add_argument("--json-only", action="store_true", help="suppress console grid table")
    args = ap.parse_args()

    audio = Path(args.audio)
    out = Path(args.out) if args.out else audio.with_suffix(".rhythm.json")
    result = analyze(audio, args.duration)
    out.write_text(json.dumps(result, indent=2) + "\n")
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KiB)")

    if not args.json_only:
        print_table(result, parse_window(args.window))


if __name__ == "__main__":
    main()
