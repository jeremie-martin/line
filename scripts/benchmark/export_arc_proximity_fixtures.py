# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1"]
# ///
"""Independently compute measured proposals from a hash-verified runtime policy.

The input supplies already verified mean-predictor fixtures. This utility keeps
those means and recomputes measured proposals, including a larger retrieval pool.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('--policy', required=True)
p.add_argument('--input', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()
body = Path(args.policy).read_bytes()
digest = hashlib.sha256(body).hexdigest()
assert digest == Path(args.policy + '.sha256').read_text().split()[0]
model = json.loads(body)['models'][1]
assert model['featureCount'] == 57 and model['proximityTrees']


def leaves(features):
    features = np.asarray(features, dtype=np.float32)
    result = []
    for tree in model['proximityTrees']:
        node = 0
        while tree['left'][node] >= 0:
            node = tree['left' if features[tree['feature'][node]] <= tree['threshold'][node] else 'right'][node]
        result.append(node)
    return result


def nearest(features, count):
    query = leaves(features)
    correction = model.get('proximityCorrection', 0)
    mean = [sum(t['value'][n][j] for t, n in zip(model['proximityTrees'], query)) / len(query)
            for j in range(10)] if correction else None

    weights = model.get('featureWeights', [4 if i >= 47 else 2 if i < 7 else 1 for i in range(57)])

    def distance(row):
        total = 0.
        for k, v in enumerate(row['features']):
            total += (features[k] - v) ** 2 * weights[k]
        return sum(a != b for a, b in zip(query, row['proximityLeaves'])) + total / (1 + total)

    pool = sorted(model['exemplars'], key=distance)[:max(24, count * 8)]
    selected = []
    for row in pool:
        v = row['target']
        if correction:
            v = [x + correction * (a - b) for x, a, b in zip(v, mean, row['proximityMean'])]
        c = dict(entry=20 + 30*v[0], turn=60*v[1], exit=20 + 60*v[2], support=30*v[3],
                 bias=v[4], offset=v[5], clearance=12*v[6], turnFraction=v[7], bend=30*v[8], guideFlare=8*v[9])
        if any(abs(c['turn']-q['turn']) < 4 and abs(c['entry']-q['entry']) < 2 and
               abs(c['exit']-q['exit']) < 4 and abs(c['support']-q['support']) < 1 for q in selected):
            continue
        selected.append(c)
        if len(selected) >= count:
            break
    return selected


fixtures = json.loads(Path(args.input).read_text())
for row in fixtures:
    row['examples'] = nearest(row['features'], 4)
    row['expandedExamples'] = nearest(row['features'], 24)
out = Path(args.out)
assert not out.exists()
out.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(fixtures, separators=(',', ':'), allow_nan=False)+'\n').encode()
out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(policySha256=digest, fixtures=len(fixtures), out=str(out))))
