# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy==2.5.1",
#   "scikit-learn==1.7.2",
# ]
# ///
"""Fit small next-arc readiness models from the frozen TypeScript dataset.

This script deliberately owns only statistical fitting and model selection.
TypeScript owns feature semantics, target construction, corpus collection, and
production inference.  Development families select models; the third seed is
kept out of every fit and hyperparameter choice and is used once to decide
between the complete candidate artifact and the incumbent.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn import __version__ as sklearn_version
from sklearn.ensemble import (
    ExtraTreesRegressor,
    HistGradientBoostingRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler


RIDGE_ALPHAS = (0.0001, 0.001, 0.01, 0.1, 1.0, 10.0, 100.0)
LOGISTIC_CS = (0.01, 0.1, 1.0, 10.0, 100.0)
PRIMARY_TARGETS = (
    "catchability",
    "impactFeasibility",
    "speedFit",
    "airFit",
    "elevationFit",
)
BOOTSTRAP_DRAWS = 10_000


@dataclass(frozen=True)
class Candidate:
    name: str
    family: str
    parameter: float | None = None

    @property
    def deployable(self) -> bool:
        return self.family in {
            "ridge",
            "logistic",
            "extra_trees",
            "hist",
        }

    @property
    def linear(self) -> bool:
        return self.family in {"ridge", "logistic"}

    @property
    def inference_steps(self) -> int:
        if self.linear:
            return 80
        if self.family == "extra_trees":
            return 24 * 8
        if self.family == "hist":
            return int(self.parameter) * 4
        return 1_000_000


@dataclass
class Target:
    name: str
    probability: bool
    indices: np.ndarray
    y: np.ndarray
    observations: np.ndarray
    successes: np.ndarray | None
    current: np.ndarray


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        default="generated/analysis/readiness-training.jsonl.gz",
    )
    parser.add_argument(
        "--out",
        default="generated/analysis/readiness-training-report.json",
    )
    parser.add_argument(
        "--model-out",
        default="generated/analysis/readiness-model.json",
    )
    parser.add_argument(
        "--production-model-out",
        default=None,
        help=(
            "optional compact TypeScript-runtime artifact; parity fixtures and "
            "training metadata are excluded"
        ),
    )
    parser.add_argument(
        "--parity-out",
        default=None,
        help="optional compact cross-language parity fixture",
    )
    parser.add_argument(
        "--incumbent-model",
        default="scripts/v0/optimizer/readiness_model.json",
        help="checked runtime artifact retained when an alternative is rejected",
    )
    parser.add_argument(
        "--components",
        default=",".join(PRIMARY_TARGETS),
        help="comma-separated component names; intended only for debugging",
    )
    parser.add_argument(
        "--drop-feature-prefix",
        default=None,
        help=(
            "comma-separated feature-name prefixes to remove before training. "
            "Diagnostic only: a model trained this way does not match the "
            "TypeScript feature vector and must not be exported to production "
            "without the matching change there. Use it to ask whether a group "
            "of features earns its place before paying to predict it."
        ),
    )
    parser.add_argument(
        "--linear-only",
        action="store_true",
        help="skip the single nonlinear diagnostic model",
    )
    return parser.parse_args()


def drop_feature_columns(
    metadata: dict[str, Any],
    data: dict[str, Any],
    prefixes: str | None,
) -> None:
    """Remove whole feature groups in place, by name prefix."""
    if not prefixes:
        return
    wanted = [p.strip() for p in prefixes.split(",") if p.strip()]
    if not wanted:
        return
    names = metadata["featureNames"]
    keep = [
        index
        for index, name in enumerate(names)
        if not any(name.startswith(prefix) for prefix in wanted)
    ]
    dropped = [name for index, name in enumerate(names) if index not in set(keep)]
    if not dropped:
        raise ValueError(f"no features matched {wanted}")
    data["X"] = data["X"][:, keep]
    metadata["featureNames"] = [names[index] for index in keep]
    metadata["droppedFeatures"] = dropped
    # A model on a different feature space has no incumbent to be compared
    # against: the runtime artifact expects the full vector, so parity is
    # meaningless here rather than merely inconvenient.
    data["hasIncumbent"] = False
    print(
        f"dropped {len(dropped)} of {len(names)} features "
        f"({', '.join(dropped)})",
        flush=True,
    )


def load_dataset(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    with gzip.open(path, "rt", encoding="utf8") as stream:
        metadata = json.loads(stream.readline())
        if (
            metadata.get("kind") != "metadata"
            or metadata.get("schema")
            != "line.readiness-training-dataset.v3"
        ):
            raise ValueError("unsupported readiness training dataset")
        row_count = int(metadata["rows"])
        feature_count = len(metadata["featureNames"])
        data: dict[str, Any] = {
            "X": np.empty((row_count, feature_count), dtype=np.float64),
            "source": np.empty(row_count, dtype=object),
            "family": np.empty(row_count, dtype=object),
            "seed": np.empty(row_count, dtype=np.int64),
            "partition": np.empty(row_count, dtype=object),
            "attempts": np.empty(row_count, dtype=np.int32),
            "viable": np.empty(row_count, dtype=np.int32),
            "impactFit": np.full(row_count, np.nan),
            "complete": np.empty(row_count, dtype=np.int32),
            "speedFit": np.full(row_count, np.nan),
            "airFit": np.full(row_count, np.nan),
            "elevationFit": np.full(row_count, np.nan),
            "utility": np.empty(row_count),
            "currentCatchability": np.empty(row_count),
            "currentImpactFeasibility": np.empty(row_count),
            "currentSpeedFit": np.empty(row_count),
            "currentAirFit": np.empty(row_count),
            "currentElevationFit": np.empty(row_count),
            "authoredImpact": np.empty(row_count, dtype=bool),
            "authoredSpeed": np.empty(row_count, dtype=bool),
            "authoredAir": np.empty(row_count, dtype=bool),
            "authoredElevation": np.empty(row_count, dtype=bool),
            "hasIncumbent": metadata.get("incumbent") is not None,
        }
        seen = 0
        for seen, line in enumerate(stream, start=1):
            row = json.loads(line)
            if row.get("kind") != "row":
                raise ValueError(f"unexpected record {seen + 1}")
            index = seen - 1
            if index >= row_count:
                raise ValueError("dataset contains more rows than metadata")
            truth = row["truth"]
            current = row["current"]
            authored = row["authored"]
            data["X"][index] = row["features"]
            data["source"][index] = row["sourceId"]
            data["family"][index] = row["originFamily"]
            data["seed"][index] = row["seed"]
            data["partition"][index] = row["partition"]
            data["attempts"][index] = truth["attempts"]
            data["viable"][index] = truth["viable"]
            impact_fit = truth["impactFit"]
            data["impactFit"][index] = (
                np.nan if impact_fit is None else impact_fit
            )
            data["complete"][index] = truth["outgoingStatus"]["complete"]
            for target in ("speedFit", "airFit", "elevationFit"):
                value = truth[target]
                data[target][index] = np.nan if value is None else value
            data["utility"][index] = truth["utility"]
            data["currentCatchability"][index] = current["catchability"]
            data["currentImpactFeasibility"][index] = current[
                "impactFeasibility"
            ]
            data["currentSpeedFit"][index] = current["speedFit"]
            data["currentAirFit"][index] = current["airFit"]
            data["currentElevationFit"][index] = current["elevationFit"]
            data["authoredImpact"][index] = authored["impact"]
            data["authoredSpeed"][index] = authored["speed"]
            data["authoredAir"][index] = authored["air"]
            data["authoredElevation"][index] = authored["elevation"]
        if seen != row_count:
            raise ValueError(
                f"dataset metadata says {row_count} rows, found {seen}"
            )
    if not np.isfinite(data["X"]).all():
        raise ValueError("readiness features must all be finite")
    data["caseSeed"] = np.asarray(
        [
            f"{source}/s{seed}"
            for source, seed in zip(data["source"], data["seed"])
        ],
        dtype=object,
    )
    return metadata, data


def target_from_data(name: str, data: dict[str, Any]) -> Target | None:
    size = len(data["seed"])
    if name == "catchability":
        observations = data["attempts"]
        successes = data["viable"]
        mask = observations > 0
        current_name = "currentCatchability"
        probability = True
    elif name == "impactFeasibility":
        observations = np.ones(size, dtype=np.int32)
        successes = None
        mask = data["authoredImpact"] & np.isfinite(data["impactFit"])
        current_name = "currentImpactFeasibility"
        probability = False
        target_values = data["impactFit"]
    elif name in {"speedFit", "airFit", "elevationFit"}:
        axis = name.removesuffix("Fit")
        observations = np.ones(size, dtype=np.int32)
        successes = None
        mask = data[f"authored{axis.capitalize()}"] & np.isfinite(data[name])
        current_name = f"current{name[0].upper()}{name[1:]}"
        probability = False
        target_values = data[name]
    else:
        raise ValueError(f"unknown readiness target {name}")
    indices = np.flatnonzero(mask)
    if indices.size == 0:
        return None
    target_observations = observations[indices].astype(np.float64)
    y = (
        successes[indices] / target_observations
        if successes is not None
        else target_values[indices]
    )
    current = data[current_name][indices].astype(np.float64)
    if not data["hasIncumbent"]:
        development = data["partition"][indices] == "development"
        if not np.any(development):
            raise ValueError(
                f"{name} has no development contexts for bootstrap reference"
            )
        development_groups = data["caseSeed"][indices][development]
        development_y = np.asarray(y, dtype=np.float64)[development]
        development_observations = target_observations[development]
        group_means = []
        for group in np.unique(development_groups):
            group_mask = development_groups == group
            if probability:
                group_means.append(
                    float(
                        np.sum(
                            development_y[group_mask]
                            * development_observations[group_mask]
                        )
                        / np.sum(development_observations[group_mask])
                    )
                )
            else:
                group_means.append(
                    float(np.mean(development_y[group_mask]))
                )
        bootstrap_constant = float(np.mean(group_means))
        current = np.full(len(indices), bootstrap_constant)
        data[current_name][:] = bootstrap_constant
    return Target(
        name=name,
        probability=probability,
        indices=indices,
        y=np.asarray(y, dtype=np.float64),
        observations=target_observations,
        successes=None
        if successes is None
        else successes[indices].astype(np.float64),
        current=current,
    )


def candidates_for(target: Target, linear_only: bool) -> list[Candidate]:
    candidates = [
        Candidate(f"ridge_alpha_{alpha:g}", "ridge", alpha)
        for alpha in RIDGE_ALPHAS
    ]
    if target.probability:
        candidates.extend(
            Candidate(f"logistic_c_{value:g}", "logistic", value)
            for value in LOGISTIC_CS
        )
    if not linear_only:
        candidates.append(Candidate("compact_extra_trees", "extra_trees"))
        candidates.extend(
            Candidate(f"hist_gradient_boosting_{iterations}", "hist", iterations)
            for iterations in (64, 128, 200)
        )
    return candidates


def normalized_group_weights(
    groups: np.ndarray, raw_weights: np.ndarray
) -> np.ndarray:
    totals: dict[str, float] = {}
    for group, weight in zip(groups, raw_weights):
        totals[str(group)] = totals.get(str(group), 0.0) + float(weight)
    return np.asarray(
        [weight / totals[str(group)] for group, weight in zip(groups, raw_weights)]
    )


def fit_candidate(
    candidate: Candidate,
    target: Target,
    X: np.ndarray,
    groups: np.ndarray,
) -> Any:
    if target.probability:
        assert target.successes is not None
        context_weights = normalized_group_weights(
            groups, target.observations
        )
    else:
        context_weights = normalized_group_weights(
            groups, np.ones_like(target.y)
        )
    if candidate.family == "ridge":
        scaler = StandardScaler().fit(X)
        estimator = Ridge(alpha=float(candidate.parameter))
        estimator.fit(
            scaler.transform(X),
            target.y,
            sample_weight=context_weights,
        )
        return scaler, estimator
    if candidate.family == "logistic":
        assert target.successes is not None
        failures = target.observations - target.successes
        unit_weights = context_weights / target.observations
        positive = target.successes > 0
        negative = failures > 0
        binary_X = np.concatenate((X[positive], X[negative]))
        binary_y = np.concatenate(
            (
                np.ones(np.count_nonzero(positive)),
                np.zeros(np.count_nonzero(negative)),
            )
        )
        binary_weights = np.concatenate(
            (
                target.successes[positive] * unit_weights[positive],
                failures[negative] * unit_weights[negative],
            )
        )
        scaler = StandardScaler().fit(X)
        estimator = LogisticRegression(
            C=float(candidate.parameter),
            solver="lbfgs",
            max_iter=2_000,
            tol=1e-9,
        )
        estimator.fit(
            scaler.transform(binary_X),
            binary_y,
            sample_weight=binary_weights,
        )
        return scaler, estimator
    if candidate.family == "hist":
        model = HistGradientBoostingRegressor(
            loss="squared_error",
            learning_rate=0.05,
            max_iter=int(candidate.parameter),
            max_leaf_nodes=15,
            min_samples_leaf=100,
            l2_regularization=1.0,
            early_stopping=False,
            random_state=0,
        )
        model.fit(X, target.y, sample_weight=context_weights)
        return model
    if candidate.family == "extra_trees":
        model = ExtraTreesRegressor(
            n_estimators=24,
            max_depth=8,
            min_samples_leaf=80,
            max_features=1.0,
            n_jobs=-1,
            random_state=0,
        )
        model.fit(X, target.y, sample_weight=context_weights)
        return model
    raise ValueError(f"unsupported model family {candidate.family}")


def predict_candidate(
    candidate: Candidate, model: Any, X: np.ndarray
) -> np.ndarray:
    if candidate.linear:
        scaler, estimator = model
        transformed = scaler.transform(X)
    else:
        estimator = model
        transformed = X
    if candidate.family == "logistic":
        prediction = estimator.predict_proba(transformed)[:, 1]
    else:
        prediction = estimator.predict(transformed)
    return np.clip(np.asarray(prediction, dtype=np.float64), 0.0, 1.0)


def subset_target(target: Target, indices: np.ndarray) -> Target:
    return Target(
        name=target.name,
        probability=target.probability,
        indices=target.indices[indices],
        y=target.y[indices],
        observations=target.observations[indices],
        successes=None
        if target.successes is None
        else target.successes[indices],
        current=target.current[indices],
    )


def macro_loss(
    loss: np.ndarray, weight: np.ndarray, groups: np.ndarray
) -> float:
    scores = []
    for group in np.unique(groups):
        mask = groups == group
        scores.append(float(np.sum(loss[mask]) / np.sum(weight[mask])))
    return float(np.mean(scores))


def primary_loss(
    target: Target, prediction: np.ndarray, groups: np.ndarray
) -> float:
    if target.probability:
        assert target.successes is not None
        failures = target.observations - target.successes
        loss = (
            target.successes * (1.0 - prediction) ** 2
            + failures * prediction**2
        )
        return macro_loss(loss, target.observations, groups)
    return macro_loss(
        (prediction - target.y) ** 2,
        np.ones_like(target.y),
        groups,
    )


def model_summary(
    target: Target,
    prediction: np.ndarray,
    groups: np.ndarray,
    families: np.ndarray,
) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "contexts": int(len(target.y)),
        "observations": int(np.sum(target.observations)),
        "caseSeedGroups": int(len(np.unique(groups))),
        "originFamilies": int(len(np.unique(families))),
        "primaryScore": primary_loss(target, prediction, groups),
    }
    if target.probability:
        assert target.successes is not None
        failures = target.observations - target.successes
        clipped = np.clip(prediction, 1e-9, 1.0 - 1e-9)
        log_loss = (
            -target.successes * np.log(clipped)
            - failures * np.log(1.0 - clipped)
        )
        binary_y = np.concatenate(
            (
                np.ones(len(target.y)),
                np.zeros(len(target.y)),
            )
        )
        binary_prediction = np.concatenate((prediction, prediction))
        binary_weight = np.concatenate((target.successes, failures))
        valid = binary_weight > 0
        summary["logLoss"] = macro_loss(
            log_loss, target.observations, groups
        )
        summary["auc"] = float(
            roc_auc_score(
                binary_y[valid],
                binary_prediction[valid],
                sample_weight=binary_weight[valid],
            )
        )
    else:
        summary["mae"] = macro_loss(
            np.abs(prediction - target.y),
            np.ones_like(target.y),
            groups,
        )
        summary["bias"] = macro_loss(
            prediction - target.y,
            np.ones_like(target.y),
            groups,
        )
        summary["correlation"] = (
            None
            if np.std(prediction) == 0 or np.std(target.y) == 0
            else float(np.corrcoef(prediction, target.y)[0, 1])
        )
    return summary


def family_losses(
    target: Target,
    prediction: np.ndarray,
    groups: np.ndarray,
    families: np.ndarray,
) -> dict[str, float]:
    per_group: dict[str, float] = {}
    group_family: dict[str, str] = {}
    for group in np.unique(groups):
        mask = groups == group
        per_group[str(group)] = primary_loss(
            subset_target(target, np.flatnonzero(mask)),
            prediction[mask],
            groups[mask],
        )
        family_values = np.unique(families[mask])
        if len(family_values) != 1:
            raise ValueError(f"case/seed group {group} spans source families")
        group_family[str(group)] = str(family_values[0])
    result: dict[str, list[float]] = {}
    for group, score in per_group.items():
        result.setdefault(group_family[group], []).append(score)
    return {
        family: float(np.mean(scores)) for family, scores in result.items()
    }


def paired_evidence(
    target: Target,
    baseline: np.ndarray,
    candidate: np.ndarray,
    groups: np.ndarray,
    families: np.ndarray,
) -> dict[str, Any]:
    baseline_losses = family_losses(target, baseline, groups, families)
    candidate_losses = family_losses(target, candidate, groups, families)
    common = sorted(set(baseline_losses) & set(candidate_losses))
    delta = np.asarray(
        [baseline_losses[key] - candidate_losses[key] for key in common]
    )
    rng = np.random.default_rng(20_260_724)
    sampled = delta[
        rng.integers(0, len(delta), size=(BOOTSTRAP_DRAWS, len(delta)))
    ].mean(axis=1)
    observed = float(np.mean(delta))
    signs = 1.0 - 2.0 * (
        (
            np.arange(1 << len(delta), dtype=np.uint32)[:, None]
            >> np.arange(len(delta), dtype=np.uint32)
        )
        & 1
    )
    null_means = (signs * delta).mean(axis=1)
    p_value = float(np.mean(null_means >= observed - 1e-15))
    return {
        "originFamilies": len(common),
        "meanAbsoluteImprovement": observed,
        "bootstrap95": [
            float(np.quantile(sampled, 0.025)),
            float(np.quantile(sampled, 0.975)),
        ],
        "exactPairedSignFlipP": p_value,
        "familiesImproved": int(np.count_nonzero(delta > 0)),
        "familiesRegressed": int(np.count_nonzero(delta < 0)),
    }


def cross_validated_predictions(
    candidate: Candidate,
    target: Target,
    data: dict[str, Any],
    development: np.ndarray,
) -> np.ndarray:
    X = data["X"][target.indices][development]
    y_target = subset_target(target, np.flatnonzero(development))
    families = data["family"][target.indices][development]
    groups = data["caseSeed"][target.indices][development]
    unique_families = np.unique(families)
    folds = min(5, len(unique_families))
    if folds < 2:
        raise ValueError(f"{target.name} has too few source families for CV")
    prediction = np.full(len(y_target.y), np.nan)
    splitter = GroupKFold(n_splits=folds)
    for train, held_out in splitter.split(X, y_target.y, groups=families):
        training_target = subset_target(y_target, train)
        model = fit_candidate(
            candidate, training_target, X[train], groups[train]
        )
        prediction[held_out] = predict_candidate(
            candidate, model, X[held_out]
        )
    if not np.isfinite(prediction).all():
        raise ValueError(f"{candidate.name} did not produce complete OOF data")
    return prediction


def serialize_linear_model(candidate: Candidate, model: Any) -> dict[str, Any]:
    scaler, estimator = model
    coefficients = np.asarray(estimator.coef_).reshape(-1)
    intercept = np.asarray(estimator.intercept_).reshape(-1)
    return {
        "family": candidate.family,
        "parameter": candidate.parameter,
        "link": "sigmoid" if candidate.family == "logistic" else "identity_clip",
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "coefficients": coefficients.tolist(),
        "intercept": float(intercept[0]),
    }


def serialize_tree(tree: Any) -> dict[str, Any]:
    return {
        "childrenLeft": tree.children_left.tolist(),
        "childrenRight": tree.children_right.tolist(),
        "feature": tree.feature.tolist(),
        "threshold": tree.threshold.tolist(),
        "value": tree.value[:, 0, 0].tolist(),
    }


def serialize_model(candidate: Candidate, model: Any) -> dict[str, Any]:
    if candidate.linear:
        return serialize_linear_model(candidate, model)
    if candidate.family == "extra_trees":
        return {
            "family": "extra_trees_regressor",
            "link": "identity_clip",
            "trees": [
                serialize_tree(estimator.tree_)
                for estimator in model.estimators_
            ],
        }
    if candidate.family == "hist":
        trees = []
        for iteration in model._predictors:
            if len(iteration) != 1:
                raise ValueError("multi-output histogram model is unsupported")
            predictor = iteration[0]
            nodes = predictor.nodes
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
                    "missingGoToLeft": nodes["missing_go_to_left"]
                    .astype(bool)
                    .tolist(),
                }
            )
        return {
            "family": "hist_gradient_boosting_regressor",
            "link": "identity_clip",
            "initialPrediction": float(model._baseline_prediction[0, 0]),
            "trees": trees,
        }
    raise ValueError(f"{candidate.name} is not exportable")


def predict_tree(tree: dict[str, Any], features: np.ndarray) -> float:
    index = 0
    leaf_flags = tree.get("isLeaf")
    while (
        not leaf_flags[index]
        if leaf_flags is not None
        else tree["childrenLeft"][index] != -1
    ):
        feature = tree["feature"][index]
        value = features[feature]
        go_left = (
            tree.get("missingGoToLeft", [False] * len(tree["feature"]))[index]
            if not math.isfinite(value)
            else value <= tree["threshold"][index]
        )
        index = (
            tree["childrenLeft"][index]
            if go_left
            else tree["childrenRight"][index]
        )
    return float(tree["value"][index])


def predict_serialized(
    artifact: dict[str, Any], X: np.ndarray
) -> np.ndarray:
    family = artifact["family"]
    if family in {"ridge", "logistic"}:
        mean = np.asarray(artifact["mean"])
        scale = np.asarray(artifact["scale"])
        coefficients = np.asarray(artifact["coefficients"])
        raw = artifact["intercept"] + ((X - mean) / scale) @ coefficients
        if artifact["link"] == "sigmoid":
            raw = 1.0 / (1.0 + np.exp(-raw))
    elif family == "extra_trees_regressor":
        raw = np.asarray(
            [
                np.mean(
                    [predict_tree(tree, features) for tree in artifact["trees"]]
                )
                for features in X
            ]
        )
    elif family == "hist_gradient_boosting_regressor":
        raw = np.asarray(
            [
                artifact["initialPrediction"]
                + sum(
                    predict_tree(tree, features)
                    for tree in artifact["trees"]
                )
                for features in X
            ]
        )
    else:
        raise ValueError(f"cannot execute serialized family {family}")
    return np.clip(raw, 0.0, 1.0)


def fit_target(
    target: Target,
    metadata: dict[str, Any],
    data: dict[str, Any],
    linear_only: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    partitions = data["partition"][target.indices]
    development = partitions == "development"
    validation = partitions == "validation"
    dev_target = subset_target(target, np.flatnonzero(development))
    val_target = subset_target(target, np.flatnonzero(validation))
    dev_groups = data["caseSeed"][target.indices][development]
    val_groups = data["caseSeed"][target.indices][validation]
    dev_families = data["family"][target.indices][development]
    val_families = data["family"][target.indices][validation]

    candidate_results: list[tuple[Candidate, np.ndarray, float]] = []
    for candidate in candidates_for(target, linear_only):
        prediction = cross_validated_predictions(
            candidate, target, data, development
        )
        score = primary_loss(dev_target, prediction, dev_groups)
        candidate_results.append((candidate, prediction, score))
        print(f"  {target.name:20s} {candidate.name:28s} OOF {score:.8f}")
    best = min(candidate_results, key=lambda result: result[2])
    deployable = [result for result in candidate_results if result[0].deployable]
    best_deployable = min(deployable, key=lambda result: result[2])
    linear = [result for result in candidate_results if result[0].linear]
    best_linear = min(linear, key=lambda result: result[2])
    near_best = [
        result
        for result in deployable
        if (result[2] - best[2]) / max(best[2], 1e-12) <= 0.01
    ]
    chosen = min(
        near_best,
        key=lambda result: (result[0].inference_steps, result[2]),
    )
    candidate, oof_prediction, oof_score = chosen
    current_oof = target.current[development]
    current_oof_score = primary_loss(dev_target, current_oof, dev_groups)
    development_improvement = (
        100.0 * (current_oof_score - oof_score) / current_oof_score
    )

    final_model = fit_candidate(
        candidate,
        dev_target,
        data["X"][target.indices][development],
        dev_groups,
    )
    validation_prediction = predict_candidate(
        candidate,
        final_model,
        data["X"][target.indices][validation],
    )
    current_validation = target.current[validation]
    current_validation_score = primary_loss(
        val_target, current_validation, val_groups
    )
    validation_score = primary_loss(
        val_target, validation_prediction, val_groups
    )
    validation_improvement = (
        100.0
        * (current_validation_score - validation_score)
        / current_validation_score
    )
    development_evidence = paired_evidence(
        dev_target,
        current_oof,
        oof_prediction,
        dev_groups,
        dev_families,
    )
    validation_evidence = paired_evidence(
        val_target,
        current_validation,
        validation_prediction,
        val_groups,
        val_families,
    )
    # Component validation is diagnostic only. Selecting individual
    # components on the decision seed and then evaluating their product on the
    # same seed would leak the decision set into the alternative. Development
    # OOF therefore fixes every component before one wholesale product test.
    decision_rule = (
        "development OOF fixes this component; only the complete candidate "
        "artifact may be accepted or rejected on the decision seed"
    )
    report = {
        "selected": candidate.name,
        "bestByScore": best[0].name,
        "bestDeployable": best_deployable[0].name,
        "bestLinear": best_linear[0].name,
        "simplicityRule":
            "among deployable models within 1% of the best OOF score, choose the fewest estimated inference steps",
        "decisionRule": decision_rule,
        "candidateOofScores": {
            result[0].name: result[2] for result in candidate_results
        },
        "development": {
            "current": model_summary(
                dev_target, current_oof, dev_groups, dev_families
            ),
            "alternative": model_summary(
                dev_target, oof_prediction, dev_groups, dev_families
            ),
            "improvementPct": development_improvement,
            "pairedEvidence": development_evidence,
        },
        "validation": {
            "current": model_summary(
                val_target, current_validation, val_groups, val_families
            ),
            "alternative": model_summary(
                val_target,
                validation_prediction,
                val_groups,
                val_families,
            ),
            "improvementPct": validation_improvement,
            "pairedEvidence": validation_evidence,
        },
        "decision": "candidate_for_product_decision",
        "statisticalPower": (
            "component_validation_is_diagnostic_only"
        ),
    }
    if not candidate.deployable:
        raise ValueError(
            f"development selected non-deployable model {candidate.name}"
        )
    artifact = serialize_model(candidate, final_model)
    all_X = data["X"][target.indices]
    parity_indices = np.unique(
        np.linspace(
            0,
            len(all_X) - 1,
            min(2_048, len(all_X)),
            dtype=np.int64,
        )
    )
    expected = predict_candidate(
        candidate, final_model, all_X[parity_indices]
    )
    serialized = predict_serialized(
        artifact, all_X[parity_indices]
    )
    maximum_error = float(np.max(np.abs(expected - serialized)))
    if maximum_error > 1e-12:
        raise ValueError(
            f"{target.name} export parity failed: {maximum_error}"
        )
    fixture_indices = parity_indices[
        np.linspace(
            0,
            len(parity_indices) - 1,
            min(32, len(parity_indices)),
            dtype=np.int64,
        )
    ]
    artifact["parity"] = {
        "tolerance": 1e-12,
        "pythonMaxAbsoluteError": maximum_error,
        "features": all_X[fixture_indices].tolist(),
        "expected": predict_candidate(
            candidate, final_model, all_X[fixture_indices]
        ).tolist(),
    }
    report["exportParityMaxAbsoluteError"] = maximum_error
    return report, artifact


def main() -> None:
    args = parse_args()
    metadata, data = load_dataset(Path(args.dataset))
    drop_feature_columns(metadata, data, args.drop_feature_prefix)
    requested = [value for value in args.components.split(",") if value]
    unknown = sorted(set(requested) - set(PRIMARY_TARGETS))
    if unknown:
        raise ValueError(f"unknown readiness components: {', '.join(unknown)}")
    report: dict[str, Any] = {
        "schema": "line.readiness-training-report.v3",
        "dataset": {
            "path": args.dataset,
            "schema": metadata["schema"],
            "rows": metadata["rows"],
            "featureNames": metadata["featureNames"],
            "corpus": metadata["corpus"],
            "grouping": metadata["grouping"],
        },
        "method": {
            "trainingLibrary": f"scikit-learn {sklearn_version}",
            "development":
                "first two canonical seeds; 5-fold GroupKFold by origin family",
            "validation":
                "third canonical decision seed; used once for wholesale artifact adoption",
            "primaryScoring":
                "macro-average of case/seed groups, matching the TypeScript evaluator",
            "uncertainty":
                "paired 10,000-draw family-cluster bootstrap and exact sign-flip test",
            "selection":
                "development OOF only; among deployable models within 1% of best, choose the fewest estimated inference steps",
            "reference": (
                "checked policy-compatible runtime artifact"
                if data["hasIncumbent"]
                else "development-only macro case/seed mean constant"
            ),
        },
        "components": {},
    }
    incumbent: dict[str, Any] | None = None
    if data["hasIncumbent"]:
        incumbent = json.loads(Path(args.incumbent_model).read_text())
        expected_incumbent = metadata["incumbent"]
        for key in (
            "schema",
            "generatorPolicyId",
            "featureTransformId",
            "targetSemanticsId",
            "trainingCorpus",
        ):
            if incumbent.get(key) != expected_incumbent.get(key):
                raise ValueError(
                    f"incumbent readiness artifact mismatch at {key}"
                )
        if incumbent.get("featureNames") != metadata["featureNames"]:
            raise ValueError("incumbent readiness feature names do not match")
    artifacts: dict[str, Any] = {}
    for name in requested:
        target = target_from_data(name, data)
        if target is None:
            report["components"][name] = {
                "decision": "neutral_no_authored_population"
            }
            continue
        component_report, artifact = fit_target(
            target, metadata, data, args.linear_only
        )
        report["components"][name] = component_report
        artifacts[name] = artifact

    validation = data["partition"] == "validation"
    validation_indices = np.flatnonzero(validation)
    if len(validation_indices) == 0:
        raise ValueError("readiness dataset has no decision-seed contexts")
    current_composite = np.ones(len(data["X"]), dtype=np.float64)
    alternative_composite = np.ones(len(data["X"]), dtype=np.float64)
    component_sources = {
        "catchability": ("currentCatchability", None),
        "impactFeasibility": ("currentImpactFeasibility", "authoredImpact"),
        "speedFit": ("currentSpeedFit", "authoredSpeed"),
        "airFit": ("currentAirFit", "authoredAir"),
        "elevationFit": ("currentElevationFit", "authoredElevation"),
    }
    for name, (current_name, authored_name) in component_sources.items():
        authored = (
            np.ones(len(data["X"]), dtype=bool)
            if authored_name is None
            else data[authored_name]
        )
        current_component = np.where(
            authored,
            data[current_name],
            1.0,
        )
        if name in artifacts:
            alternative_component = np.where(
                authored,
                predict_serialized(artifacts[name], data["X"]),
                1.0,
            )
        else:
            alternative_component = current_component
        current_composite *= current_component
        alternative_composite *= alternative_component
    composite_target = Target(
        name="compositeReadiness",
        probability=False,
        indices=validation_indices,
        y=data["utility"][validation].astype(np.float64),
        observations=np.ones(len(validation_indices), dtype=np.float64),
        successes=None,
        current=current_composite[validation],
    )
    validation_groups = data["caseSeed"][validation]
    validation_families = data["family"][validation]
    current_validation_composite = current_composite[validation]
    alternative_validation_composite = alternative_composite[validation]
    current_composite_score = primary_loss(
        composite_target,
        current_validation_composite,
        validation_groups,
    )
    alternative_composite_score = primary_loss(
        composite_target,
        alternative_validation_composite,
        validation_groups,
    )
    composite_improvement = (
        100.0
        * (current_composite_score - alternative_composite_score)
        / current_composite_score
    )
    composite_evidence = paired_evidence(
        composite_target,
        current_validation_composite,
        alternative_validation_composite,
        validation_groups,
        validation_families,
    )
    composite_adopt = (
        composite_improvement >= 1.0
        and composite_evidence["bootstrap95"][0] > 0
    )
    report["compositeValidation"] = {
        "current": model_summary(
            composite_target,
            current_validation_composite,
            validation_groups,
            validation_families,
        ),
        "alternative": model_summary(
            composite_target,
            alternative_validation_composite,
            validation_groups,
            validation_families,
        ),
        "improvementPct": composite_improvement,
        "pairedEvidence": composite_evidence,
        "scope":
            "decision seed only; the complete component suite was fixed by development OOF",
    }
    report["artifactDecision"] = {
        "decision": (
            "adopt_alternative"
            if composite_adopt
            else "retain_incumbent"
        ),
        "rule": (
            "the complete candidate must improve decision-seed MSE by at "
            "least 1% with a positive family-cluster bootstrap lower bound"
        ),
        "componentDecisionsAreSufficient": False,
    }

    if composite_adopt:
        model_artifact = {
            "schema": "line.readiness-model.v3",
            "trainingLibrary": f"scikit-learn {sklearn_version}",
            "generatorPolicyId": metadata["corpus"]["generatorPolicyId"],
            "featureTransformId": metadata["featureTransformId"],
            "targetSemanticsId": metadata["targetSemanticsId"],
            "trainingCorpus": {
                "schema": metadata["corpus"]["schema"],
                "samplerFingerprint": metadata["corpus"][
                    "samplerFingerprint"
                ],
                "contextSelectionArtifactFingerprint": metadata["corpus"][
                    "contextSelectionArtifactFingerprint"
                ],
            },
            "featureNames": metadata["featureNames"],
            "corpus": metadata["corpus"],
            "components": artifacts,
        }
    else:
        if incumbent is None:
            raise ValueError(
                "the candidate readiness product was rejected and no "
                "incumbent artifact is available"
            )
        model_artifact = copy.deepcopy(incumbent)
        artifacts = {}
        fixture_indices = np.unique(
            np.linspace(
                0,
                len(data["X"]) - 1,
                min(32, len(data["X"])),
                dtype=np.int64,
            )
        )
        for name, incumbent_component in model_artifact[
            "components"
        ].items():
            component = copy.deepcopy(incumbent_component)
            component["parity"] = {
                "tolerance": 1e-12,
                "pythonMaxAbsoluteError": 0.0,
                "features": data["X"][fixture_indices].tolist(),
                "expected": predict_serialized(
                    component,
                    data["X"][fixture_indices],
                ).tolist(),
            }
            artifacts[name] = component
        model_artifact["components"] = artifacts
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    model_output = Path(args.model_out)
    model_output.parent.mkdir(parents=True, exist_ok=True)
    model_output.write_text(json.dumps(model_artifact, indent=2) + "\n")
    if args.production_model_out is not None:
        production_output = Path(args.production_model_out)
        production_output.parent.mkdir(parents=True, exist_ok=True)
        production_output.write_text(
            json.dumps(
                {
                    "schema": model_artifact["schema"],
                    "generatorPolicyId": model_artifact[
                        "generatorPolicyId"
                    ],
                    "featureTransformId": model_artifact[
                        "featureTransformId"
                    ],
                    "targetSemanticsId": model_artifact[
                        "targetSemanticsId"
                    ],
                    "trainingCorpus": model_artifact["trainingCorpus"],
                    "featureNames": model_artifact["featureNames"],
                    "components": {
                        name: {
                            key: value
                            for key, value in component.items()
                            if key != "parity"
                        }
                        for name, component in model_artifact[
                            "components"
                        ].items()
                    },
                },
                separators=(",", ":"),
            )
            + "\n"
        )
        print(f"runtime: {production_output}")
    if args.parity_out is not None:
        parity_output = Path(args.parity_out)
        parity_output.parent.mkdir(parents=True, exist_ok=True)
        parity_output.write_text(
            json.dumps(
                {
                    "schema": "line.readiness-model-parity.v1",
                    "featureNames": model_artifact["featureNames"],
                    "components": {
                        name: component["parity"]
                        for name, component in model_artifact[
                            "components"
                        ].items()
                        if "parity" in component
                    },
                },
                separators=(",", ":"),
            )
            + "\n"
        )
        print(f"parity:  {parity_output}")
    print(f"\nreport: {output}")
    print(f"model:  {model_output}")


if __name__ == "__main__":
    main()
