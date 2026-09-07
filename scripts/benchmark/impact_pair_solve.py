"""Same-horizon single-surface control and two-surface compensation assay.

Both arms minimize downstream full-state and second-impulse change. Compare
them at a common linearized first-impulse gain within the measured trust region.
No nonlinear fit, outcome-dependent dose, or score-based arm selection.
"""
import json
import sys
import numpy as np
from impact_release_solve import solve


def compare(data):
    g = np.asarray(data["gradient"], dtype=float)
    j = np.asarray(data["jacobian"], dtype=float)
    first = np.asarray(data["first"], dtype=bool)
    arms = {}
    for name, mask in [("first_surface", first), ("contact_pair", np.ones(len(g), dtype=bool))]:
        if not mask.any():
            arms[name] = {"reason": "no_stable_coordinates"}
            continue
        result = solve(g[mask], j[:, mask], data["request"], radius=0.001)
        arm = result["arms"]["release_constrained"]
        if "controls" not in arm:
            arms[name] = arm
            continue
        u = np.zeros(len(g))
        u[mask] = arm["controls"]
        arms[name] = {**arm, "controls": u.tolist(), "singularValues": result["singularValues"],
                      "rank": result["rank"], "condition": result["condition"]}
    solved = [a for a in arms.values() if "controls" in a]
    common = min((a["predictedImpulseGain"] for a in solved), default=0.0)
    for arm in solved:
        arm["capacityAtTrustRadius"] = arm["predictedImpulseGain"]
        u = np.asarray(arm["controls"]) * common / arm["predictedImpulseGain"]
        arm.update(controls=u.tolist(), predictedImpulseGain=float(g @ u),
                   predictedReleaseL2=float(np.linalg.norm(j[:-1] @ u)),
                   predictedSecondImpulseChange=float(j[-1] @ u),
                   predictedConstraintL2=float(np.linalg.norm(j @ u)),
                   controlL2=float(np.linalg.norm(u)), requestFraction=common / data["request"])
    return {"matched": len(solved) == 2, "commonImpulseGain": common, "arms": arms}


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        # A second surface can compensate release without changing first impact.
        result = compare({"gradient": [1, 0], "jacobian": [[1, -1], [0, 0]],
                          "first": [True, False], "request": 1})
        first, pair = result["arms"].values()
        assert result["matched"]
        assert abs(first["predictedImpulseGain"] - pair["predictedImpulseGain"]) < 1e-12
        assert pair["predictedReleaseL2"] < first["predictedReleaseL2"] * 1e-4
        assert max(abs(x) for x in pair["controls"]) <= 0.001 + 1e-12
        # Preserve the second impulse too: an inseparable compensation cost is
        # reported, rather than hidden in the downstream state norm.
        result = compare({"gradient": [1, 0], "jacobian": [[1, -1], [0, 1]],
                          "first": [True, False], "request": 1})
        pair = result["arms"]["contact_pair"]
        assert pair["predictedSecondImpulseChange"] > 0
        assert pair["predictedConstraintL2"] > 0
        assert pair["requestFraction"] < 1
        print("2 matched-pair compensation invariants passed")
    else:
        print(json.dumps(compare(json.load(sys.stdin)), allow_nan=False))
