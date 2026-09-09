"""Preserve compact paired above-920 campaign evidence; raw studies remain local."""
import gzip, hashlib, json
from pathlib import Path


def read(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


baseline_path = Path('benchmark/v3/runs/arc-910.json.gz')
baseline, baseline_sha = read(baseline_path)
base = {r['sourceId']: r for r in baseline['rows'] if r['seed'] == 16}
assert len(base) == 88
studies = []
for path in sorted(Path('generated/benchmark-v3/arc-920').glob('*/run.json.gz')):
    run, digest = read(path)
    rows, plan = run['rows'], run['plan']
    assert plan['budget'] == 750000 and plan['seed'] == 16
    assert len(rows) == len({r['sourceId'] for r in rows})
    assert set(r['sourceId'] for r in rows) == set(plan['sources'])
    paired = []
    for r in rows:
        b = base[r['sourceId']]
        frames = r['resources']['physicalFrames']
        assert 0 <= frames <= plan['budget']
        paired.append(dict(id=r['sourceId'], before=b['score']['score'], after=r['score']['score'],
                           delta=r['score']['score']-b['score']['score'], valid=r['score']['valid'],
                           physicalFrames=frames, trackHash=r['trackHash'],
                           sameTrack=r['trackHash']==b['trackHash'],
                           sameFrames=frames==b['resources']['physicalFrames']))
    full = set(r['sourceId'] for r in rows) == set(base)
    assert full == ('headline' in run['summary'])
    studies.append(dict(name=path.parent.name,path=str(path),sha256=digest,
                        compiler=plan['compiler']['candidateFingerprint'],head=plan['compiler']['head'],
                        options=plan['options'],modelSha256=plan.get('modelSha256'),
                        valueModelSha256=plan.get('valueModelSha256'),cases=len(rows),fullSuite=full,
                        headline=run['summary'].get('headline'),valid=sum(r['valid'] for r in paired),
                        arithmeticMeanDelta=sum(r['delta'] for r in paired)/len(paired),
                        improved=sum(r['delta']>0 for r in paired),regressed=sum(r['delta']<0 for r in paired),
                        physicalFrames=sum(r['physicalFrames'] for r in paired),paired=paired,
                        implementationNote='The new terminal override did not reach the compile-wide span-weight closure. Preserved adverse first execution; corrected in full-terminal-weighted.' if path.parent.name=='full-terminal-objective' else None))
canonical_path=Path('benchmark/v3/studies/arc-920-validation.json')
canonical=None
if canonical_path.exists():
    validation,digest=read(canonical_path)
    assert validation['goal']==920 and validation['targetReached']
    canonical=dict(path=str(canonical_path),sha256=digest,headline=validation['summary']['headline'],
                   compilerCommit=validation['compilerCommit'])
unfinished=[]
for path in sorted(Path('generated/benchmark-v3/arc-920').glob('full-*/plan.json')):
    if (path.parent/'run.json.gz').exists():continue
    plan,digest=read(path)
    unfinished.append(dict(name=path.parent.name,planSha256=digest,options=plan['options'],
                           completedCells=len(list(path.parent.glob('*.json.gz'))),
                           note='No complete result or headline. Two zero-cell quota/guidance plans were interrupted when prioritizing the ending corrections; other listed plans may still be running.'))
record = dict(schema='line.arc-v3-920-research.v1',status='complete' if canonical else 'in-progress',target=920,
              baseline=dict(path=str(baseline_path),sha256=baseline_sha,headline=910.5248),
              targetComparison='strictly-greater-than',canonical=canonical,
              note='Exposed development research. Partial pilots have no headline. Full single-seed results require canonical confirmation on seeds 16/17 through the public compiler. Failed runs retain zero scores.',
              studies=studies,unfinished=unfinished)
out=Path('benchmark/v3/studies/arc-920-research.json')
body=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode()
out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps([dict(name=s['name'],headline=s['headline'],meanDelta=s['arithmeticMeanDelta'],valid=s['valid'],cases=s['cases']) for s in studies],indent=2))
