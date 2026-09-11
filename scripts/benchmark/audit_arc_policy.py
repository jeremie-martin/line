"""Inventory a compressed proposal model without copying its training data.

Exact array equality is evidence of duplication; related or similarly sized
libraries are not. This tool reports storage, not prediction value or speedup.
"""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--manifest', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
path = Path(a.manifest)
manifest_bytes = path.read_bytes()
manifest = json.loads(manifest_bytes)
payload = (path.parent / manifest['file']).read_bytes()
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha(payload) == manifest['compressedSha256']
decoded = gzip.decompress(payload)
assert len(decoded) == manifest['uncompressedBytes'] and sha(decoded) == manifest['sha256']
model = json.loads(decoded)
arrays, nodes = [], []


def visit(node, location):
    record = dict(path=location, schema=node.get('featureSchema'), featureCount=node.get('featureCount'))
    for key in ('trees', 'proximityTrees', 'exemplars'):
        if key not in node:
            continue
        values = node[key]
        body = json.dumps(values, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
        arrays.append(dict(path=location + '.' + key, count=len(values), canonicalJsonBytes=len(body), sha256=sha(body)))
        record[key] = len(values)
        if key == 'exemplars':
            record['referencedControls'] = sum('controlReference' in row for row in values)
            record['featureWidths'] = sorted({len(row['features']) for row in values})
    nodes.append(record)
    for key in ('residualBase', 'residualModel', 'startupModel', 'rolloutPolicy'):
        if key in node:
            visit(node[key], location + '.' + key)
    for index, child in enumerate(node.get('models', [])):
        visit(child, f'{location}.models[{index}]')


visit(model, 'root')
groups = defaultdict(list)
for array in arrays:
    groups[array['sha256']].append(array)
duplicates = [dict(paths=[v['path'] for v in group], canonicalJsonBytes=group[0]['canonicalJsonBytes'],
                   repeatedBytes=group[0]['canonicalJsonBytes'] * (len(group) - 1), sha256=digest)
              for digest, group in groups.items() if len(group) > 1]
record = dict(schema='line.arc-policy-inventory.v1',
              note='Exact duplicate top-level arrays within model nodes, serialized with sorted keys. Canonical JSON sizes are not gzip savings, heap sizes or evidence that distinct libraries are dispensable.',
              manifestSha256=sha(manifest_bytes), compressedSha256=sha(payload), decodedSha256=sha(decoded),
              compressedBytes=len(payload), decodedBytes=len(decoded), nodes=nodes, arrays=arrays,
              duplicates=duplicates, repeatedCanonicalJsonBytes=sum(d['repeatedBytes'] for d in duplicates))
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(record, indent=2) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(sha(body) + '\n')
print(json.dumps(dict(out=str(out), nodes=len(nodes), duplicateArrays=len(duplicates), repeatedBytes=record['repeatedCanonicalJsonBytes'])))
