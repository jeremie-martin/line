# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Learn proposal admission from the best complete physical paths.

When a winning energy repair follows a pulse, supervise admission of its base
pulse: the energy repair is generated only after that pulse is simulated.
"""
import argparse
import collections
import gzip
import json
from pathlib import Path
import time
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from train_physical_planner import checked, digest, export, write

FAMILIES = ["incumbent", "transport", "turn", "scale", "material", "program", "target_program",
            "self_reuse", "native_sample", "rail_layers", "contact_pulse", "contact_pulse_pair", "contact_pulse_collective", "tail_energy"]


def controls(action, speed):
    scale = max(1, speed)
    c = action.get("base", action) if action["family"] == "tail_energy" else action
    point = lambda name: -1 if c.get(name) == "TAIL" else 1 if c.get(name) == "NOSE" else 0
    return np.asarray([*[int(action["family"] == f) for f in FAMILIES], *[int(c["family"] == f) for f in FAMILIES],
        c.get("turn", 0), c.get("logScale", 0), c.get("length", 0) / scale,
        c.get("exitTurn", 0), c.get("exitAngle", 0), c.get("bend", 0), c.get("bendLength", 0) / scale,
        c.get("energy", action.get("direction", 0)), c.get("phase", 0) / 6, c.get("normalTurn", 0),
        c.get("depth", 0) / scale, c.get("ratio", 0), c.get("maxWidth", 0) / scale,
        c.get("layers", 0), c.get("spacing", 0) / scale, int(c.get("mode") == "similarity"),
        point("pointId"), point("secondPoint")], dtype=np.float32)


parser = argparse.ArgumentParser()
parser.add_argument("--inputs", required=True)
parser.add_argument("--validity-model", required=True)
parser.add_argument("--out", required=True)
args = parser.parse_args()
started = time.monotonic()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
if (out / "model.json").exists():
    raise ValueError("completed output exists")
checked(Path(args.validity_model))
validity_model = json.loads(Path(args.validity_model).read_text())
directories = [Path(p) for p in args.inputs.split(",")]
families = {}
checked(directories[0] / "summary.json")
for group in json.loads((directories[0] / "summary.json").read_text())["baseline"]["groups"]:
    for parent in group["parents"]:
        for source in parent["members"]:
            families[source] = parent["id"]
import hashlib
held = {f for f in families.values() if int(hashlib.sha256(f.encode()).hexdigest()[:8], 16) % 4 == 0}
blocks, labels, validation, bundles, provenance = [], [], [], [], []
action_counts = collections.Counter()
contexts = folded = 0
for directory in directories:
    checked(directory / "plan.json")
    plan = json.loads((directory / "plan.json").read_text())
    for source in plan["sources"]:
        source_id = source["sourceId"]
        result_path = directory / (source_id + ".json")
        checked(result_path)
        result = json.loads(result_path.read_text())
        if not result["actions"]:
            continue
        search_path = directory / (source_id + ".search.json")
        checked(search_path)
        search = json.loads(search_path.read_text())
        valid = [c for c in search["completions"] if c["score"]["valid"]]
        terminal = max(valid, key=lambda c: c["score"]["score"])
        assert terminal["score"] == result["score"]
        nodes = {}
        for step in search["steps"]:
            retained = set(step["retained"])
            nodes.update({t["id"]: t for t in step["trials"] if t["id"] in retained})
        wanted, at = {}, terminal["id"]
        while at in nodes:
            node = nodes[at]
            action = node["action"]
            if action["family"] == "tail_energy":
                action = action["base"]
                folded += 1
            if action["family"] not in ["incumbent", "transport"]:
                wanted[node["parent"]] = action
            at = node["parent"]
        del search, nodes
        corpus = directory / (source_id + ".training.jsonl.gz")
        provenance.append(dict(path=str(corpus), sha256=checked(corpus), resultSha256=checked(result_path), searchSha256=checked(search_path)))
        matched = 0
        with gzip.open(corpus, "rt") as stream:
            for line in stream:
                header = json.loads(line[:line.index(',"context":')] + "}")
                if header["parent"] not in wanted:
                    continue
                b = json.loads(line)
                action = wanted[b["parent"]]
                key = controls(action, b["context"][0] * 10)
                # Neither reserved paths nor deferred energy children compete
                # in the model's first-stage proposal ranking.
                rows = [r for r in b["candidates"] if not (r["features"][22] or r["features"][23] or r["features"][35])]
                y = np.asarray([np.array_equal(np.asarray(r["features"][22:], dtype=np.float32), key) for r in rows])
                if y.sum() != 1:
                    raise ValueError(f"ambiguous or missing teacher proposal: {source_id}/{b['parent']} {action} matches={y.sum()}")
                X = np.asarray([b["context"] + r["features"] for r in rows], dtype=np.float32)
                assert X.shape[1] == validity_model["features"] and np.isfinite(X).all()
                blocks.append(X)
                labels.extend(y.tolist())
                check = families[source_id] in held
                validation.extend([check] * len(y))
                if check:
                    bundles.append(dict(X=X, y=y, family=action["family"]))
                action_counts[action["family"]] += 1
                contexts += 1
                matched += 1
        assert matched == len(wanted)
        print(f"read {directory.name}/{source_id}: {matched} teacher decisions", flush=True)
X, y, check = np.concatenate(blocks), np.asarray(labels), np.asarray(validation)
del blocks, labels, validation
options = dict(max_iter=250, max_leaf_nodes=31, min_samples_leaf=20, learning_rate=0.08,
               l2_regularization=1, early_stopping=False, random_state=260907, class_weight="balanced")
model = HistGradientBoostingClassifier(**options).fit(X[~check], y[~check])
readings = []
for keep in [4, 8, 16, 32]:
    counts = collections.Counter()
    totals = collections.Counter()
    for b in bundles:
        ranks = np.argsort(-model.decision_function(b["X"]), kind="stable")[:keep]
        totals[b["family"]] += 1
        counts[b["family"]] += bool(b["y"][ranks].any())
    readings.append(dict(keep=keep, contexts=sum(totals.values()), recall=sum(counts.values()) / sum(totals.values()),
                         families={f: dict(contexts=totals[f], recall=counts[f] / totals[f]) for f in totals}))
print(json.dumps(readings), flush=True)
final = HistGradientBoostingClassifier(**options).fit(X, y)
loss = export(final, "identity")
loss["initial"] *= -1
for tree in loss["trees"]:
    tree["value"] = [-v for v in tree["value"]]
artifact = dict(schema="line.physical-planner-model.v1", featureVersion=1, inputDtype="float32", features=X.shape[1],
                penalty=0, objective="complete-path proposal imitation with deferred-child credit", validity=validity_model["validity"], loss=loss)
write(out / "model.json", artifact)
indices = np.linspace(0, len(X) - 1, 64, dtype=int)
write(out / "parity.json", dict(rows=[dict(features=x.tolist(), loss=float(v)) for x, v in zip(X[indices], -final.decision_function(X[indices]))]))
report = dict(schema="line.planner-imitation-training.v1", implementation=digest(Path(__file__)), inputs=provenance,
              contexts=contexts, rows=len(X), foldedEnergyActions=folded, teacherFamilies=dict(action_counts), heldFamilies=sorted(held),
              readings=readings, elapsedSeconds=time.monotonic() - started, researchOnly=True,
              note="Internal discovery-family selection; independent campaign validation remains untouched.")
write(out / "report.json", report)
print(json.dumps({k: report[k] for k in ["contexts", "rows", "foldedEnergyActions", "teacherFamilies", "elapsedSeconds"]}), flush=True)
