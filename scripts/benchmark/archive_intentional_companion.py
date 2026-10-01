"""Archive a complete V4/V5 companion and compare its exact preserved outcomes."""
import argparse, gzip, hashlib, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--version', choices=['v4', 'v5'], required=True)
p.add_argument('--run', required=True)
p.add_argument('--baseline', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()

def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path)+'.sha256').read_text().strip(), path
    return json.loads(body), digest

source = Path(a.run)/'run.json'
baseline = Path(a.baseline)/'run.json'
run, digest = checked(source)
old, old_digest = checked(baseline)
id_key, plan_key = ('sourceId', 'sources') if a.version == 'v4' else ('id', 'ids')

def indexed(data):
    plan, rows = data['plan'], data['rows']
    expected = {(i, s) for i in plan[plan_key] for s in plan['seeds']}
    actual = {(r[id_key], r['seed']): r for r in rows}
    assert len(rows) == len(actual) == len(expected) and set(actual) == expected
    return actual

current, previous = indexed(run), indexed(old)
assert set(current) == set(previous), 'not a matched complete companion'
assert run['plan']['budget'] == old['plan']['budget']
assert run['plan']['judge'] == old['plan']['judge'], 'different judge'
if a.version == 'v4':
    assert run['plan']['suiteFingerprint'] == old['plan']['suiteFingerprint']
keys = ['sourceId', 'seed', 'trackHash', 'score', 'resources'] if a.version == 'v4' else [
    'id', 'seed', 'sourceId', 'panel', 'family', 'score', 'musicalScore', 'valid',
    'fulfilled', 'requested', 'trackHash', 'constructionFailure', 'physicalFrames',
    'compileMs', 'judgeMs', 'executionError']
result = dict(schema=f'line.intentional-motion-{a.version}-companion.v1',
    source=str(source), sha256=digest, baseline=str(baseline), baselineSha256=old_digest,
    plan=run['plan'], summary=run['summary'],
    identicalTracks=sum(r.get('trackHash') is not None and r['trackHash'] == previous[k].get('trackHash') for k, r in current.items()),
    identicalScores=sum(r['score'] == previous[k]['score'] for k, r in current.items()),
    rows=[{k: r.get(k) for k in keys} for r in run['rows']])
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
body = gzip.compress((json.dumps(result, separators=(',', ':'))+'\n').encode(), mtime=0)
out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps({k: result[k] for k in ['source', 'identicalTracks', 'identicalScores']}))
