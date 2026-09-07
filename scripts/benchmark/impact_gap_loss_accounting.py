"""Exact report-only allocation of interrupted-support continuation loss."""
import hashlib
import json
import math
import statistics
from pathlib import Path

BASE = Path("generated/benchmark-v2/impact-delivery-650-new")
OUT = BASE / "interrupted-support-metadata-replay"
WEIGHTS = {"air": .3, "speed": .3, "impact": .3, "amplitude": .1}


def read(path):
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == Path(str(path) + ".sha256").read_text().split()[0], path
    return json.loads(data)


def errors(report):
    return {(gap["gap_index"], axis): value["error"] ** 2
            for gap in report["gaps"] for axis, value in gap["axes"].items() if axis in WEIGHTS}


def write(path, value):
    data = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
    path.write_bytes(data)
    Path(str(path) + ".sha256").write_text(hashlib.sha256(data).hexdigest() + "  " + path.name + "\n")


summary = read(OUT / "summary.json")
rows = []
for path in sorted(OUT.glob("*-g*.json")):
    if path.name.endswith((".track.json", ".report.json")):
        continue
    state = read(path)
    source, index = state["sourceId"], state["gapIndex"]
    reports = {
        "incumbent": read(BASE / "interrupted-support-capture" / f"{source}.report.json"),
        "control": read(OUT / f"{source}-g{index}-neutral.report.json"),
        "candidate": read(OUT / f"{source}-g{index}-corrected-candidate.report.json"),
    }
    measured = {name: errors(report) for name, report in reports.items()}
    counts = {axis: sum(key[1] == axis for key in measured["incumbent"]) for axis in WEIGHTS}
    total_weight = sum(weight for axis, weight in WEIGHTS.items() if counts[axis])
    weight = {key: WEIGHTS[key[1]] / total_weight / counts[key[1]] for key in measured["incumbent"]}

    def mse(values):
        return sum(weight[key] * values[key] for key in weight)

    def score(values):
        return 1000 * math.exp(-math.sqrt(mse(values)) / .25)

    complete_measurements = all(values.keys() == weight.keys() for values in measured.values())
    row = {"sourceId": source, "gapIndex": index, "valid": state["candidate"]["valid"],
           "localUseful": state["localRawGain"] >= state["requestedRawGain"],
           "completeMeasurements": complete_measurements, "pairedDelta": state["pairedDelta"],
           "incumbentDelta": state["incumbentDelta"]}
    if complete_measurements:
        if row["valid"]:
            assert abs(score(measured["candidate"]) - state["candidate"]["score"]) <= .000051
        if state["neutralControl"]["valid"]:
            assert abs(score(measured["control"]) - state["neutralControl"]["score"]) <= .000051
        current_only = {key: measured["candidate"][key] if key[0] == index else value
                        for key, value in measured["incumbent"].items()}
        row["currentOnlyScoreGain"] = score(current_only) - score(measured["incumbent"])
        row["controlVsIncumbentScore"] = score(measured["control"]) - score(measured["incumbent"])
        row["mseDeltaByReference"] = {}
        for reference in ("control", "incumbent"):
            allocation = {region: {axis: 0.0 for axis in WEIGHTS}
                          for region in ("earlier", "current", "next", "following_two", "later")}
            for key, scale in weight.items():
                gap, axis = key
                region = ("earlier" if gap < index else "current" if gap == index else "next" if gap == index + 1
                          else "following_two" if gap <= index + 3 else "later")
                allocation[region][axis] += scale * (measured["candidate"][key] - measured[reference][key])
            difference = mse(measured["candidate"]) - mse(measured[reference])
            assert abs(sum(sum(values.values()) for values in allocation.values()) - difference) < 1e-14
            row["mseDeltaByReference"][reference] = allocation
    rows.append(row)

available = [r for r in rows if r["valid"] and r["completeMeasurements"]]
output = {"schema": "line.interrupted-support-loss-accounting.v1",
          "implementationSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          "metadataRequestSha256": summary["requestSha256"], "rows": rows,
          "validCompleteRows": len(available),
          "medianCurrentOnlyGain": statistics.median(r["currentOnlyScoreGain"] for r in available),
          "medianControlVsIncumbent": statistics.median(r["controlVsIncumbentScore"] for r in available),
          "usefulLocalRows": [r for r in rows if r["localUseful"]]}
write(OUT / "loss-accounting.json", output)
print(json.dumps({key: value for key, value in output.items() if key != "rows"}, indent=2))
