#!/usr/bin/env python3
"""Decompose a fixed-count aim-ranking experiment around first completion.

Benchmark V2 archives are large because they retain raw reports and V3 budget
telemetry.  The runner nevertheless writes each top-level run on one physical
line.  This analyzer streams those lines, retains only a compact metric vector,
and pairs candidate and baseline runs by their complete benchmark task key.

The decomposition is descriptive, not causal: changing initial proposal order
also changes the incumbent from which later repair episodes begin.  Its exact
meaning is therefore "score present at the end of the initial episode" versus
"all later uplift", not an estimate of an isolated repair treatment effect.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import gzip
import json
import math
from pathlib import Path
import statistics
from typing import Any, Iterator, TextIO


METRICS = (
    "finalScore",
    "initialEndRegisterScore",
    "postInitialUplift",
    "repairEpisodes",
    "repairTerminalEpisodes",
    "repairAcceptedAlternatives",
    "repairAcceptedInternalGain",
    "repairSpentFrames",
    "firstCompletionFrame",
    "aimConsidered",
    "aimEmitted",
    "aimGateFailed",
    "aimPoolEntries",
    "airQuality",
    "impactQuality",
    "speedQuality",
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, action="append", required=True)
    parser.add_argument("--out", type=Path)
    return parser.parse_args()


def open_text(path: Path) -> TextIO:
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf8")
    return path.open("rt", encoding="utf8")


def archive_runs(path: Path) -> Iterator[dict[str, Any]]:
    count = 0
    with open_text(path) as stream:
        for line in stream:
            stripped = line.lstrip()
            if not stripped.startswith('{"status"'):
                continue
            run = json.loads(stripped.rstrip().removesuffix(","))
            if "task" not in run or "score" not in run:
                raise ValueError(f"non-run compact object in {path} at row {count + 1}")
            count += 1
            yield run
    if count == 0:
        raise ValueError(
            f"{path} has no compact run rows; expected a Benchmark V2 run archive"
        )


def task_key(run: dict[str, Any]) -> tuple[str, int, int, int, int]:
    task = run["task"]
    return (
        str(task["sourceId"]),
        int(task["budget"]),
        int(task["seedSlot"]),
        int(task["actualSeed"]),
        int(task["joltMs"]),
    )


def finite(value: Any) -> float:
    if value is None:
        return math.nan
    numeric = float(value)
    return numeric if math.isfinite(numeric) else math.nan


def slim_run(run: dict[str, Any]) -> dict[str, Any]:
    score = run["score"]
    valid = run["status"] == "ok" and score["valid"] is True
    episodes = run["budgetTelemetry"]["episodes"]
    initial = next((episode for episode in episodes if episode["lane"] == "initial"), None)
    initial_key = None if initial is None else initial.get("register_key_at_end")
    initial_score = math.nan if initial_key is None else finite(
        initial_key["internal_full_score"]
    )
    final_score = finite(score["score"])
    repairs = [episode for episode in episodes if episode["lane"] == "repair"]
    aim = run["stats"].get("aim") or {}
    components = score.get("components", {})

    def quality(axis: str) -> float:
        component = components.get(axis)
        return math.nan if component is None else finite(component["quality"])

    return {
        "valid": valid,
        "role": str(run["source"]["role"]),
        "finalScore": final_score,
        "initialEndRegisterScore": initial_score,
        "postInitialUplift": (
            final_score - initial_score
            if valid and math.isfinite(initial_score)
            else math.nan
        ),
        "repairEpisodes": len(repairs),
        "repairTerminalEpisodes": sum(
            episode["outcome"]["terminal_reached"] is True for episode in repairs
        ),
        "repairAcceptedAlternatives": sum(
            episode["outcome"]["accepted_alternative"] is True for episode in repairs
        ),
        "repairAcceptedInternalGain": sum(
            finite(episode["outcome"].get("internal_full_score_delta") or 0)
            for episode in repairs
            if episode["outcome"]["accepted_alternative"] is True
        ),
        "repairSpentFrames": sum(
            int(episode["outcome"]["spent_frames"]) for episode in repairs
        ),
        "firstCompletionFrame": finite(run["stats"]["first_completion_frame"]),
        "aimConsidered": int(aim.get("enum_considered", 0)),
        "aimEmitted": int(aim.get("enum_emitted", 0)),
        "aimGateFailed": int(aim.get("enum_gate_fail", 0)),
        "aimPoolEntries": int(aim.get("aimed_pool_entries", 0)),
        "airQuality": quality("air"),
        "impactQuality": quality("impact"),
        "speedQuality": quality("speed"),
    }


def load_slim(path: Path) -> dict[tuple[str, int, int, int, int], dict[str, Any]]:
    runs: dict[tuple[str, int, int, int, int], dict[str, Any]] = {}
    for run in archive_runs(path):
        key = task_key(run)
        if key in runs:
            raise ValueError(f"duplicate benchmark task {key!r} in {path}")
        runs[key] = slim_run(run)
    return runs


def summarize(values: list[float]) -> dict[str, float | int]:
    return {
        "observations": len(values),
        "mean": statistics.fmean(values),
        "median": statistics.median(values),
        "positive": sum(value > 0 for value in values),
        "zero": sum(value == 0 for value in values),
        "negative": sum(value < 0 for value in values),
    }


def log_gamma(value: float) -> float:
    coefficients = (
        676.5203681218851,
        -1259.1392167224028,
        771.3234287776531,
        -176.6150291621406,
        12.507343278686905,
        -0.13857109526572012,
        9.984369578019572e-6,
        1.5056327351493116e-7,
    )
    if value < 0.5:
        return math.log(math.pi) - math.log(math.sin(math.pi * value)) - log_gamma(1 - value)
    z = value - 1
    series = 0.9999999999998099
    for index, coefficient in enumerate(coefficients):
        series += coefficient / (z + index + 1)
    t = z + len(coefficients) - 0.5
    return 0.5 * math.log(2 * math.pi) + (z + 0.5) * math.log(t) - t + math.log(series)


def beta_continued_fraction(x: float, a: float, b: float) -> float:
    tiny = 1e-300
    c = 1.0
    d = 1 - (a + b) * x / (a + 1)
    if abs(d) < tiny:
        d = tiny
    d = 1 / d
    result = d
    for iteration in range(1, 201):
        even = 2 * iteration
        numerator = iteration * (b - iteration) * x / (
            (a + even - 1) * (a + even)
        )
        d = 1 + numerator * d
        if abs(d) < tiny:
            d = tiny
        c = 1 + numerator / c
        if abs(c) < tiny:
            c = tiny
        d = 1 / d
        result *= d * c
        numerator = -(a + iteration) * (a + b + iteration) * x / (
            (a + even) * (a + even + 1)
        )
        d = 1 + numerator * d
        if abs(d) < tiny:
            d = tiny
        c = 1 + numerator / c
        if abs(c) < tiny:
            c = tiny
        d = 1 / d
        delta = d * c
        result *= delta
        if abs(delta - 1) < 1e-12:
            break
    return result


def regularized_incomplete_beta(x: float, a: float, b: float) -> float:
    if x <= 0:
        return 0
    if x >= 1:
        return 1
    front = math.exp(
        log_gamma(a + b)
        - log_gamma(a)
        - log_gamma(b)
        + a * math.log(x)
        + b * math.log1p(-x)
    )
    if x < (a + 1) / (a + b + 2):
        return front * beta_continued_fraction(x, a, b) / a
    return 1 - front * beta_continued_fraction(1 - x, b, a) / b


def student_t_cdf(value: float, degrees_of_freedom: int) -> float:
    if value == 0:
        return 0.5
    x = degrees_of_freedom / (degrees_of_freedom + value * value)
    tail = 0.5 * regularized_incomplete_beta(x, degrees_of_freedom / 2, 0.5)
    return 1 - tail if value > 0 else tail


def student_t_quantile(probability: float, degrees_of_freedom: int) -> float:
    if probability < 0.5:
        return -student_t_quantile(1 - probability, degrees_of_freedom)
    low = 0.0
    high = 1.0
    while student_t_cdf(high, degrees_of_freedom) < probability:
        high *= 2
    for _ in range(80):
        middle = (low + high) / 2
        if student_t_cdf(middle, degrees_of_freedom) < probability:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def summarize_seed_blocks(
    values_by_seed: dict[int, list[float]],
) -> dict[str, Any]:
    blocks = [
        {
            "seed": seed,
            "cells": len(values),
            "mean": statistics.fmean(values),
        }
        for seed, values in sorted(values_by_seed.items())
    ]
    means = [block["mean"] for block in blocks]
    estimate = statistics.fmean(means)
    if len(means) < 2:
        return {
            "available": False,
            "blocks": blocks,
            "estimate": estimate,
        }
    standard_deviation = statistics.stdev(means)
    standard_error = standard_deviation / math.sqrt(len(means))
    degrees_of_freedom = len(means) - 1
    t_value = (
        estimate / standard_error
        if standard_error > 0
        else math.copysign(math.inf, estimate) if estimate != 0 else 0
    )
    critical = student_t_quantile(0.975, degrees_of_freedom)
    return {
        "available": True,
        "blocks": blocks,
        "estimate": estimate,
        "standardDeviation": standard_deviation,
        "standardError": standard_error,
        "degreesOfFreedom": degrees_of_freedom,
        "t": t_value,
        "referenceDirectionalProbability": student_t_cdf(
            t_value, degrees_of_freedom
        ),
        "central95Lo": estimate - critical * standard_error,
        "central95Hi": estimate + critical * standard_error,
    }


def correlation(left: list[float], right: list[float]) -> float | None:
    left_mean = statistics.fmean(left)
    right_mean = statistics.fmean(right)
    left_ss = sum((value - left_mean) ** 2 for value in left)
    right_ss = sum((value - right_mean) ** 2 for value in right)
    if left_ss == 0 or right_ss == 0:
        return None
    return sum(
        (x - left_mean) * (y - right_mean) for x, y in zip(left, right, strict=True)
    ) / math.sqrt(left_ss * right_ss)


def main() -> None:
    args = arguments()
    candidate = load_slim(args.candidate)
    baseline: dict[tuple[str, int, int, int, int], dict[str, Any]] = {}
    for path in args.baseline:
        for key, run in load_slim(path).items():
            if key in baseline:
                raise ValueError(f"duplicate baseline benchmark task {key!r}")
            baseline[key] = run
    if candidate.keys() != baseline.keys():
        raise ValueError(
            "candidate and combined baseline archives do not contain identical task keys"
        )

    deltas: dict[str, list[float]] = defaultdict(list)
    seed_deltas: dict[str, dict[int, list[float]]] = defaultdict(
        lambda: defaultdict(list)
    )
    role_deltas: dict[str, dict[str, list[float]]] = defaultdict(
        lambda: defaultdict(list)
    )
    role_seed_deltas: dict[str, dict[str, dict[int, list[float]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    matched = 0
    candidate_only_valid = 0
    baseline_only_valid = 0
    for key, candidate_run in candidate.items():
        baseline_run = baseline[key]
        if candidate_run["valid"] and not baseline_run["valid"]:
            candidate_only_valid += 1
            continue
        if baseline_run["valid"] and not candidate_run["valid"]:
            baseline_only_valid += 1
            continue
        if not candidate_run["valid"] or not baseline_run["valid"]:
            continue
        matched += 1
        for metric in METRICS:
            candidate_value = candidate_run[metric]
            baseline_value = baseline_run[metric]
            if not math.isfinite(candidate_value) or not math.isfinite(baseline_value):
                continue
            delta = candidate_value - baseline_value
            deltas[metric].append(delta)
            seed_deltas[metric][key[3]].append(delta)
            role_deltas[candidate_run["role"]][metric].append(delta)
            role_seed_deltas[candidate_run["role"]][metric][key[3]].append(delta)

    score_deltas = deltas["finalScore"]
    report = {
        "schema": "line.aim-residual-phase-analysis.v2",
        "contract": {
            "candidate": str(args.candidate),
            "baseline": [str(path) for path in args.baseline],
            "pairing": ["sourceId", "budget", "seedSlot", "actualSeed", "joltMs"],
            "candidateRuns": len(candidate),
            "baselineRuns": len(baseline),
            "matchedValidRuns": matched,
            "candidateOnlyValid": candidate_only_valid,
            "baselineOnlyValid": baseline_only_valid,
            "interpretation": (
                "Descriptive paired decomposition. initialEndRegisterScore is the "
                "register score at the end of the initial episode. postInitialUplift "
                "is finalScore minus that value and includes repair, resumed search, "
                "and any other later work. It is not an isolated repair treatment effect."
            ),
            "seedBlockInference": (
                "Matched-valid deltas are averaged within actualSeed before estimating "
                "uncertainty. referenceDirectionalProbability is the unadjusted Student-t "
                "CDF of estimate / SE; it is descriptive and is not a governed Benchmark "
                "V2 promotion probability."
            ),
        },
        "pairedDelta": {
            metric: summarize(values) for metric, values in deltas.items()
        },
        "seedBlockPairedDelta": {
            metric: summarize_seed_blocks(values_by_seed)
            for metric, values_by_seed in seed_deltas.items()
        },
        "correlationWithFinalScoreDelta": {
            metric: correlation(score_deltas, values)
            for metric, values in deltas.items()
            if len(values) == len(score_deltas)
        },
        "pairedDeltaByRole": {
            role: {
                metric: summarize(values) for metric, values in metrics.items()
            }
            for role, metrics in sorted(role_deltas.items())
        },
        "seedBlockPairedDeltaByRole": {
            role: {
                metric: summarize_seed_blocks(values_by_seed)
                for metric, values_by_seed in metrics.items()
            }
            for role, metrics in sorted(role_seed_deltas.items())
        },
    }
    rendered = json.dumps(report, indent=2) + "\n"
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered)
    print(rendered, end="")


if __name__ == "__main__":
    main()
