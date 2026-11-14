# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Retrain the compact sources' networks on today's compiler's own committed moves (on-policy self-distillation).

  uv run --offline tools/research/train_network_v4.py --inputs=DIR[,DIR] --source=ARTIFACT.json.gz --out=OUT.json.gz

Each construction group's network maps the 57 situation features to the six main controls relative to the arrival
(entry − incoming, turn, exit − incoming, support ÷ span, bias, offset), one ReLU layer of 32; its 32 styles are k-means
centres of the standardized residuals, each carrying the other controls of the demonstration nearest its centre. Catalogue
and memory exemplars are copied unchanged. Demonstrations: fulfilled committed sections of value_collect.ts records."""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.cluster import KMeans

p = argparse.ArgumentParser(); p.add_argument('--inputs', required=True); p.add_argument('--source', required=True); p.add_argument('--out', required=True)
p.add_argument('--min', type=int, default=400)
args = p.parse_args()
EVAL_SONGS = ('luna', 'amor', 'tiki', 'amour')
MAIN = ['entry', 'turn', 'exit', 'support', 'bias', 'offset']
demos, files = {}, []
for root in args.inputs.split(','):
    for path in sorted(Path(root).glob('*.json.gz')):
        d = json.loads(gzip.decompress(path.read_bytes())); files.append(str(path))
        assert not any(s in d['id'].lower() for s in EVAL_SONGS), 'evaluation song in training data'
        for row in d['construction']:
            if not row['fulfilled'] or not row['key'] or len(row['features'] or []) != 57: continue
            c = row['control']
            if any(k not in c for k in MAIN) or row['span'] <= 0: continue
            y = [c['entry'] - row['incoming'], c['turn'], c['exit'] - row['incoming'], c['support'] / row['span'], c['bias'], c['offset']]
            rest = {k: v for k, v in c.items() if k not in MAIN}
            demos.setdefault(row['key'], []).append((row['features'], y, rest))
artifact = json.loads(gzip.decompress(Path(args.source).read_bytes()))
report = {}
for key, group in artifact['groups'].items():
    rows = demos.get(key, [])
    net_model = next((m for m in group['models'] if 'network' in m), None)
    if net_model is None or len(rows) < args.min: report[key] = {'demos': len(rows), 'retrained': False}; continue
    X = np.asarray([r[0] for r in rows], float); Y = np.asarray([r[1] for r in rows], float)
    xm, xs = X.mean(0), X.std(0); xs[xs < 1e-6] = 1
    ym, ys = Y.mean(0), Y.std(0); ys[ys < 1e-6] = 1
    Xn, Yn = (X - xm) / xs, (Y - ym) / ys
    mlp = MLPRegressor(hidden_layer_sizes=(32,), activation='relu', alpha=1e-3, learning_rate_init=2e-3, max_iter=400,
                       early_stopping=True, validation_fraction=.15, random_state=260914).fit(Xn, Yn)
    R = Yn - mlp.predict(Xn)
    km = KMeans(n_clusters=32, n_init=4, random_state=260914).fit(R)
    order = np.argsort(-np.bincount(km.labels_, minlength=32))
    styles = []
    for c in order:
        members = np.where(km.labels_ == c)[0]
        if not len(members): continue
        nearest = members[np.argmin(((R[members] - km.cluster_centers_[c]) ** 2).sum(1))]
        styles.append({'residual': [round(float(v), 4) for v in km.cluster_centers_[c]], 'control': {k: round(float(v), 4) for k, v in rows[nearest][2].items()}})
    net = {'inputs': list(range(57)), 'inputMean': [round(float(v), 5) for v in xm], 'inputScale': [round(float(v), 5) for v in xs],
           'hidden': {'weights': [[round(float(w), 5) for w in col] for col in mlp.coefs_[0].T], 'bias': [round(float(b), 5) for b in mlp.intercepts_[0]]},
           'output': {'weights': [[round(float(w), 5) for w in col] for col in mlp.coefs_[1].T], 'bias': [round(float(b), 5) for b in mlp.intercepts_[1]]},
           'controlMean': [round(float(v), 5) for v in ym], 'controlScale': [round(float(v), 5) for v in ys], 'styles': styles}
    net_model['network'] = net
    report[key] = {'demos': len(rows), 'retrained': True, 'validation': round(float(mlp.best_validation_score_), 4)}
artifact['provenance'] = {'method': 'Networks retrained on-policy (train_network_v4.py); catalogues and memory exemplars unchanged',
    'source': {'file': args.source, 'sha256': hashlib.sha256(Path(args.source).read_bytes()).hexdigest()},
    'inputs': args.inputs.split(','), 'records': len(files), 'groups': report, 'previous': artifact.get('provenance')}
body = json.dumps(artifact, separators=(',', ':')).encode()
Path(args.out).write_bytes(gzip.compress(body, 9, mtime=0))
print(json.dumps(report, indent=1))
