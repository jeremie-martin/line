"""Two fixed minimum-norm local responses; no fitted parameters or outcome selection.

Input: impact gradient and release-state Jacobian in frame-displacement units.
The constrained arm minimizes release change plus a 1e-6 control ridge while
meeting the same linearized impulse request as the unconstrained control.
"""
import json
import sys
import numpy as np


def solve(gradient, jacobian, request, radius=0.1):
    g = np.asarray(gradient, dtype=float)
    j = np.asarray(jacobian, dtype=float)
    if g.ndim != 1 or j.ndim != 2 or j.shape[1] != len(g):
        raise ValueError("incompatible response dimensions")
    if not np.isfinite(g).all() or not np.isfinite(j).all() or not np.isfinite(request):
        raise ValueError("non-finite response")
    if radius <= 0 or request < 0:
        raise ValueError("invalid physical request")
    if len(g) == 0:
        return {"reason": "no_stable_coordinates", "arms": {}}
    _, singular, vt = np.linalg.svd(j, full_matrices=True)
    values = np.zeros(len(g))
    values[:len(singular)] = singular ** 2
    conditioned = vt.T @ ((vt @ g) / (values + 1e-6))
    arms = {}
    for name, direction in [("impulse_only", g), ("release_constrained", conditioned)]:
        gain = float(g @ direction)
        if gain <= 1e-14:
            arms[name] = {"reason": "no_impulse_derivative"}
            continue
        u = direction * (request / gain)
        scale = min(1.0, radius / max(np.max(np.abs(u)), 1e-15))
        u *= scale
        arms[name] = {"controls": u.tolist(), "requestFraction": scale,
                      "predictedImpulseGain": float(g @ u),
                      "predictedReleaseL2": float(np.linalg.norm(j @ u)),
                      "controlL2": float(np.linalg.norm(u))}
    return {"singularValues": singular.tolist(), "rank": int(np.linalg.matrix_rank(j)),
            "condition": float(singular[0] / singular[-1]) if len(singular) and singular[-1] > 0 else None,
            "arms": arms}


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        # A true release-null direction must meet the request without spending
        # release motion. This distinguishes conditioning from gradient descent.
        result = solve([1, 1], [[1, 0]], 0.05)
        free = result["arms"]["impulse_only"]
        constrained = result["arms"]["release_constrained"]
        assert abs(constrained["predictedImpulseGain"] - 0.05) < 1e-12
        assert constrained["predictedReleaseL2"] < free["predictedReleaseL2"] * 1e-4
        # If impact and continuation are the same physical direction, no
        # conditioning can promise a free impulse.
        result = solve([2], [[1]], 0.05)
        assert abs(result["arms"]["release_constrained"]["predictedReleaseL2"] - 0.025) < 1e-12
        # A large request respects the geometric trust region, rather than
        # claiming the full request was attained after clamping.
        result = solve([1, 1], [[1, 0]], 10)
        arm = result["arms"]["release_constrained"]
        assert max(abs(x) for x in arm["controls"]) <= 0.1 + 1e-12
        assert arm["requestFraction"] < 1
        assert arm["predictedImpulseGain"] < 10
        print("3 constrained-response invariants passed")
    else:
        data = json.load(sys.stdin)
        print(json.dumps(solve(data["gradient"], data["jacobian"], data["request"]), allow_nan=False))
