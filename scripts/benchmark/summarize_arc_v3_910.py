"""Preserve compact paired 910-campaign evidence; raw studies remain local."""
import gzip, hashlib, json
from pathlib import Path


def read(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


baseline_path = Path('benchmark/v3/runs/arc-901.json.gz')
baseline, baseline_sha = read(baseline_path)
base = {r['sourceId']: r for r in baseline['rows'] if r['seed'] == 16}
assert len(base) == 88
studies = []
for path in sorted(Path('generated/benchmark-v3/arc-910').glob('*/run.json.gz')):
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
                        physicalFrames=sum(r['physicalFrames'] for r in paired),paired=paired))
record = dict(schema='line.arc-v3-910-research.v1',status='in-progress',target=910,
              baseline=dict(path=str(baseline_path),sha256=baseline_sha,headline=901.0923),
              note='Exposed development research. Partial pilots have no headline. Full single-seed results require canonical confirmation on seeds 16/17 through the public compiler. Failed runs retain zero scores.',
              studies=studies)
out=Path('benchmark/v3/studies/arc-910-research.json')
body=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode()
out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps([dict(name=s['name'],headline=s['headline'],meanDelta=s['arithmeticMeanDelta'],valid=s['valid'],cases=s['cases']) for s in studies],indent=2))
