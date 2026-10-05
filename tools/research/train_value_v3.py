# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""exp/retrain-v3: retrain the arc future-value model on probes collected from
the line.strike.v3 production compiler (tools/research/value_collect.ts).

  uv run --offline tools/research/train_value_v3.py --inputs=generated/value-v3/collect-1 --out=generated/value-v3/model-1

Target: log1p(100 * future search cost) of a planning probe, where the future
cost is the continuation's simulated local costs plus the heuristic arrival
prior at its leaf (`pureFuture`: the old learned model's prediction is NOT in
the label). Same feature schema, horizon filter, invalid-continuation penalty
and gradient-boosting hyperparameters as the archived trainer
(archive/pre-rework-2026-10-03:scripts/benchmark/train_arc_value_correction.py),
but a single model trained from scratch, not a correction of the old prior.
Validation holds out complete catalog groups (GroupKFold over groups)."""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold

p = argparse.ArgumentParser(); p.add_argument('--inputs', required=True); p.add_argument('--out', required=True)
args = p.parse_args()
out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
EVAL_SONGS = ('luna', 'amor', 'tiki', 'amour')

def export(model, link):
    trees = []
    for iteration in model._predictors:
        nodes = iteration[0].nodes
        assert not np.any(nodes['is_categorical'])
        trees.append({'left': nodes['left'].astype(int).tolist(), 'right': nodes['right'].astype(int).tolist(),
            'feature': nodes['feature_idx'].astype(int).tolist(), 'threshold': nodes['num_threshold'].tolist(),
            'value': nodes['value'].tolist(), 'leaf': nodes['is_leaf'].astype(bool).tolist()})
    return {'link': link, 'initial': float(model._baseline_prediction[0, 0]), 'trees': trees}

rows, records, omitted, failed_compiles = [], [], 0, []
for root in args.inputs.split(','):
    for path in sorted(Path(root).glob('*.json.gz')):
        b = path.read_bytes(); d = json.loads(gzip.decompress(b))
        assert not any(s in d['id'].lower() for s in EVAL_SONGS), 'evaluation song in training data'
        records.append({'file': path.name, 'id': d['id'], 'group': d['group'], 'seed': d['seed'], 'budget': d['budget'],
            'complete': d['complete'], 'probes': len(d['probes']), 'trackSha256': d['trackHash'], 'sha256': hashlib.sha256(b).hexdigest()})
        context, last = -1, None
        for probe in d['probes']:
            if probe['index'] != last: context += 1; last = probe['index']
            f = probe['features']
            assert len(f) == 57 and np.isfinite(f).all()
            # A budget-shortened horizon is a different target; keep full two-interval or terminal labels.
            if probe['pureFuture'] is not None and probe['depth'] < 2 and f[52] > 0: omitted += 1; continue
            rows.append({'group': d['group'], 'context': f"{path.name}:{context}", 'features': f, 'future': probe['pureFuture'],
                'local': probe['localCost'], 'old': probe['predictedFuture']})
X = np.asarray([r['features'] for r in rows]); groups = np.asarray([r['group'] for r in rows]); old = np.asarray([r['old'] for r in rows])
finite = np.asarray([r['future'] for r in rows if r['future'] is not None])
def costs(indices, penalty): return np.asarray([max(0, rows[i]['future']) if rows[i]['future'] is not None else penalty for i in indices])
def model(): return HistGradientBoostingRegressor(max_iter=180, max_leaf_nodes=31, min_samples_leaf=40, learning_rate=.06,
    l2_regularization=1, early_stopping=False, random_state=260910)
print(json.dumps({'rows': len(rows), 'invalid': int(sum(r['future'] is None for r in rows)), 'omitted': omitted, 'files': len(records),
    'groups': sorted(set(groups.tolist()))}), flush=True)
held = np.zeros(len(rows)); truth = np.zeros(len(rows)); folds = []
for fold, (train, test) in enumerate(GroupKFold(5).split(X, groups=groups)):
    tf = [rows[i]['future'] for i in train if rows[i]['future'] is not None]; penalty = max(1, float(np.quantile(tf, .99)) * 2)
    fitted = model().fit(X[train], np.log1p(100 * costs(train, penalty)))
    held[test] = np.maximum(0, np.expm1(fitted.predict(X[test])) / 100); truth[test] = costs(test, penalty)
    folds.append({'fold': fold, 'heldGroups': sorted(set(groups[test].tolist())), 'train': len(train), 'test': len(test)}); print(json.dumps(folds[-1]), flush=True)
contexts = {}
for i, r in enumerate(rows): contexts.setdefault(r['context'], []).append(i)
local = np.asarray([r['local'] for r in rows])
def ranking(estimate):
    regrets, hits = [], 0
    for idx in contexts.values():
        t = local[idx] + truth[idx]
        if len(idx) < 2 or np.ptp(t) < 1e-8: continue
        s = int(np.argmin(local[idx] + estimate[idx])); regrets.append(float(t[s] - t.min())); hits += int(t[s] == t.min())
    return {'contexts': len(regrets), 'meanRegret': float(np.mean(regrets)), 'bestChosen': hits / len(regrets)}
def spearman(a, b):
    ra, rb = np.argsort(np.argsort(a)), np.argsort(np.argsort(b)); return float(np.corrcoef(ra, rb)[0, 1])
valid = np.asarray([r['future'] is not None for r in rows])
validation = {'heldOutNew': ranking(held), 'oldModel': ranking(old), 'localOnly': ranking(np.zeros(len(rows))),
    'calibration': {'labelMean': float(truth[valid].mean()), 'newHeldMean': float(held[valid].mean()), 'oldMean': float(old[valid].mean()),
        'spearmanNewHeld': spearman(held[valid], truth[valid]), 'spearmanOld': spearman(old[valid], truth[valid]),
        'maeNewHeld': float(np.abs(held[valid] - truth[valid]).mean()), 'maeOld': float(np.abs(old[valid] - truth[valid]).mean())}}
print(json.dumps(validation), flush=True)
penalty = max(1, float(np.quantile(finite, .99)) * 2); fitted = model().fit(X, np.log1p(100 * costs(range(len(rows)), penalty)))
trainer = Path(__file__).read_bytes()
artifact = {'schema': 'line.arc-future-value-model.v1', 'featureSchema': 'line.arc-future-value-features.v1', 'featureCount': 57,
    'target': 'log1p(100 * nonnegative two-interval search value under line.strike.v3, leaf = heuristic arrival prior)', 'invalidCost': penalty,
    'model': export(fitted, 'expm1_div_100'),
    'provenance': {'trainer': 'tools/research/train_value_v3.py', 'trainerSha256': hashlib.sha256(trainer).hexdigest(),
        'collector': 'tools/research/value_collect.ts', 'catalog': 'benchmark/v4 (excluding groups luna_bala, amor_na_praia, tiki_tiki, amour_de_ma_vie)',
        'evalPanelDisjoint': True, 'impactContract': 'line.strike.v3', 'rows': len(rows), 'omittedShorterNonterminalHorizons': omitted,
        'records': records, 'note': 'Labels come from the production compiler whose search still used the previous learned model as its behaviour policy; the label values exclude it.'}}
body = json.dumps(artifact, separators=(',', ':'), allow_nan=False) + '\n'
(out / 'arc_value_model.json').write_text(body)
idx = np.linspace(0, len(X) - 1, 32, dtype=int)
fixture = {'cases': [{'features': X[i].tolist(), 'prediction': float(v)} for i, v in zip(idx, np.maximum(0, np.expm1(fitted.predict(X[idx])) / 100))]}
(out / 'arc_value_predictions.json').write_text(json.dumps(fixture, indent=1) + '\n')
(out / 'validation.json').write_text(json.dumps({'folds': folds, 'validation': validation, 'rows': len(rows), 'penalty': penalty}, indent=1) + '\n')
print(json.dumps({'out': str(out), 'bytes': len(body), 'sha256': hashlib.sha256(body.encode()).hexdigest()}), flush=True)
