#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy==2.5.1",
#   "scikit-learn==1.7.2",
# ]
# ///
"""Compare compact aim-impact artifacts on frozen local ranking proxies.

The readiness corpus does not contain production aim knob-grid identifiers.
This assay therefore forms explicit *proxy* choice sets from held-out rows that
share source, seed, incoming/outgoing durations, and every authored target.
State-dependent features and realized impact fit vary within each set.  The
result can reject a model that churns local rankings, but it cannot establish
compiler value; canonical V2 remains the decision authority.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
from typing import Any

import numpy as np

from distill_aim_impact_model import load_dataset, metrics, model_prediction


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--incumbent", type=Path, required=True)
    parser.add_argument(
        "--candidate",
        action="append",
        default=[],
        metavar="NAME=PATH",
        help="candidate artifact; may be repeated",
    )
    parser.add_argument("--out", type=Path)
    return parser.parse_args()


def parse_candidates(values: list[str]) -> dict[str, Path]:
    candidates: dict[str, Path] = {}
    for value in values:
        name, separator, raw_path = value.partition("=")
        if not separator or not name or not raw_path:
            raise ValueError(f"candidate must be NAME=PATH; got {value!r}")
        if name in candidates:
            raise ValueError(f"duplicate candidate name {name!r}")
        candidates[name] = Path(raw_path)
    return candidates


def context_feature_indexes(names: list[str]) -> list[int]:
    return [
        index
        for index, name in enumerate(names)
        if name in ("log_duration", "log_duration2")
        or name.startswith("target:")
        or name.startswith("missing:")
        or name.startswith("out:")
    ]


def proxy_groups(
    X: np.ndarray,
    sources: np.ndarray,
    seeds: np.ndarray,
    feature_indexes: list[int],
) -> list[np.ndarray]:
    groups: dict[tuple[str, int, bytes], list[int]] = defaultdict(list)
    context = np.ascontiguousarray(X[:, feature_indexes], dtype=np.float64)
    for index in range(X.shape[0]):
        groups[(str(sources[index]), int(seeds[index]), context[index].tobytes())].append(index)
    return [
        np.asarray(indexes, dtype=np.int64)
        for indexes in groups.values()
        if len(indexes) >= 2
    ]


def ranking_metrics(
    truth: np.ndarray,
    incumbent: np.ndarray,
    candidate: np.ndarray,
    groups: list[np.ndarray],
) -> dict[str, float | int]:
    top1_agree = 0
    top2_overlap = 0.0
    incumbent_top1_truth = 0.0
    candidate_top1_truth = 0.0
    oracle_top1_truth = 0.0
    incumbent_top2_truth = 0.0
    candidate_top2_truth = 0.0
    pairwise_comparable = 0
    pairwise_agree = 0
    truth_comparable = 0
    incumbent_truth_correct = 0
    candidate_truth_correct = 0
    for indexes in groups:
        incumbent_order = indexes[np.argsort(-incumbent[indexes], kind="stable")]
        candidate_order = indexes[np.argsort(-candidate[indexes], kind="stable")]
        top1_agree += int(incumbent_order[0] == candidate_order[0])
        incumbent_top = set(incumbent_order[: min(2, len(indexes))].tolist())
        candidate_top = set(candidate_order[: min(2, len(indexes))].tolist())
        top2_overlap += len(incumbent_top & candidate_top) / min(2, len(indexes))
        incumbent_top1_truth += truth[incumbent_order[0]]
        candidate_top1_truth += truth[candidate_order[0]]
        oracle_top1_truth += float(np.max(truth[indexes]))
        incumbent_top2_truth += float(np.mean(truth[list(incumbent_top)]))
        candidate_top2_truth += float(np.mean(truth[list(candidate_top)]))
        for left_offset, left in enumerate(indexes[:-1]):
            for right in indexes[left_offset + 1 :]:
                incumbent_delta = incumbent[left] - incumbent[right]
                candidate_delta = candidate[left] - candidate[right]
                if abs(incumbent_delta) > 1e-12:
                    pairwise_comparable += 1
                    pairwise_agree += int(
                        np.signbit(incumbent_delta) == np.signbit(candidate_delta)
                        and abs(candidate_delta) > 1e-12
                    )
                truth_delta = truth[left] - truth[right]
                if abs(truth_delta) > 1e-12:
                    truth_comparable += 1
                    incumbent_truth_correct += int(
                        np.signbit(truth_delta) == np.signbit(incumbent_delta)
                        and abs(incumbent_delta) > 1e-12
                    )
                    candidate_truth_correct += int(
                        np.signbit(truth_delta) == np.signbit(candidate_delta)
                        and abs(candidate_delta) > 1e-12
                    )
    count = len(groups)
    return {
        "groups": count,
        "rows": int(sum(len(group) for group in groups)),
        "top1AgreementWithIncumbent": top1_agree / count,
        "top2MeanOverlapWithIncumbent": top2_overlap / count,
        "pairwiseComparable": pairwise_comparable,
        "pairwiseAgreementWithIncumbent": pairwise_agree / pairwise_comparable,
        "truthComparable": truth_comparable,
        "incumbentPairwiseTruthAccuracy": incumbent_truth_correct / truth_comparable,
        "candidatePairwiseTruthAccuracy": candidate_truth_correct / truth_comparable,
        "incumbentSelectedTop1TruthMean": incumbent_top1_truth / count,
        "candidateSelectedTop1TruthMean": candidate_top1_truth / count,
        "oracleTop1TruthMean": oracle_top1_truth / count,
        "incumbentTop1Regret": (oracle_top1_truth - incumbent_top1_truth) / count,
        "candidateTop1Regret": (oracle_top1_truth - candidate_top1_truth) / count,
        "incumbentSelectedTop2TruthMean": incumbent_top2_truth / count,
        "candidateSelectedTop2TruthMean": candidate_top2_truth / count,
    }


def source_ranking_summary(
    truth: np.ndarray,
    incumbent: np.ndarray,
    candidate: np.ndarray,
    groups: list[np.ndarray],
    sources: np.ndarray,
) -> dict[str, Any]:
    by_source: dict[str, list[np.ndarray]] = defaultdict(list)
    for group in groups:
        by_source[str(sources[group[0]])].append(group)
    top1_deltas: dict[str, float] = {}
    top2_deltas: dict[str, float] = {}
    pairwise_deltas: dict[str, float] = {}
    for source, source_groups in sorted(by_source.items()):
        summary = ranking_metrics(
            truth, incumbent, candidate, source_groups
        )
        top1_deltas[source] = float(
            summary["candidateSelectedTop1TruthMean"]
            - summary["incumbentSelectedTop1TruthMean"]
        )
        top2_deltas[source] = float(
            summary["candidateSelectedTop2TruthMean"]
            - summary["incumbentSelectedTop2TruthMean"]
        )
        pairwise_deltas[source] = float(
            summary["candidatePairwiseTruthAccuracy"]
            - summary["incumbentPairwiseTruthAccuracy"]
        )
    def aggregate(values: dict[str, float]) -> dict[str, float | int]:
        observed = np.asarray(list(values.values()), dtype=np.float64)
        return {
            "macroMeanDelta": float(np.mean(observed)),
            "sourcesImproved": int(np.count_nonzero(observed > 0)),
            "sourcesUnchanged": int(np.count_nonzero(observed == 0)),
            "sourcesWorsened": int(np.count_nonzero(observed < 0)),
        }
    return {
        "sources": len(by_source),
        "top1Truth": aggregate(top1_deltas),
        "top2Truth": aggregate(top2_deltas),
        "pairwiseTruthAccuracy": aggregate(pairwise_deltas),
        "top1TruthDeltaBySource": top1_deltas,
        "top2TruthDeltaBySource": top2_deltas,
        "pairwiseTruthAccuracyDeltaBySource": pairwise_deltas,
    }


def main() -> None:
    args = arguments()
    candidates = parse_candidates(args.candidate)
    metadata, X, development, truth, sources, seeds = load_dataset(args.dataset)
    finite_validation = ~development & np.isfinite(truth)
    X = X[finite_validation]
    truth = truth[finite_validation]
    sources = sources[finite_validation]
    seeds = seeds[finite_validation]
    incumbent_artifact = json.loads(args.incumbent.read_text())
    names = incumbent_artifact["featureNames"]
    projection = [metadata["featureNames"].index(name) for name in names]
    X = X[:, projection]
    incumbent = model_prediction(incumbent_artifact, X)
    group_indexes = context_feature_indexes(names)
    groups = proxy_groups(X, sources, seeds, group_indexes)
    group_sizes = np.asarray([len(group) for group in groups], dtype=np.int64)
    report: dict[str, Any] = {
        "schema": "line.aim-impact-ranking-assay.v1",
        "contract": {
            "dataset": str(args.dataset),
            "partition": "validation",
            "finiteRealizedImpactFit": True,
            "rows": int(X.shape[0]),
            "proxyGroupSemantics": (
                "same source, seed, durations, incoming targets, and outgoing targets; "
                "not a production aim knob-grid identifier"
            ),
            "contextFeatures": [names[index] for index in group_indexes],
            "groups": len(groups),
            "groupedRows": int(np.sum(group_sizes)),
            "groupSize": {
                "minimum": int(np.min(group_sizes)),
                "median": float(np.median(group_sizes)),
                "p95": float(np.quantile(group_sizes, 0.95)),
                "maximum": int(np.max(group_sizes)),
            },
        },
        "incumbentAbsoluteTruth": metrics(truth, incumbent),
        "candidates": {},
    }
    for name, path in candidates.items():
        artifact = json.loads(path.read_text())
        if artifact["featureNames"] != names:
            raise ValueError(f"candidate {name!r} has a different feature projection")
        prediction = model_prediction(artifact, X)
        report["candidates"][name] = {
            "artifact": str(path),
            "absoluteTruth": metrics(truth, prediction),
            "rankingProxy": ranking_metrics(truth, incumbent, prediction, groups),
            "sourceRankingProxy": source_ranking_summary(
                truth, incumbent, prediction, groups, sources
            ),
        }
    rendered = json.dumps(report, indent=2) + "\n"
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered)
    print(rendered, end="")


if __name__ == "__main__":
    main()
