# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Reuse the arc policy's supervised retrieval for each physical construction.

This fits neighborhoods of observed controls, not a substitute physics model.
Native held-source compilation is the efficacy test; fit error is not a score.
"""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.ensemble import ExtraTreesRegressor

p = argparse.ArgumentParser()
p.add_argument('--examples', required=True)
p.add_argument('--out', required=True)
p.add_argument('--trees', type=int, default=32)
p.add_argument('--leaf', type=int, default=4)
args = p.parse_args()
assert args.trees >= 2 and args.leaf >= 1
source = Path(args.examples); raw = source.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
assert digest == Path(str(source)+'.sha256').read_text().strip()
data = json.loads(gzip.decompress(raw)); assert data['schema'] == 'line.construction-examples.v1'
out = Path(args.out); assert not out.exists(), 'preserve existing models'
groups = {}; checks = []; sizes = {}
for key, rows in data['groups'].items():
    if len(rows) < 2 * args.leaf:
        continue
    features = np.asarray([r['features'] for r in rows], dtype=np.float32)
    assert features.shape[1] == 57 and np.isfinite(features).all()
    fields = sorted(set().union(*(r['control'].keys() for r in rows)))
    targets = []
    for row in rows:
        controls = row['control']; vector = []
        for field in fields:
            value = controls.get(field, 0)
            if field in ('entry', 'exit'):
                value -= row['incoming']
            elif field == 'support':
                value /= row['span']
            # Presence is explicit: absent controls remain absent in retrieved
            # references and are never reconstructed from regression means.
            vector.extend([value, float(field in controls)])
        targets.append(vector)
    targets = np.asarray(targets); assert np.isfinite(targets).all()
    scales = np.maximum(.02, targets.std(axis=0))
    forest = ExtraTreesRegressor(n_estimators=args.trees, max_depth=12,
        min_samples_leaf=args.leaf, max_features=.8, random_state=261001, n_jobs=4)
    forest.fit(features, targets / scales)
    memberships = forest.apply(features)
    trees = []
    for estimator in forest.estimators_:
        t = estimator.tree_
        trees.append(dict(left=t.children_left.tolist(), right=t.children_right.tolist(),
            feature=t.feature.tolist(), threshold=t.threshold.tolist()))
    exemplars = [dict(features=r['features'], target=[], controlReference={k:r[k] for k in ('control','incoming','span')},
        proximityLeaves=memberships[i].tolist()) for i,r in enumerate(rows)]
    groups[key] = dict(featureSchema='line.arc-control-policy-features.v1', featureCount=57,
        proximityTrees=trees, exemplars=exemplars)
    # Queries between measured states test Python/JavaScript traversal and exact
    # reference retrieval away from the trivially identical training point.
    for i in np.linspace(0, len(rows)-1, min(4,len(rows)), dtype=int):
        query = .65 * np.asarray(rows[i]['features']) + .35 * np.asarray(rows[(i+1)%len(rows)]['features'])
        leaves = forest.apply(query.astype(np.float32)[None,:])[0]
        distances = ((np.asarray([r['features'] for r in rows]) - query)**2 * np.asarray([2]*7+[1]*40+[4]*10)).sum(axis=1)
        ranked = (memberships != leaves).sum(axis=1) + distances/(1+distances)
        winner = int(np.argmin(ranked))
        checks.append(dict(key=key, features=query.tolist(), reference=exemplars[winner]['controlReference']))
    sizes[key] = dict(examples=len(rows), nodes=sum(len(t['left']) for t in trees))
record = dict(schema='line.construction-policies.v1', groups=groups,
    provenance=dict(examplesSha256=digest, seed=261001, trees=args.trees, leaf=args.leaf,
        target='Variance-scaled controls with explicit presence; neighborhoods only, no generated means.',
        description='Same arcControlProposals runtime and mandatory native validation; no source/seed/case lookup.'))
body = gzip.compress((json.dumps(record,separators=(',',':'),allow_nan=False)+'\n').encode(), compresslevel=9, mtime=0)
out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
Path(str(out)+'.parity.json').write_text(json.dumps(checks,separators=(',',':'))+'\n')
print(json.dumps(dict(out=str(out), bytes=len(body), groups=sizes, checks=len(checks))))
