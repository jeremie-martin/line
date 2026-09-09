"""Combine hash-verified teaching datasets without changing their measured actions."""
import argparse
import hashlib
import json
import math
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--inputs', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()
rows, sources = [], []
schema = None
for name in args.inputs.split(','):
    path = Path(name)
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    data = json.loads(body)
    assert data['schema'] == 'line.arc-control-policy-data.v1'
    if schema is None:
        schema = data['featureSchema']
    assert data['featureSchema'] == schema
    assert not data.get('residualBaseSha256'), 'merge measured actions, not residual labels'
    for row in data['rows']:
        assert len(row['features']) == 57 and len(row['target']) == 10
        assert all(math.isfinite(x) for x in row['features'] + row['target'])
    rows.extend(data['rows'])
    sources.append(dict(path=str(path), sha256=digest, rows=len(data['rows']),
                        sources=len({r['source'] for r in data['rows']})))
out = Path(args.out)
assert not out.exists()
out.parent.mkdir(parents=True, exist_ok=True)
result = dict(schema='line.arc-control-policy-data.v1', featureSchema=schema,
              inputs=sources, rows=rows,
              scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              note='Exposed development training. Rows are concatenated unchanged from declared '
                   'datasets, whose physical validation remains attached to their original hashes. '
                   'Multiple valid actions at the same state are retained. This merge performs '
                   'no new physical validation and claims no new rollout score.')
body = (json.dumps(result, separators=(',', ':'), allow_nan=False) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(out=str(out), rows=len(rows), inputs=sources)))
