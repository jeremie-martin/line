#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy==2.5.1",
#   "scikit-learn==1.7.2",
# ]
# ///
"""Append a small realized-fit residual to the deployed aim impact model.

Unlike refitting a replacement forest, this preserves every incumbent tree and
learns only the held-out correction left by the deployed policy.  The exported
artifact remains one histogram ensemble and receives the same final [0, 1]
clip as production inference.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from distill_aim_impact_model import (
    grouped_metrics,
    load_dataset,
    metrics,
    predict_histogram,
    predict_histogram_raw,
    serialize_histogram,
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--incumbent", type=Path, required=True)
    parser.add_argument("--iterations", type=int, required=True)
    parser.add_argument(
        "--target",
        choices=("absolute", "group-centered"),
        default="absolute",
        help="residual target (default: absolute)",
    )
    parser.add_argument(
        "--group-centering-strength",
        type=float,
        default=1.0,
        help="fraction of each proxy group's mean residual removed (default: 1)",
    )
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--artifact-out", type=Path, required=True)
    return parser.parse_args()


def combined_component(
    incumbent: dict[str, Any],
    correction: dict[str, Any],
) -> dict[str, Any]:
    if incumbent.get("family") != "hist_gradient_boosting_regressor":
        raise ValueError("incumbent is not a histogram ensemble")
    correction_trees = json.loads(json.dumps(correction["trees"]))
    correction_bias = float(correction["initialPrediction"])
    if not correction_trees:
        raise ValueError("correction ensemble has no trees")
    # Keep the deployed ensemble's initial value and every deployed tree in
    # their exact order. Fold the correction intercept into each possible leaf
    # of its first tree, so it is added once *after* the incumbent prefix.
    # Moving it into the combined initial prediction would reassociate all 32
    # incumbent additions and can perturb search ties by a few ulps.
    first = correction_trees[0]
    first["value"] = [
        value + correction_bias if is_leaf else value
        for value, is_leaf in zip(first["value"], first["isLeaf"], strict=True)
    ]
    return {
        "family": "hist_gradient_boosting_regressor",
        "link": "identity_clip",
        "initialPrediction": float(incumbent["initialPrediction"]),
        "trees": [*incumbent["trees"], *correction_trees],
    }


def proxy_group_indexes(
    X: np.ndarray,
    feature_names: list[str],
    sources: np.ndarray,
    seeds: np.ndarray,
    development: np.ndarray,
) -> tuple[list[np.ndarray], list[str]]:
    context_indexes = [
        index
        for index, name in enumerate(feature_names)
        if name in ("log_duration", "log_duration2")
        or name.startswith("target:")
        or name.startswith("missing:")
        or name.startswith("out:")
    ]
    context = np.ascontiguousarray(X[:, context_indexes], dtype=np.float64)
    grouped: dict[tuple[bool, str, int, bytes], list[int]] = defaultdict(list)
    for index in range(X.shape[0]):
        grouped[
            (
                bool(development[index]),
                str(sources[index]),
                int(seeds[index]),
                context[index].tobytes(),
            )
        ].append(index)
    return (
        [
            np.asarray(indexes, dtype=np.int64)
            for indexes in grouped.values()
            if len(indexes) >= 2
        ],
        [feature_names[index] for index in context_indexes],
    )


def main() -> None:
    args = arguments()
    if args.iterations <= 0 or args.iterations > 32:
        raise ValueError("--iterations must be in [1, 32]")
    if not 0 <= args.group_centering_strength <= 1:
        raise ValueError("--group-centering-strength must be in [0, 1]")
    if args.target == "absolute" and args.group_centering_strength != 1:
        raise ValueError(
            "--group-centering-strength is legal only with --target=group-centered"
        )
    metadata, X, development, truth, sources, seeds = load_dataset(args.dataset)
    finite = np.isfinite(truth)
    X = X[finite]
    development = development[finite]
    truth = truth[finite]
    sources = sources[finite]
    seeds = seeds[finite]
    artifact = json.loads(args.incumbent.read_text())
    incumbent_sha256 = sha256(args.incumbent.read_bytes()).hexdigest()
    projection = [metadata["featureNames"].index(name) for name in artifact["featureNames"]]
    X = X[:, projection]
    incumbent_component = artifact["components"]["impactFeasibility"]
    incumbent_raw = predict_histogram_raw(incumbent_component, X)
    incumbent_prediction = np.clip(incumbent_raw, 0.0, 1.0)
    residual_target = truth - incumbent_raw
    train_mask = development.copy()
    target_contract: dict[str, Any] = {
        "target": "realized-impact-fit-minus-incumbent-raw-prediction",
    }
    if args.target == "group-centered":
        groups, context_features = proxy_group_indexes(
            X,
            artifact["featureNames"],
            sources,
            seeds,
            development,
        )
        grouped = np.zeros(X.shape[0], dtype=bool)
        for indexes in groups:
            residual_target[indexes] -= (
                args.group_centering_strength * np.mean(residual_target[indexes])
            )
            grouped[indexes] = True
        train_mask &= grouped
        target_contract = {
            "target": "within-proxy-group-centered-realized-impact-residual",
            "groupCenteringStrength": args.group_centering_strength,
            "proxyGroupSemantics": (
                "same partition, source, seed, durations, incoming targets, "
                "and outgoing targets"
            ),
            "contextFeatures": context_features,
            "developmentGroups": sum(bool(development[group[0]]) for group in groups),
            "validationGroups": sum(not bool(development[group[0]]) for group in groups),
            "groupedDevelopmentRows": int(np.count_nonzero(grouped & development)),
            "groupedValidationRows": int(np.count_nonzero(grouped & ~development)),
        }
    correction = HistGradientBoostingRegressor(
        learning_rate=0.08,
        max_iter=args.iterations,
        max_leaf_nodes=15,
        min_samples_leaf=100,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=0,
    )
    correction.fit(
        X[train_mask],
        residual_target[train_mask],
    )
    serialized_correction = serialize_histogram(correction)
    component = combined_component(incumbent_component, serialized_correction)
    sklearn_composed_prediction = np.clip(
        incumbent_raw[~development] + correction.predict(X[~development]),
        0.0,
        1.0,
    )
    serialized_prediction = predict_histogram(component, X[~development])
    incumbent_prefix = {
        **component,
        "trees": component["trees"][: len(incumbent_component["trees"])],
    }
    validation_truth = truth[~development]
    validation_sources = sources[~development]
    source_deltas: dict[str, float] = {}
    for source in np.unique(validation_sources):
        mask = validation_sources == source
        source_deltas[str(source)] = (
            metrics(validation_truth[mask], incumbent_prediction[~development][mask])["mse"]
            - metrics(validation_truth[mask], serialized_prediction[mask])["mse"]
        )
    report = {
        "schema": "line.aim-impact-residual-study.v1",
        "contract": {
            "dataset": str(args.dataset),
            "incumbent": str(args.incumbent),
            "incumbentSha256": incumbent_sha256,
            **target_contract,
            "articulation": "missing",
            "incumbentTrees": len(incumbent_component["trees"]),
            "correctionTrees": args.iterations,
            "exportedTrees": len(component["trees"]),
            "developmentRows": int(np.count_nonzero(development)),
            "validationRows": int(np.count_nonzero(~development)),
        },
        "validation": {
            "incumbent": metrics(
                validation_truth, incumbent_prediction[~development]
            ),
            "selected": metrics(validation_truth, serialized_prediction),
            "sourceMacro": {
                "incumbent": grouped_metrics(
                    validation_truth,
                    incumbent_prediction[~development],
                    validation_sources,
                ),
                "selected": grouped_metrics(
                    validation_truth, serialized_prediction, validation_sources
                ),
            },
            "sourceMseDeltaIncumbentMinusSelected": source_deltas,
            "sourcesImproved": sum(value > 0 for value in source_deltas.values()),
            "sourcesWorsened": sum(value < 0 for value in source_deltas.values()),
        },
        "exportParityMaxAbsoluteError": float(
            np.max(np.abs(sklearn_composed_prediction - serialized_prediction))
        ),
        "incumbentPrefixParityMaxAbsoluteError": float(
            np.max(
                np.abs(
                    predict_histogram_raw(incumbent_prefix, X[~development])
                    - incumbent_raw[~development]
                )
            )
        ),
    }
    training = {
        "schema": "line.aim-impact-residual-training.v1",
        "dataset": str(args.dataset),
        "incumbent": str(args.incumbent),
        "incumbentSha256": incumbent_sha256,
        **target_contract,
        "articulation": "missing",
        "correctionTrees": args.iterations,
        "validation": report["validation"]["selected"],
        "exportParityMaxAbsoluteError": report["exportParityMaxAbsoluteError"],
        "incumbentPrefixParityMaxAbsoluteError": report[
            "incumbentPrefixParityMaxAbsoluteError"
        ],
    }
    artifact_out = {
        **{key: value for key, value in artifact.items() if key != "components"},
        "components": {"impactFeasibility": component},
        "aimImpactResidualTraining": training,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    args.artifact_out.parent.mkdir(parents=True, exist_ok=True)
    args.artifact_out.write_text(
        json.dumps(artifact_out, separators=(",", ":")) + "\n"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
