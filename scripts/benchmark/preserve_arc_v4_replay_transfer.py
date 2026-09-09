"""Preserve the independent physical validation of fixed-prefix teacher queries."""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--data', required=True)
p.add_argument('--teacher', required=True)
p.add_argument('--out', required=True)
args = p.parse_args()


def checked(path):
    path = Path(path)
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


data, data_sha = checked(args.data)
run, run_sha = checked(Path(args.teacher) / 'run.json.gz')
plan, plan_sha = checked(Path(args.teacher) / 'plan.json')
assert run['plan'] == plan
assert data['teacherPlanSha256'] == plan_sha
replay, replay_sha = checked(plan['options']['replayControlPath'])
assert replay_sha == plan['replaySha256']
assert plan['suite'] == 'v4'
assert run['summary']['headline'] == replay['studentHeadline']
catalog_path = Path('benchmark/v4/specifications.json.gz')
assert data['catalogSha256'] == hashlib.sha256(catalog_path.read_bytes()).hexdigest()
assert plan['judge']['inputSha256'] == hashlib.sha256(gzip.decompress(catalog_path.read_bytes())).hexdigest()
cases = json.loads(gzip.decompress(catalog_path.read_bytes()))
ids = {c['id'] for c in cases}
assert len(ids) == len(cases) == len(plan['sources']) == 176
assert ids == set(plan['sources']) == set(replay['cases'])
assert len(data['provenance']) == len(run['rows']) == 176
assert ids == {r['source'] for r in data['provenance']}
assert ids == {r['source'] for r in data['rows']}
assert all(r['score']['valid'] for r in run['rows'])
assert all(r['resources']['physicalFrames'] <= plan['budget'] for r in run['rows'])
by_source = {r['sourceId']: r for r in run['rows']}
for row in data['provenance']:
    assert row['allPrefixesAndFeaturesMatched']
    assert row['allCounterfactualControlsRevalidated']
    digest = hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()
    assert row['sha256'] == digest
    source = row['source']
    assert row['replayedTrackHash'] == by_source[source]['trackHash'] == replay['cases'][source]['trackHash']
    assert row['checkedControls'] == len(replay['cases'][source]['controls'])
for row in data['rows']:
    assert len(row['features']) == 57 and len(row['target']) == 10
    assert all(math.isfinite(x) for x in row['features'] + row['target'])
assert len(data['rows']) == sum(r['checkedControls'] - 1 for r in data['provenance'])
record = dict(
    schema='line.arc-v4-replay-teacher-transfer.v1',
    dataset=dict(path=args.data, sha256=data_sha, rows=len(data['rows']), sources=176,
                 parents=len({r['parent'] for r in data['rows']}), featureCount=57, controlCount=10),
    teacher=dict(path=args.teacher, runSha256=run_sha, planSha256=plan_sha,
                 budget=plan['budget'], options=plan['options'], compiler=plan['compiler'],
                 replaySha256=replay_sha, fixedStudentHeadline=run['summary']['headline']),
    collector={k: data[k] for k in ['scriptSha256', 'catalogSha256', 'geometrySha256',
                                   'featureSourceSha256', 'arrivalSourceSha256']},
    validation=data['provenance'],
    scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    note='Exposed development training. Every counterfactual teacher control is physically revalidated '
         'at the exact fixed student prefix and input features. The replayed headline describes the '
         'student, not the counterfactual controls or a new teacher rollout. Runtime inputs contain '
         'physical state and upcoming targets; they exclude case and seed identifiers.')
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(record, indent=2, allow_nan=False) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(out=str(out), sources=176, rows=len(data['rows']))))
