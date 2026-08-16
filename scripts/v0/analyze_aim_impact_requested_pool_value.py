#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "ijson==3.4.0.post0",
#   "numpy==2.5.1",
#   "scikit-learn==1.7.2",
# ]
# ///
"""Assay searched-pool impact value with failed requests kept in the label.

This is the single semantic successor frozen after the conditional-pool live
arm.  It retains that arm's data, split, best-quartile statistic, and residual
capacity, but assigns zero value to every failed or unmeasured request before
computing the pool head.
"""

from __future__ import annotations

import argparse
import json
import math
from hashlib import sha256
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from analyze_aim_impact_pool_value import (
    AXIS_QUALITY_TOLERANCE,
    CORRECTION_TREES,
    MAX_MEAN_SELECTION_DEBT,
    MIN_ATTEMPTS,
    MIN_SOURCE_IMPROVEMENT_FRACTION,
    MIN_TOP1_AGREEMENT,
    TOP_FRACTION,
    impact_fit,
    source_mse_summary,
    streamed_contexts,
)
from analyze_aim_impact_ranking import (
    context_feature_indexes,
    proxy_groups,
    ranking_metrics,
    source_ranking_summary,
)
from distill_aim_impact_model import (
    grouped_metrics,
    load_dataset,
    metrics,
    predict_histogram,
    predict_histogram_raw,
    serialize_histogram,
)
from train_aim_impact_residual import combined_component


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--corpus",
        type=Path,
        default=Path("generated/analysis/readiness-corpus"),
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path("generated/analysis/readiness-training.jsonl.gz"),
    )
    parser.add_argument(
        "--incumbent",
        type=Path,
        default=Path("scripts/v0/optimizer/aim_impact_model.json"),
    )
    parser.add_argument(
        "--conditional-pool",
        type=Path,
        default=Path("scripts/v0/optimizer/aim_impact_pool_value_model.json"),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(
            "generated/analysis/aim-impact-requested-pool-value-study.json"
        ),
    )
    parser.add_argument(
        "--artifact-out",
        type=Path,
        default=Path(
            "generated/analysis/aim-impact-requested-pool-value-model.json"
        ),
    )
    return parser.parse_args()


def extract_labels(
    corpus_root: Path,
    expected_sources: np.ndarray,
    expected_seeds: np.ndarray,
    expected_mean: np.ndarray,
) -> tuple[
    np.ndarray,
    np.ndarray,
    np.ndarray,
    np.ndarray,
    np.ndarray,
    dict[str, int],
]:
    selected_indexes: list[int] = []
    requested_tail_labels: list[float] = []
    viable_tail_labels: list[float] = []
    success_rates: list[float] = []
    viable_contexts: list[bool] = []
    seen = 0
    zero_viable = 0
    for context in streamed_contexts(corpus_root):
        if seen >= len(expected_sources):
            raise ValueError("raw corpus has more impact contexts than the dataset")
        source = str(context["sourceId"])
        seed = int(context["seed"])
        if source != str(expected_sources[seen]) or seed != int(expected_seeds[seen]):
            raise ValueError(
                f"corpus/dataset order mismatch at row {seen}: "
                f"{source}/s{seed} != {expected_sources[seen]}/s{expected_seeds[seen]}"
            )
        target = float(context["incomingGap"]["scorerTargets"]["impact"])
        requested: list[float] = []
        viable_fits: list[float] = []
        for attempt in context["attempts"]:
            value = 0.0
            if attempt.get("viable") is True and attempt.get("impact") is not None:
                value = impact_fit(float(attempt["impact"]), target)
                viable_fits.append(value)
            requested.append(value)
        observed_mean = (
            float(np.mean(viable_fits)) if viable_fits else math.nan
        )
        expected = float(expected_mean[seen])
        if math.isfinite(expected) != math.isfinite(observed_mean) or (
            math.isfinite(expected) and abs(expected - observed_mean) > 1e-12
        ):
            raise ValueError(
                f"impact-fit reconstruction mismatch at {source}/s{seed}/row "
                f"{seen}: {observed_mean} != {expected}"
            )
        if len(requested) >= MIN_ATTEMPTS:
            requested.sort(reverse=True)
            requested_count = max(1, math.ceil(len(requested) * TOP_FRACTION))
            viable_fits.sort(reverse=True)
            viable_count = max(1, math.ceil(len(viable_fits) * TOP_FRACTION))
            has_viable = len(viable_fits) > 0
            selected_indexes.append(seen)
            requested_tail_labels.append(float(np.mean(requested[:requested_count])))
            viable_tail_labels.append(
                float(np.mean(viable_fits[:viable_count]))
                if has_viable
                else math.nan
            )
            success_rates.append(len(viable_fits) / len(requested))
            viable_contexts.append(has_viable)
            zero_viable += int(not has_viable)
        seen += 1
    if seen != len(expected_sources):
        raise ValueError(
            f"raw corpus has {seen} impact contexts, dataset has "
            f"{len(expected_sources)}"
        )
    return (
        np.asarray(selected_indexes, dtype=np.int64),
        np.asarray(requested_tail_labels, dtype=np.float64),
        np.asarray(viable_tail_labels, dtype=np.float64),
        np.asarray(success_rates, dtype=np.float64),
        np.asarray(viable_contexts, dtype=np.bool_),
        {
            "matchedImpactContexts": seen,
            "eligibleRequestedPoolContexts": len(selected_indexes),
            "eligibleZeroViableContexts": zero_viable,
        },
    )


def filtered_groups(
    groups: list[np.ndarray],
    eligible: np.ndarray,
) -> list[np.ndarray]:
    result: list[np.ndarray] = []
    for group in groups:
        kept = group[eligible[group]]
        if len(kept) >= 2:
            result.append(kept)
    return result


def main() -> None:
    args = arguments()
    metadata, all_x, development, mean_truth, sources, seeds = load_dataset(
        args.dataset
    )
    incumbent_artifact = json.loads(args.incumbent.read_text())
    conditional_artifact = json.loads(args.conditional_pool.read_text())
    feature_names = incumbent_artifact["featureNames"]
    if conditional_artifact["featureNames"] != feature_names:
        raise ValueError("conditional-pool feature order differs from incumbent")
    projection = [metadata["featureNames"].index(name) for name in feature_names]
    all_x = all_x[:, projection]
    (
        indexes,
        requested_truth,
        viable_tail_truth,
        success_rates,
        has_viable,
        counts,
    ) = extract_labels(args.corpus, sources, seeds, mean_truth)
    x = all_x[indexes]
    development = development[indexes]
    mean_truth = mean_truth[indexes]
    sources = sources[indexes]
    seeds = seeds[indexes]

    incumbent_component = incumbent_artifact["components"]["impactFeasibility"]
    conditional_component = conditional_artifact["components"]["impactFeasibility"]
    incumbent_raw = predict_histogram_raw(incumbent_component, x)
    incumbent_prediction = np.clip(incumbent_raw, 0.0, 1.0)
    conditional_prediction = predict_histogram(conditional_component, x)
    correction = HistGradientBoostingRegressor(
        learning_rate=0.08,
        max_iter=CORRECTION_TREES,
        max_leaf_nodes=15,
        min_samples_leaf=100,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=0,
    )
    correction.fit(
        x[development],
        requested_truth[development] - incumbent_raw[development],
    )
    correction_component = serialize_histogram(correction)
    candidate_component = combined_component(
        incumbent_component, correction_component
    )
    candidate_prediction = predict_histogram(candidate_component, x)

    validation = ~development
    validation_x = x[validation]
    validation_sources = sources[validation]
    validation_seeds = seeds[validation]
    validation_requested = requested_truth[validation]
    validation_viable_tail = viable_tail_truth[validation]
    validation_mean = mean_truth[validation]
    validation_has_viable = has_viable[validation]
    validation_success_rates = success_rates[validation]
    validation_incumbent = incumbent_prediction[validation]
    validation_conditional = conditional_prediction[validation]
    validation_candidate = candidate_prediction[validation]

    groups = proxy_groups(
        validation_x,
        validation_sources,
        validation_seeds,
        context_feature_indexes(feature_names),
    )
    viable_groups = filtered_groups(groups, validation_has_viable)
    requested_ranking = ranking_metrics(
        validation_requested,
        validation_incumbent,
        validation_candidate,
        groups,
    )
    viable_tail_ranking = ranking_metrics(
        validation_viable_tail,
        validation_incumbent,
        validation_candidate,
        viable_groups,
    )
    ordinary_mean_ranking = ranking_metrics(
        validation_mean,
        validation_incumbent,
        validation_candidate,
        viable_groups,
    )
    requested_source_ranking = source_ranking_summary(
        validation_requested,
        validation_incumbent,
        validation_candidate,
        groups,
        validation_sources,
    )
    viable_tail_source_ranking = source_ranking_summary(
        validation_viable_tail,
        validation_incumbent,
        validation_candidate,
        viable_groups,
        validation_sources,
    )
    ordinary_mean_source_ranking = source_ranking_summary(
        validation_mean,
        validation_incumbent,
        validation_candidate,
        viable_groups,
        validation_sources,
    )

    requested_absolute = {
        "incumbent": metrics(validation_requested, validation_incumbent),
        "conditionalPool": metrics(
            validation_requested, validation_conditional
        ),
        "candidate": metrics(validation_requested, validation_candidate),
    }
    requested_macro = {
        "incumbent": grouped_metrics(
            validation_requested, validation_incumbent, validation_sources
        ),
        "conditionalPool": grouped_metrics(
            validation_requested, validation_conditional, validation_sources
        ),
        "candidate": grouped_metrics(
            validation_requested, validation_candidate, validation_sources
        ),
    }
    source_requested = source_mse_summary(
        validation_requested,
        validation_incumbent,
        validation_candidate,
        validation_sources,
    )
    gate_checks = {
        "requestedMseBetterThanIncumbent": (
            requested_absolute["candidate"]["mse"]
            < requested_absolute["incumbent"]["mse"]
        ),
        "requestedMseBetterThanConditionalPool": (
            requested_absolute["candidate"]["mse"]
            < requested_absolute["conditionalPool"]["mse"]
        ),
        "requestedSourceMacroMseBetterThanIncumbent": (
            requested_macro["candidate"]["mse"]
            < requested_macro["incumbent"]["mse"]
        ),
        "requestedSourceMacroMseBetterThanConditionalPool": (
            requested_macro["candidate"]["mse"]
            < requested_macro["conditionalPool"]["mse"]
        ),
        "requestedPairwiseAccuracyImproved": (
            requested_ranking["candidatePairwiseTruthAccuracy"]
            > requested_ranking["incumbentPairwiseTruthAccuracy"]
        ),
        "requestedSelectedTop1Improved": (
            requested_ranking["candidateSelectedTop1TruthMean"]
            > requested_ranking["incumbentSelectedTop1TruthMean"]
        ),
        "requestedSelectedTop2Improved": (
            requested_ranking["candidateSelectedTop2TruthMean"]
            > requested_ranking["incumbentSelectedTop2TruthMean"]
        ),
        "viableTailSelectedTop1DebtBounded": (
            viable_tail_ranking["candidateSelectedTop1TruthMean"]
            >= viable_tail_ranking["incumbentSelectedTop1TruthMean"]
            - MAX_MEAN_SELECTION_DEBT
        ),
        "viableTailSelectedTop2DebtBounded": (
            viable_tail_ranking["candidateSelectedTop2TruthMean"]
            >= viable_tail_ranking["incumbentSelectedTop2TruthMean"]
            - MAX_MEAN_SELECTION_DEBT
        ),
        "ordinaryMeanSelectedTop1DebtBounded": (
            ordinary_mean_ranking["candidateSelectedTop1TruthMean"]
            >= ordinary_mean_ranking["incumbentSelectedTop1TruthMean"]
            - MAX_MEAN_SELECTION_DEBT
        ),
        "ordinaryMeanSelectedTop2DebtBounded": (
            ordinary_mean_ranking["candidateSelectedTop2TruthMean"]
            >= ordinary_mean_ranking["incumbentSelectedTop2TruthMean"]
            - MAX_MEAN_SELECTION_DEBT
        ),
        "incumbentTop1AgreementPreserved": (
            requested_ranking["top1AgreementWithIncumbent"]
            >= MIN_TOP1_AGREEMENT
        ),
        "sourceRequestedMseBreadth": (
            source_requested["improvedFraction"]
            >= MIN_SOURCE_IMPROVEMENT_FRACTION
        ),
    }
    gate_checks = {name: bool(value) for name, value in gate_checks.items()}
    licensed = all(gate_checks.values())
    requested_hybrid_sources = requested_source_ranking["hybridTop2Truth"]
    hybrid_gate_checks = {
        "requestedHybridTop2Improved": (
            requested_ranking["hybridTop2TruthDeltaFromIncumbent"] > 0
        ),
        "viableTailHybridTop2NoDebt": (
            viable_tail_ranking["hybridTop2TruthDeltaFromIncumbent"] >= 0
        ),
        "ordinaryMeanHybridTop2NoDebt": (
            ordinary_mean_ranking["hybridTop2TruthDeltaFromIncumbent"] >= 0
        ),
        "requestedHybridSourceMacroImproved": (
            requested_hybrid_sources["macroMeanDelta"] > 0
        ),
        "requestedHybridSourceBreadth": (
            requested_hybrid_sources["sourcesImproved"]
            >= requested_hybrid_sources["sourcesWorsened"]
        ),
        "hybridSecondSlotActive": (
            requested_ranking[
                "hybridIncumbentFirstCandidateSecondChangedFraction"
            ]
            >= 0.05
        ),
    }
    hybrid_gate_checks = {
        name: bool(value) for name, value in hybrid_gate_checks.items()
    }
    hybrid_licensed = all(hybrid_gate_checks.values())
    prefix = {
        **candidate_component,
        "trees": candidate_component["trees"][: len(incumbent_component["trees"])],
    }
    report: dict[str, Any] = {
        "schema": "line.aim-impact-requested-pool-value-study.v1",
        "hypothesis": (
            "searched-pool value must price failed requests rather than condition "
            "the useful head on viability"
        ),
        "contract": {
            "corpus": str(args.corpus),
            "dataset": str(args.dataset),
            "incumbent": str(args.incumbent),
            "conditionalPool": str(args.conditional_pool),
            "incumbentSha256": sha256(args.incumbent.read_bytes()).hexdigest(),
            "minimumAttempts": MIN_ATTEMPTS,
            "label": (
                "mean best quartile scorer-compatible authored-impact fit "
                "across every requested attempt; failed or unmeasured = 0"
            ),
            "topFraction": TOP_FRACTION,
            "correctionTrees": CORRECTION_TREES,
            "partition": "two development seeds, one untouched validation seed",
            "gate": {
                "maxConditionalSelectionDebt": MAX_MEAN_SELECTION_DEBT,
                "minimumIncumbentTop1Agreement": MIN_TOP1_AGREEMENT,
                "minimumSourceImprovementFraction": (
                    MIN_SOURCE_IMPROVEMENT_FRACTION
                ),
            },
        },
        "counts": {
            **counts,
            "development": int(np.count_nonzero(development)),
            "validation": int(np.count_nonzero(validation)),
            "validationSources": len(np.unique(validation_sources)),
            "validationProxyGroups": len(groups),
            "validationViableProxyGroups": len(viable_groups),
        },
        "labelDistribution": {
            "requestedTailMean": float(np.mean(requested_truth)),
            "viableTailMean": float(np.nanmean(viable_tail_truth)),
            "requestedMinusViableTailMean": float(
                np.mean(requested_truth[has_viable] - viable_tail_truth[has_viable])
            ),
            "successRateMean": float(np.mean(success_rates)),
            "successRateValidationMean": float(np.mean(validation_success_rates)),
            "zeroViableFraction": float(np.mean(~has_viable)),
        },
        "validation": {
            "requestedAbsolute": requested_absolute,
            "requestedSourceMacro": requested_macro,
            "sourceRequestedMse": source_requested,
            "requestedRankingProxy": requested_ranking,
            "viableTailRankingProxy": viable_tail_ranking,
            "ordinaryMeanRankingProxy": ordinary_mean_ranking,
            "requestedSourceRankingProxy": requested_source_ranking,
            "viableTailSourceRankingProxy": viable_tail_source_ranking,
            "ordinaryMeanSourceRankingProxy": ordinary_mean_source_ranking,
        },
        "parity": {
            "incumbentPrefixMaxAbsoluteError": float(
                np.max(
                    np.abs(
                        predict_histogram_raw(prefix, validation_x)
                        - incumbent_raw[validation]
                    )
                )
            ),
            "serializedCandidateMaxAbsoluteError": float(
                np.max(
                    np.abs(
                        validation_candidate
                        - np.clip(
                            incumbent_raw[validation]
                            + correction.predict(validation_x),
                            0.0,
                            1.0,
                        )
                    )
                )
            ),
        },
        "gateChecks": gate_checks,
        "licensedForLiveArm": licensed,
        "hybridGateChecks": hybrid_gate_checks,
        "licensedForHybridLiveArm": hybrid_licensed,
    }
    artifact = {
        **{
            key: value
            for key, value in incumbent_artifact.items()
            if key != "components"
        },
        "components": {"impactFeasibility": candidate_component},
        "aimImpactRequestedPoolValueTraining": {
            "schema": "line.aim-impact-requested-pool-value-training.v1",
            "incumbentSha256": report["contract"]["incumbentSha256"],
            "minimumAttempts": MIN_ATTEMPTS,
            "topFraction": TOP_FRACTION,
            "failedAttemptValue": 0,
            "correctionTrees": CORRECTION_TREES,
            "licensedForLiveArm": licensed,
            "licensedForHybridLiveArm": hybrid_licensed,
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    args.artifact_out.parent.mkdir(parents=True, exist_ok=True)
    args.artifact_out.write_text(json.dumps(artifact, separators=(",", ":")) + "\n")
    print(
        json.dumps(
            {
                "out": str(args.out),
                "artifact": str(args.artifact_out),
                "counts": report["counts"],
                "labelDistribution": report["labelDistribution"],
                "gateChecks": gate_checks,
                "licensedForLiveArm": licensed,
                "hybridGateChecks": hybrid_gate_checks,
                "licensedForHybridLiveArm": hybrid_licensed,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
