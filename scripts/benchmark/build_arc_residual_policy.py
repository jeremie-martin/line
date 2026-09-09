# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1"]
# ///
"""Learn corrections to a frozen control forest from verified teacher actions.

The residual model predicts teacher controls minus the frozen forest mean.
Its tree proposals are added to that mean, then undergo ordinary physical
validation. This changes the proposal distribution; zero correction does not
reproduce the old forest's individual-tree proposals.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True)
parser.add_argument('--data', required=True)
parser.add_argument('--mixture', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--strengths', default='1,0.5')
parser.add_argument('--folds', type=int, default=5)
args = parser.parse_args()
out = Path(args.out).resolve()
assert not (out / 'data.json').exists()


def checked(path):
    path = Path(path)
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().split()[0], path
    return json.loads(body), digest


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    body = (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()
    path.write_bytes(body)
    digest = hashlib.sha256(body).hexdigest()
    Path(str(path) + '.sha256').write_text(digest + '\n')
    return digest


base, base_sha = checked(args.base)
data, data_sha = checked(args.data)
mixture, mixture_sha = checked(args.mixture)
assert base['featureCount'] == 57 and ('trees' in base or 'residualBase' in base)
assert data['featureSchema'] == base['featureSchema'] == mixture['featureSchema']
assert len(mixture['models']) == 2 and 'exemplars' in mixture['models'][1]


def predict(features, component=None):
    component = base if component is None else component
    if 'residualBase' in component:
        strength = component.get('residualStrength', 1)
        assert np.isfinite(strength) and strength >= 0
        return (predict(features, component['residualBase']) +
                strength * predict(features, component['residualModel']))
    # Match the training library's float32 input conversion and the runtime's
    # sequential mean of tree predictions, independently of TypeScript.
    features = np.asarray(features, dtype=np.float32)
    output = np.zeros((len(features), 10))
    for tree in component['trees']:
        left, right = np.asarray(tree['left']), np.asarray(tree['right'])
        feature, threshold = np.asarray(tree['feature']), np.asarray(tree['threshold'])
        value = np.asarray(tree['value'])
        nodes = np.zeros(len(features), dtype=int)
        while np.any(left[nodes] >= 0):
            selected = np.flatnonzero(left[nodes] >= 0)
            n = nodes[selected]
            nodes[selected] = np.where(features[selected, feature[n]] <= threshold[n], left[n], right[n])
        output += value[nodes]
    return output / len(component['trees'])


means = predict([r['features'] for r in data['rows']])
residual = {**data,
            'note': 'Teacher controls minus the frozen baseline forest mean. This dataset is for a residual predictor, not standalone control decoding.',
            'residualBaseSha256': base_sha, 'sourceDataSha256': data_sha,
            'rows': [{**r, 'target': (np.asarray(r['target']) - mean).tolist()}
                     for r, mean in zip(data['rows'], means)]}
residual_sha = write(out / 'data.json', residual)
subprocess.run(['uv', 'run', str(Path(__file__).with_name('train_arc_policy.py').resolve()),
                '--data=' + str(out / 'data.json'), '--out=' + str(out / 'forest'),
                '--trees=32', '--depth=14', '--leaf=4', '--folds=' + str(args.folds)], check=True)
delta, delta_sha = checked(out / 'forest/model.json')
rows, _ = checked(out / 'forest/parity.json')
means = predict([r['features'] for r in rows])
for strength in map(float, args.strengths.split(',')):
    assert np.isfinite(strength) and strength >= 0
    wrapped = dict(schema='line.arc-control-residual-policy.v1',
                   featureSchema=base['featureSchema'], featureCount=57,
                   residualBase=base, residualModel=delta, residualStrength=strength,
                   provenance=dict(baseSha256=base_sha, residualDataSha256=residual_sha,
                                   sourceDataSha256=data_sha, residualModelSha256=delta_sha,
                                   rows=len(data['rows']),
                                   trainingParents=sorted({r['parent'] for r in data['rows']})))
    policy = {**mixture, 'models': [wrapped, mixture['models'][1]],
              'provenance': {**wrapped['provenance'], 'mixtureSourceSha256': mixture_sha}}
    write(out / f'policy-{strength:g}.json', policy)
    write(out / f'parity-{strength:g}.json',
          [dict(features=r['features'], mean=(mean + strength * np.asarray(r['mean'])).tolist())
           for r, mean in zip(rows, means)])
print(json.dumps(dict(out=str(out), rows=len(data['rows']), residualDataSha256=residual_sha)))
