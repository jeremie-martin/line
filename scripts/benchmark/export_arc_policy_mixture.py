"""Export a joint forest plus measured control examples and independent fixtures."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--forest', required=True)
parser.add_argument('--examples', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--forest-parity')
parser.add_argument('--fixtures')
parser.add_argument('--proposal-weights',default='2,1')
args = parser.parse_args()


def checked(path):
    p = Path(path)
    body = p.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(p) + '.sha256').read_text().strip()
    return json.loads(body), digest


def write(path, value, checksum=True):
    p = Path(path)
    body = (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(body)
    if checksum:
        Path(str(p) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')


forest, forest_sha = checked(args.forest)
data, data_sha = checked(args.examples)
assert forest['featureCount'] == 57 and data['featureSchema'] == forest['featureSchema']
examples = [{'features': row['features'], 'target': row['target']} for row in data['rows']]
assert all(len(row['features']) == 57 and len(row['target']) == 10 for row in examples)
measured = {'schema': 'line.arc-control-policy-examples.v1',
            'featureSchema': forest['featureSchema'], 'featureCount': 57,
            'exemplars': examples,
            'provenance': {'dataSha256': data_sha,
                           'trainingParents': sorted({r['parent'] for r in data['rows']}),
                           'description': 'Relative physical state and authored targets only; no source, index, seed or absolute coordinates in inference data.'}}
weights=json.loads('['+args.proposal_weights+']')
assert len(weights)==2 and all(type(v) in (int,float) and v>0 for v in weights)
model = {'schema': 'line.arc-control-policy.v2', 'featureSchema': forest['featureSchema'],
         'featureCount': 57, 'models': [forest, measured], 'proposalWeights': weights,
         'provenance': {'forestSha256': forest_sha, 'examplesSha256': data_sha,
                        'forestTrainingRows': forest['provenance']['rows'], 'exemplarRows': len(examples),
                        'trainingParents': sorted(set(forest['provenance']['trainingParents']) |
                                                  set(measured['provenance']['trainingParents'])),
                        'description': 'Learned joint proposals plus nearby replay-verified controls; all proposals receive ordinary physical validation.'}}
write(args.out, model)


def decode(v, incoming=20, span=30):
    return dict(entry=incoming + 30 * v[0], turn=60 * v[1], exit=incoming + 60 * v[2],
                support=span * v[3], bias=v[4], offset=v[5], clearance=12 * v[6],
                turnFraction=v[7], bend=30 * v[8], guideFlare=8 * v[9])


def nearest(features, count=4):
    def distance(row):
        total = 0.
        for k, v in enumerate(row['features']):
            total += (features[k] - v) ** 2 * (4 if k >= 47 else 2 if k < 7 else 1)
        return total
    pool = sorted(examples, key=distance)[:max(24, count * 8)]
    selected = []
    for row in pool:
        c = decode(row['target'])
        if any(abs(c['turn'] - p['turn']) < 4 and abs(c['entry'] - p['entry']) < 2 and
               abs(c['exit'] - p['exit']) < 4 and abs(c['support'] - p['support']) < 1 for p in selected):
            continue
        selected.append(c)
        if len(selected) >= count:
            break
    return selected


if args.fixtures:
    assert args.forest_parity
    parity, _ = checked(args.forest_parity)
    write(args.fixtures, [{'features': row['features'], 'mean': row['mean'],
                          'examples': nearest(row['features'])} for row in parity], checksum=False)
print(json.dumps({'forestRows': model['provenance']['forestTrainingRows'],
                  'examples': len(examples), 'bytes': Path(args.out).stat().st_size}))
