"""Remove unused branch outputs without changing any tree decision or leaf value."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
source, output = Path(args.input), Path(args.out)
body = source.read_bytes()
digest = hashlib.sha256(body).hexdigest()
assert digest == Path(str(source) + '.sha256').read_text().strip().split()[0]
assert not output.exists(), 'use a new output path'
model = json.loads(body)
assert model['schema'] == 'line.arc-control-policy.v1'
for tree in model['trees']:
    assert len(tree['left']) == len(tree['value'])
    for node, left in enumerate(tree['left']):
        if left >= 0:
            tree['value'][node] = []
        else:
            assert len(tree['value'][node]) == 10
model['provenance']['unprunedModelSha256'] = digest
body = (json.dumps(model, separators=(',', ':'), allow_nan=False) + '\n').encode()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(body)
Path(str(output) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps({'inputBytes': source.stat().st_size, 'outputBytes': len(body)}))
