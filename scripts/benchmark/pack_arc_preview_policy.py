"""Combine a general arc policy and a rollout proposal, then store losslessly."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--base', required=True)
p.add_argument('--rollout', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()

def checked(path):
    raw = Path(path).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert Path(path + '.sha256').read_text().split()[0] == digest
    return json.loads(raw), digest

base, base_sha = checked(args.base)
rollout, rollout_sha = checked(args.rollout)
assert 'rolloutPolicy' not in base
combined = {**base, 'rolloutPolicy': rollout}
raw = (json.dumps(combined, separators=(',', ':'), allow_nan=False) + '\n').encode()
compressed = gzip.compress(raw, compresslevel=6, mtime=0)
assert gzip.decompress(compressed) == raw
assert len(compressed) < 100 * 1024 * 1024, 'runtime asset exceeds GitHub file limit'
manifest = dict(schema='line.arc-compressed-policy.v1', compression='gzip-file',
    file='arc_control_policy_model.json.gz', uncompressedBytes=len(raw),
    sha256=hashlib.sha256(raw).hexdigest(), compressedSha256=hashlib.sha256(compressed).hexdigest())
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

def write(path, body):
    if path.exists():
        assert path.read_bytes() == body, 'refusing to replace a different artifact'
    else:
        path.write_bytes(body)

write(out / manifest['file'], compressed)
write(out / 'arc_control_policy_model.json', (json.dumps(manifest, indent=2) + '\n').encode())
proof = dict(schema='line.arc-preview-policy-package.v1', basePolicySha256=base_sha,
    rolloutPolicySha256=rollout_sha, manifest=manifest, compressedBytes=len(compressed),
    exactBasePolicy=True, exactRolloutPolicy=True, losslessCompression=True,
    scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
body = (json.dumps(proof, indent=2) + '\n').encode()
write(out / 'proof.json', body)
write(out / 'proof.json.sha256', (hashlib.sha256(body).hexdigest() + '\n').encode())
print(json.dumps(proof))
