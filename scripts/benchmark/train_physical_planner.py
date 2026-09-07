# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Distill exact candidate observations; no model prediction is a physics judge."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import time

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.metrics import roc_auc_score, mean_absolute_error


def digest(path):
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def checked(path):
    expected = Path(str(path) + ".sha256").read_text().split()[0]
    if digest(path) != expected:
        raise ValueError(f"checksum mismatch: {path}")
    return expected


def write(path, data):
    body = json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n"
    path.write_text(body)
    Path(str(path) + ".sha256").write_text(hashlib.sha256(body.encode()).hexdigest() + "  " + path.name + "\n")


def export(model, link):
    trees = []
    for iteration in model._predictors:
        assert len(iteration) == 1
        nodes = iteration[0].nodes
        assert not np.any(nodes["is_categorical"])
        trees.append({
            "left": nodes["left"].astype(int).tolist(), "right": nodes["right"].astype(int).tolist(),
            "feature": nodes["feature_idx"].astype(int).tolist(), "threshold": nodes["num_threshold"].tolist(),
            "value": nodes["value"].tolist(), "leaf": nodes["is_leaf"].astype(bool).tolist(),
        })
    return {"link": link, "initial": float(model._baseline_prediction[0, 0]), "trees": trees}


def models(iterations=80, leaves=15):
    options = dict(max_iter=iterations, max_leaf_nodes=leaves, min_samples_leaf=30, learning_rate=0.08,
                   l2_regularization=1, early_stopping=False, random_state=260907)
    return HistGradientBoostingClassifier(**options), HistGradientBoostingRegressor(**options)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", default="")
    parser.add_argument("--cache")
    parser.add_argument("--centered", action="store_true")
    parser.add_argument("--iterations", type=int, default=80)
    parser.add_argument("--leaves", type=int, default=15)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    started = time.monotonic()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if (out / "model.json").exists():
        raise ValueError("completed model exists; use a new output directory")
    cache = Path(args.cache) if args.cache else None
    if cache and (cache / "metadata.json").exists():
        checked(cache / "metadata.json")
        metadata = json.loads((cache / "metadata.json").read_text())
        arrays = {}
        for key in metadata["arrays"]:
            checked(cache / (key + ".npy"))
            arrays[key] = np.load(cache / (key + ".npy"), allow_pickle=False)
        X, y, loss, offset, uniform, validation = [arrays[k] for k in ["X", "y", "loss", "offset", "uniform", "validation"]]
        provenance, held = metadata["provenance"], metadata["held"]
        contexts, population = metadata["contexts"], metadata["population"]
        held_bundles = []
        for b in metadata["bundles"]:
            start, end = b["start"], b["end"]
            held_bundles.append({"source": b["source"], "offset": b["offset"],
                **{k: arrays["held_" + k][start:end] for k in ["X", "valid", "loss", "reserved"]}})
        print(f"loaded verified cache: {len(X)} rows", flush=True)
    else:
        inputs = [Path(p) for p in args.inputs.split(",")]
        reference = json.loads((inputs[0] / "summary.json").read_text())
        families = {}
        for group in reference["baseline"]["groups"]:
            for parent in group["parents"]:
                for source in parent["members"]:
                    families[source] = parent["id"]
        held = {f for f in families.values() if int(hashlib.sha256(f.encode()).hexdigest()[:8], 16) % 4 == 0}
        if not held or len(held) == len(set(families.values())):
            raise ValueError("empty family split")
        rng = np.random.default_rng(260907)
        blocks, validity, losses, offsets, uniform_flags, validation_flags = [], [], [], [], [], []
        held_bundles, provenance = [], []
        contexts = population = 0
        for directory in inputs:
            checked(directory / "plan.json")
            checked(directory / "summary.json")
            plan = json.loads((directory / "plan.json").read_text())
            if not plan["collect"] or len(plan["sources"]) != 44:
                raise ValueError("requires completed 44-source collection")
            for source in plan["sources"]:
                source_id = source["sourceId"]
                checked(directory / (source_id + ".json"))
                path = directory / (source_id + ".training.jsonl.gz")
                provenance.append({"path": str(path), "sha256": checked(path)})
                validation = families[source_id] in held
                source_contexts = 0
                with gzip.open(path, "rt") as stream:
                    for line in stream:
                        bundle = json.loads(line)
                        assert bundle["featureVersion"] == 1 and bundle["sourceId"] == source_id
                        rows = bundle["candidates"]
                        if not rows:
                            continue
                        contexts += 1
                        source_contexts += 1
                        population += len(rows)
                        uniform = rng.choice(len(rows), min(24, len(rows)), replace=False)
                        valid_losses = [r["loss"] for r in rows if r["valid"] and r["loss"] is not None]
                        offset = float(np.mean(valid_losses)) if valid_losses else 0
                        best = sorted((i for i, row in enumerate(rows) if row["valid"] and row["loss"] is not None),
                                      key=lambda i: rows[i]["loss"])[:8]
                        selected = sorted(set(uniform.tolist()) | set(best))
                        X = np.asarray([bundle["context"] + rows[i]["features"] for i in selected], dtype=np.float32)
                        if not np.isfinite(X).all():
                            raise ValueError("nonfinite candidate features")
                        blocks.append(X)
                        validity.extend(int(rows[i]["valid"]) for i in selected)
                        losses.extend(rows[i]["loss"] if rows[i]["loss"] is not None else np.nan for i in selected)
                        offsets.extend([offset] * len(selected))
                        uniform_set = set(uniform.tolist())
                        uniform_flags.extend(i in uniform_set for i in selected)
                        validation_flags.extend([validation] * len(selected))
                        if validation and source_contexts % 16 == 0 and len(held_bundles) < 2500:
                            held_bundles.append({"source": source_id,
                                "X": np.asarray([bundle["context"] + r["features"] for r in rows], dtype=np.float32),
                                "valid": np.asarray([r["valid"] for r in rows]),
                                "loss": np.asarray([r["loss"] if r["loss"] is not None else np.inf for r in rows]),
                                "offset": offset,
                                "reserved": np.asarray([bool(r["features"][22] or r["features"][23]) for r in rows])})
                print(f"read {directory.name}/{source_id}: {source_contexts} contexts", flush=True)
        X = np.concatenate(blocks)
        del blocks
        y = np.asarray(validity, dtype=np.int8)
        loss = np.asarray(losses, dtype=np.float64)
        offset = np.asarray(offsets, dtype=np.float64)
        uniform = np.asarray(uniform_flags, dtype=bool)
        validation = np.asarray(validation_flags, dtype=bool)
        del validity, losses, offsets, uniform_flags, validation_flags
        if cache:
            cache.mkdir(parents=True, exist_ok=True)
            arrays = dict(X=X, y=y, loss=loss, offset=offset, uniform=uniform, validation=validation)
            bundles, start = [], 0
            for b in held_bundles:
                end = start + len(b["X"])
                bundles.append(dict(source=b["source"], offset=b["offset"], start=start, end=end))
                start = end
            for k in ["X", "valid", "loss", "reserved"]:
                arrays["held_" + k] = np.concatenate([b[k] for b in held_bundles])
            for k, array in arrays.items():
                path = cache / (k + ".npy")
                np.save(path, array, allow_pickle=False)
                Path(str(path) + ".sha256").write_text(digest(path) + "  " + path.name + "\n")
            write(cache / "metadata.json", dict(schema="line.physical-planner-training-cache.v1",
                implementation=digest(Path(__file__)), arrays=list(arrays), bundles=bundles,
                provenance=provenance, held=sorted(held), contexts=contexts, population=population))
            del arrays
    target = loss - offset if args.centered else loss
    clf, reg = models(args.iterations, args.leaves)
    train_valid = ~validation & uniform
    train_loss = ~validation & np.isfinite(loss)
    clf.fit(X[train_valid], y[train_valid])
    reg.fit(X[train_loss], target[train_loss])
    check_valid, check_loss = validation & uniform, validation & np.isfinite(loss)
    auc = roc_auc_score(y[check_valid], clf.predict_proba(X[check_valid])[:, 1])
    mae = mean_absolute_error(target[check_loss], reg.predict(X[check_loss]))
    for bundle in held_bundles:
        bundle["p"] = clf.predict_proba(bundle["X"])[:, 1]
        bundle["predicted_loss"] = reg.predict(bundle["X"])
    readings = []
    for penalty in [0, 0.01, 0.03, 0.1, 0.3, 1]:
        for keep in [4, 8, 16, 32]:
            regret, failed, count, chosen_count = 0.0, 0, 0, 0
            for b in held_bundles:
                if not b["valid"].any():
                    continue
                rank = np.argsort(b["predicted_loss"] + penalty * (1 - b["p"]), kind="stable")
                chosen = set(np.flatnonzero(b["reserved"]).tolist()) | set(rank[:keep].tolist())
                candidates = [b["loss"][i] for i in chosen if b["valid"][i]]
                oracle = b["loss"][b["valid"]].min()
                regret += (min(candidates) if candidates else 1) - oracle
                failed += not candidates
                chosen_count += len(chosen)
                count += 1
            readings.append({"penalty": penalty, "keep": keep, "contexts": count,
                             "regret": regret / count, "noValidFraction": failed / count,
                             "meanProposals": chosen_count / count})
    selected = min((r for r in readings if r["keep"] == 16), key=lambda r: (r["regret"], r["penalty"]))
    print(json.dumps({"heldFamilies": sorted(held), "auc": auc, "mae": mae, "selected": selected}), flush=True)
    final_clf, final_reg = models(args.iterations, args.leaves)
    final_clf.fit(X[uniform], y[uniform])
    final_reg.fit(X[np.isfinite(loss)], target[np.isfinite(loss)])
    artifact = {"schema": "line.physical-planner-model.v1", "featureVersion": 1, "inputDtype": "float32",
                "features": X.shape[1], "penalty": selected["penalty"], "centered": args.centered,
                "validity": export(final_clf, "sigmoid"), "loss": export(final_reg, "identity")}
    write(out / "model.json", artifact)
    indices = np.linspace(0, len(X) - 1, 64, dtype=int)
    parity = {"schema": "line.physical-planner-model-parity.v1", "rows": [
        {"features": x.tolist(), "validity": float(p), "loss": float(v)}
        for x, p, v in zip(X[indices], final_clf.predict_proba(X[indices])[:, 1], final_reg.predict(X[indices]))]}
    write(out / "parity.json", parity)
    report = {"schema": "line.physical-planner-training.v1", "implementation": digest(Path(__file__)),
              "inputs": provenance, "contexts": contexts, "population": population, "sampledRows": len(X),
              "features": X.shape[1], "heldFamilies": sorted(held), "auc": auc, "mae": mae,
              "centered": args.centered, "iterations": args.iterations, "leaves": args.leaves,
              "readings": readings, "selected": selected, "elapsedSeconds": time.monotonic() - started,
              "researchOnly": True, "note": "Family holdout is internal model selection, not independent campaign validation."}
    write(out / "report.json", report)
    print(json.dumps({k: report[k] for k in ["contexts", "population", "sampledRows", "features", "elapsedSeconds"]}), flush=True)


if __name__ == "__main__":
    main()
