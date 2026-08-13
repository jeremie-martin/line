#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy==2.5.1",
#   "scikit-learn==1.7.2",
# ]
# ///
"""Measure cheap surrogates for aim's missing-articulation impact inference.

The production readiness component is intentionally optimized for prediction
quality, not for evaluating roughly one thousand fitted knob vectors per grid.
Aim supplies velocity and sled pose but no articulated point state.  This tool
replays that exact missing-articulation feature contract over the frozen
readiness corpus, labels it with the shipped impact component, and measures
smaller models against that teacher.  It is an offline model-cost study: truth
labels and the authored specification are never changed.

Usage:
  uv run scripts/v0/distill_aim_impact_model.py \
    --dataset generated/analysis/readiness-training.jsonl.gz \
    --model scripts/v0/optimizer/readiness_model.json \
    [--out generated/analysis/aim-impact-distillation.json]
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--artifact-out", type=Path)
    parser.add_argument(
        "--selected",
        choices=("hist_16", "hist_32"),
        default="hist_32",
        help="histogram surrogate to serialize (default: hist_32)",
    )
    return parser.parse_args()


def load_dataset(path: Path) -> tuple[dict[str, Any], np.ndarray, np.ndarray]:
    features: list[list[float]] = []
    development: list[bool] = []
    with gzip.open(path, "rt", encoding="utf8") as stream:
        metadata = json.loads(next(stream))
        for line in stream:
            row = json.loads(line)
            if row.get("kind") != "row" or row.get("authored", {}).get("impact") is not True:
                continue
            features.append(row["features"])
            development.append(row["partition"] == "development")
    X = np.asarray(features, dtype=np.float64)
    names = metadata["featureNames"]
    for index, name in enumerate(names):
        if not name.startswith("articulation:"):
            continue
        X[:, index] = 1.0 if name == "articulation:missing" else 0.0
    return metadata, X, np.asarray(development, dtype=bool)


def predict_histogram(model: dict[str, Any], X: np.ndarray) -> np.ndarray:
    prediction = np.full(X.shape[0], float(model["initialPrediction"]), dtype=np.float64)
    rows = np.arange(X.shape[0])
    for raw_tree in model["trees"]:
        left = np.asarray(raw_tree["childrenLeft"], dtype=np.int16)
        right = np.asarray(raw_tree["childrenRight"], dtype=np.int16)
        feature = np.asarray(raw_tree["feature"], dtype=np.int16)
        threshold = np.asarray(raw_tree["threshold"], dtype=np.float64)
        value = np.asarray(raw_tree["value"], dtype=np.float64)
        leaf = np.asarray(raw_tree["isLeaf"], dtype=bool)
        missing_left = np.asarray(raw_tree["missingGoToLeft"], dtype=bool)
        node = np.zeros(X.shape[0], dtype=np.int16)
        while not np.all(leaf[node]):
            active = ~leaf[node]
            active_rows = rows[active]
            active_nodes = node[active]
            observed = X[active_rows, feature[active_nodes]]
            go_left = np.where(
                np.isfinite(observed),
                observed <= threshold[active_nodes],
                missing_left[active_nodes],
            )
            node[active] = np.where(go_left, left[active_nodes], right[active_nodes])
        prediction += value[node]
    return np.clip(prediction, 0.0, 1.0)


def metrics(expected: np.ndarray, actual: np.ndarray) -> dict[str, float]:
    return {
        "mse": float(mean_squared_error(expected, actual)),
        "mae": float(mean_absolute_error(expected, actual)),
        "bias": float(np.mean(actual - expected)),
        "correlation": float(np.corrcoef(expected, actual)[0, 1]),
    }


def serialize_histogram(model: HistGradientBoostingRegressor) -> dict[str, Any]:
    trees = []
    for iteration in model._predictors:  # type: ignore[attr-defined]
        if len(iteration) != 1:
            raise ValueError("multi-output histogram model is unsupported")
        nodes = iteration[0].nodes
        if np.any(nodes["is_categorical"]):
            raise ValueError("categorical histogram splits are unsupported")
        trees.append(
            {
                "childrenLeft": nodes["left"].astype(np.int64).tolist(),
                "childrenRight": nodes["right"].astype(np.int64).tolist(),
                "feature": nodes["feature_idx"].astype(np.int64).tolist(),
                "threshold": nodes["num_threshold"].tolist(),
                "value": nodes["value"].tolist(),
                "isLeaf": nodes["is_leaf"].astype(bool).tolist(),
                "missingGoToLeft": nodes["missing_go_to_left"].astype(bool).tolist(),
            }
        )
    return {
        "family": "hist_gradient_boosting_regressor",
        "link": "identity_clip",
        "initialPrediction": float(model._baseline_prediction[0, 0]),  # type: ignore[attr-defined]
        "trees": trees,
    }


def main() -> None:
    args = arguments()
    metadata, X, development = load_dataset(args.dataset)
    artifact = json.loads(args.model.read_text())
    extractor_names = metadata["featureNames"]
    projection = [extractor_names.index(name) for name in artifact["featureNames"]]
    X = X[:, projection]
    teacher_model = artifact["components"]["impactFeasibility"]
    if teacher_model.get("family") != "hist_gradient_boosting_regressor":
        raise ValueError("impact teacher is not the expected histogram ensemble")
    y = predict_histogram(teacher_model, X)
    train_X, test_X = X[development], X[~development]
    train_y, test_y = y[development], y[~development]
    candidates: dict[str, Any] = {
        "ridge_1e-4": make_pipeline(StandardScaler(), Ridge(alpha=1e-4)),
        "ridge_1e-2": make_pipeline(StandardScaler(), Ridge(alpha=1e-2)),
        "ridge_1": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "extra_trees_8x6": ExtraTreesRegressor(
            n_estimators=8,
            max_depth=6,
            min_samples_leaf=40,
            n_jobs=-1,
            random_state=0,
        ),
        "extra_trees_16x8": ExtraTreesRegressor(
            n_estimators=16,
            max_depth=8,
            min_samples_leaf=40,
            n_jobs=-1,
            random_state=0,
        ),
        "hist_16": HistGradientBoostingRegressor(
            learning_rate=0.08,
            max_iter=16,
            max_leaf_nodes=15,
            min_samples_leaf=100,
            l2_regularization=1.0,
            early_stopping=False,
            random_state=0,
        ),
        "hist_32": HistGradientBoostingRegressor(
            learning_rate=0.08,
            max_iter=32,
            max_leaf_nodes=15,
            min_samples_leaf=100,
            l2_regularization=1.0,
            early_stopping=False,
            random_state=0,
        ),
    }
    results: dict[str, Any] = {}
    fitted: dict[str, Any] = {}
    for name, candidate in candidates.items():
        candidate.fit(train_X, train_y)
        fitted[name] = candidate
        predicted = np.clip(candidate.predict(test_X), 0.0, 1.0)
        results[name] = metrics(test_y, predicted)
    selected = args.selected
    serialized_selected = serialize_histogram(fitted[selected])
    selected_prediction = np.clip(fitted[selected].predict(test_X), 0.0, 1.0)
    serialized_prediction = predict_histogram(serialized_selected, test_X)
    export_parity_max_absolute_error = float(
        np.max(np.abs(selected_prediction - serialized_prediction))
    )
    report = {
        "schema": "line.aim-impact-distillation-study.v1",
        "dataset": str(args.dataset),
        "model": str(args.model),
        "featureTransformId": metadata["featureTransformId"],
        "contract": {
            "target": "shipped impactFeasibility prediction",
            "articulation": "missing, matching aim's fitted next-arrival readout",
            "authoredImpactOnly": True,
            "developmentRows": int(np.count_nonzero(development)),
            "validationRows": int(np.count_nonzero(~development)),
            "teacherTrees": len(teacher_model["trees"]),
            "teacherFeatures": len(artifact["featureNames"]),
        },
        "teacherValidationLevel": {
            "mean": float(np.mean(test_y)),
            "standardDeviation": float(np.std(test_y)),
        },
        "selected": selected,
        "exportParityMaxAbsoluteError": export_parity_max_absolute_error,
        "candidates": results,
    }
    rendered = json.dumps(report, indent=2) + "\n"
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered)
    if args.artifact_out is not None:
        artifact_out = {
            "schema": artifact["schema"],
            "generatorPolicyId": artifact["generatorPolicyId"],
            "featureTransformId": artifact["featureTransformId"],
            "targetSemanticsId": artifact["targetSemanticsId"],
            "trainingCorpus": artifact["trainingCorpus"],
            "featureNames": artifact["featureNames"],
            "components": {
                "impactFeasibility": serialized_selected,
            },
            "distillation": {
                "schema": "line.aim-impact-distillation.v1",
                "teacher": str(args.model),
                "dataset": str(args.dataset),
                "articulation": "missing",
                "selected": selected,
                "validation": results[selected],
                "exportParityMaxAbsoluteError": export_parity_max_absolute_error,
            },
        }
        args.artifact_out.parent.mkdir(parents=True, exist_ok=True)
        args.artifact_out.write_text(json.dumps(artifact_out, separators=(",", ":")) + "\n")
    print(rendered, end="")


if __name__ == "__main__":
    main()
