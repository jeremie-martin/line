"""Constrained local Newton correction with the existing release ridge.

Minimize ||J step + residual||^2 + 1e-6 ||step||^2, subject to
gradient @ step == impact_correction. No nonlinear outcome selection here.
"""
import json
import sys
import numpy as np


def correction(data):
    g = np.asarray(data["gradient"], dtype=float)
    j = np.asarray(data["jacobian"], dtype=float)
    r = np.asarray(data["residual"], dtype=float)
    target = float(data["impact_correction"])
    if g.ndim != 1 or j.shape != (len(r), len(g)) or not len(g):
        raise ValueError("incompatible correction dimensions")
    if not all(np.isfinite(v).all() for v in [g, j, r, target]):
        raise ValueError("nonfinite correction input")
    _, singular, vt = np.linalg.svd(j, full_matrices=True)
    eigenvalues = np.zeros(len(g))
    eigenvalues[:len(singular)] = singular ** 2

    def inverse(v):
        return vt.T @ ((vt @ v) / (eigenvalues + 1e-6))

    free = -inverse(j.T @ r)
    direction = inverse(g)
    denominator = float(g @ direction)
    if denominator <= 1e-14:
        return {"reason": "no_impact_derivative"}
    step = free + direction * ((target - g @ free) / denominator)
    after = r + j @ step
    return {"step": step.tolist(), "predictedConstraintL2": float(np.linalg.norm(after)),
            "predictedImpactCorrection": float(g @ step),
            "maximumStep": float(np.max(np.abs(step))), "singularValues": singular.tolist()}


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        # Remove downstream error while leaving an independent impact fixed.
        result = correction({"gradient": [1, 0], "jacobian": [[1, -1]],
                             "residual": [0.1], "impact_correction": 0})
        assert abs(result["step"][0]) < 1e-10
        assert result["predictedConstraintL2"] < 1e-6
        # Simultaneous impact correction and downstream compensation.
        result = correction({"gradient": [1, 0], "jacobian": [[1, -1]],
                             "residual": [0.1], "impact_correction": 0.05})
        assert abs(result["predictedImpactCorrection"] - 0.05) < 1e-10
        assert result["predictedConstraintL2"] < 1e-6
        # Report the unavoidable residual of a fully coupled physical system.
        result = correction({"gradient": [1], "jacobian": [[1]],
                             "residual": [0.1], "impact_correction": 0})
        assert abs(result["predictedConstraintL2"] - 0.1) < 1e-12
        print("3 impact-preserving correction invariants passed")
    else:
        print(json.dumps(correction(json.load(sys.stdin)), allow_nan=False))
