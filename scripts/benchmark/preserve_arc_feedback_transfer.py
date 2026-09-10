"""Preserve feedback training, its matched ablation, and inference checks."""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--root', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()
root = Path(args.root)


def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().split()[0], path
    return json.loads(body), digest


records = []
for name, size in [('measured-correction', 77), ('context-correction', 73)]:
    path = root / 'data' / name / 'data.json'
    data, digest = checked(path)
    assert len(data['provenance']) == 176 and data['contexts'] == 15962
    assert data['scriptSha256'] == hashlib.sha256(Path('scripts/benchmark/collect_arc_feedback_policy.py').read_bytes()).hexdigest()
    comparable = hashlib.sha256()
    for row in data['rows']:
        assert len(row['features']) == size and len(row['target']) == 10
        record = {**row, 'features': row['features'][:73]}
        comparable.update((json.dumps(record, sort_keys=True, separators=(',', ':')) + '\n').encode())
    model_dir = root / 'models' / name
    validation, validation_sha = checked(model_dir / 'validation.json')
    parity, parity_sha = checked(model_dir / 'verified-parity.json')
    assert validation['rows'] == len(data['rows']) and validation['parents'] == 65
    assert len(validation['folds']) == 3 and parity['fixtures'] == 24 and parity['maxError'] < 1e-12
    assert parity['modelSha256'] == hashlib.sha256((model_dir / 'model.json').read_bytes()).hexdigest()
    assert parity['fixtureSha256'] == hashlib.sha256((model_dir / 'parity.json').read_bytes()).hexdigest()
    records.append(dict(name=name, dataPath=str(path), dataSha256=digest, rows=len(data['rows']),
        contexts=data['contexts'], invalidExcluded=data['invalidProbesExcluded'],
        duplicateProbesExcluded=data['duplicateProbesExcluded'], featureCount=size,
        comparableRowsSha256=comparable.hexdigest(), sourceProvenance=data['sourceProvenance'],
        sourceValidation=data['provenance'], validation=validation, validationSha256=validation_sha,
        inferenceParity=parity, inferenceParitySha256=parity_sha))
    del data
assert records[0]['comparableRowsSha256'] == records[1]['comparableRowsSha256']
assert records[0]['sourceProvenance'] == records[1]['sourceProvenance']
assert records[0]['inferenceParity']['runtimeSha256'] == records[1]['inferenceParity']['runtimeSha256']
result = dict(schema='line.arc-feedback-transfer-evidence.v1', records=records,
    ablationRowsMatchExactlyWithoutMeasuredResiduals=True,
    scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    note='Exposed V4 development training. Both datasets use the same fixed student prefixes and '
         'independently validated expert controls. All three folds hold out complete parent families. '
         'Prediction RMS and interpreter parity do not establish physical compiler improvement. '
         'The original source proofs remain authoritative for physical validation.')
out = Path(args.out)
body = (json.dumps(result, indent=2) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(out=str(out), rows=records[0]['rows'], exactAblation=True)))
