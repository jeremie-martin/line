# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Fit the placement model: a section's expected loss from its family and context (rows from family_model_data.ts).

  uv run --offline tools/research/family_model.py --rows=ROWS.jsonl --out=scripts/v0/optimizer/family_model.json

Features: family one-hot (arcs, fold, serpentine, scallops, terraces, scattered), guide forbidden, then the context:
strength ask, speed ask, next strength ask, next speed ask, calm, length in frames. Gradient-boosted trees on the
loss itself (placement adds them). Validation holds out whole rides' songs."""
import argparse, json, hashlib
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
FAMILIES = ['arcs', 'fold', 'serpentine', 'scallops', 'terraces', 'scattered']
p = argparse.ArgumentParser(); p.add_argument('--rows', required=True); p.add_argument('--out', required=True); args = p.parse_args()
rows = [json.loads(l) for l in Path(args.rows).read_text().splitlines() if l]
X = np.asarray([[1.0 if r['family'] == f else 0.0 for f in FAMILIES] + [r['open']] + r['f'] for r in rows])
y = np.asarray([r['loss'] for r in rows]); groups = np.asarray([r['ride'].split('~')[0] for r in rows])
model = lambda: HistGradientBoostingRegressor(max_iter=150, max_leaf_nodes=7, min_samples_leaf=800, learning_rate=.03, random_state=260914)
held = np.zeros(len(y))
for tr, te in GroupKFold(4).split(X, groups=groups): held[te] = model().fit(X[tr], y[tr]).predict(X[te])
r2 = 1 - ((y - held) ** 2).sum() / ((y - y.mean()) ** 2).sum()
fitted = model().fit(X, y)
trees = []
for it in fitted._predictors:
    n = it[0].nodes
    trees.append({'left': n['left'].astype(int).tolist(), 'right': n['right'].astype(int).tolist(), 'feature': n['feature_idx'].astype(int).tolist(),
                  'threshold': [round(float(t), 6) for t in n['num_threshold']], 'value': [round(float(v), 7) for v in n['value']], 'leaf': n['is_leaf'].astype(bool).tolist()})
artifact = {'schema': 'line.family-model.v1', 'families': FAMILIES, 'features': ['open', 'impact', 'speed', 'nextImpact', 'nextSpeed', 'quiet', 'frames'],
            'initial': float(fitted._baseline_prediction[0, 0]), 'trees': trees,
            'provenance': {'rows': len(rows), 'rowsSha256': hashlib.sha256(Path(args.rows).read_bytes()).hexdigest(), 'heldOutR2BySong': round(float(r2), 4),
                           'note': 'V7.1 rides of three compilers (before placement, first placement, refitted); V8 and held-out songs not used'}}
Path(args.out).write_text(json.dumps(artifact, separators=(',', ':')) + '\n')
print(json.dumps({'rows': len(rows), 'heldOutR2': round(float(r2), 4), 'trees': len(trees), 'bytes': Path(args.out).stat().st_size}))
