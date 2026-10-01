"""Keep a proven proposal policy while updating its native demonstration memory.

References into policy exemplars avoid storing shared demonstrations twice.
Memory order is preserved exactly, including deterministic distance ties.
"""
import argparse, gzip, hashlib, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--policies', required=True)
p.add_argument('--examples', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()

def read(path):
    raw = Path(path).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == Path(path+'.sha256').read_text().strip()
    return json.loads(gzip.decompress(raw)), digest

model, policy_hash = read(args.policies)
examples, example_hash = read(args.examples)
assert model['schema'] == 'line.construction-policies.v1'
assert examples['schema'] == 'line.construction-examples.v1'
assert 'memoryGroups' not in model, 'use an original policy artifact'
out = Path(args.out)
assert not out.exists(), 'preserve existing model artifacts'
identity = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'))
memory = {}; counts = {}
for key, rows in examples['groups'].items():
    originals = [dict(**r['controlReference'], features=r['features'])
        for r in model['groups'].get(key, {}).get('exemplars', [])]
    indices = {identity(r): i for i, r in enumerate(originals)}
    memory[key] = [indices.get(identity(r), r) for r in rows]
    assert [originals[r] if isinstance(r, int) else r for r in memory[key]] == rows
    counts[key] = dict(examples=len(rows), referenced=sum(isinstance(r, int) for r in memory[key]))
model['memoryGroups'] = memory
raw = (json.dumps(model, separators=(',', ':'))+'\n').encode()
packed = gzip.compress(raw, compresslevel=9, mtime=0)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(packed)
Path(str(out)+'.sha256').write_text(hashlib.sha256(packed).hexdigest()+'\n')
provenance = dict(schema='line.construction-search-pack.v1', policies=args.policies,
    policiesSha256=policy_hash, examples=args.examples, examplesSha256=example_hash,
    sha256=hashlib.sha256(packed).hexdigest(), groups=counts)
body = (json.dumps(provenance, indent=2)+'\n').encode()
Path(str(out)+'.provenance.json').write_bytes(body)
Path(str(out)+'.provenance.json.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(bytes=len(packed), examples=sum(v['examples'] for v in counts.values()),
    referenced=sum(v['referenced'] for v in counts.values()))))
