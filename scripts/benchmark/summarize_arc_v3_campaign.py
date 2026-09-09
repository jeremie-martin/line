"""Preserve paired compiler-campaign evidence; large raw studies remain local."""
import argparse, gzip, hashlib, json
from pathlib import Path


parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True)
parser.add_argument('--baseline', required=True)
parser.add_argument('--target', required=True, type=float)
args = parser.parse_args()
assert args.name.startswith('arc-') and args.name[4:].isdigit()
assert 0 < args.target < 1000
root = Path('generated/benchmark-v3') / args.name


def read(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


baseline_path = Path(args.baseline)
baseline, baseline_sha = read(baseline_path)
base = {r['sourceId']: r for r in baseline['rows'] if r['seed'] == 16}
assert len(base) == 88
studies = []
for path in sorted(root.glob('*/run.json.gz')):
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
    patch_path=path.parent/'compiler.patch'
    patch=patch_path.read_bytes()
    patch_sha=hashlib.sha256(patch).hexdigest()
    preserved_patch=None
    if patch and len(patch)<=100000:
        preserved_patch=Path('benchmark/v3/studies')/(args.name+'-prototypes')/(patch_sha+'.patch')
        preserved_patch.parent.mkdir(parents=True,exist_ok=True)
        preserved_patch.write_bytes(patch)
        Path(str(preserved_patch)+'.sha256').write_text(patch_sha+'\n')
    studies.append(dict(name=path.parent.name,path=str(path),sha256=digest,
                        compiler=plan['compiler']['candidateFingerprint'],head=plan['compiler']['head'],
                        options=plan['options'],modelSha256=plan.get('modelSha256'),
                        valueModelSha256=plan.get('valueModelSha256'),cases=len(rows),fullSuite=full,
                        headline=run['summary'].get('headline'),valid=sum(r['valid'] for r in paired),
                        arithmeticMeanDelta=sum(r['delta'] for r in paired)/len(paired),
                        improved=sum(r['delta']>0 for r in paired),regressed=sum(r['delta']<0 for r in paired),
                        physicalFrames=sum(r['physicalFrames'] for r in paired),paired=paired,
                        compilerPatch=dict(path=str(patch_path),sha256=patch_sha,bytes=len(patch),
                                           preservedPath=str(preserved_patch) if preserved_patch else None)))
canonical_path=Path(f'benchmark/v3/studies/{args.name}-validation.json')
canonical=None
if canonical_path.exists():
    validation,digest=read(canonical_path)
    assert validation['goal']==args.target and validation['targetReached']
    canonical=dict(path=str(canonical_path),sha256=digest,headline=validation['summary']['headline'],
                   compilerCommit=validation['compilerCommit'])
unfinished=[]
for path in sorted(root.glob('full-*/plan.json')):
    if (path.parent/'run.json.gz').exists():continue
    plan,digest=read(path)
    unfinished.append(dict(name=path.parent.name,planSha256=digest,options=plan['options'],
                           completedCells=len(list(path.parent.glob('*.json.gz'))),
                           note='No complete result or headline; this plan is pending, running or was stopped before a full panel was completed.'))
record = dict(schema='line.arc-v3-campaign-research.v1',status='complete' if canonical else 'in-progress',target=args.target,
              baseline=dict(path=str(baseline_path),sha256=baseline_sha,headline=baseline['summary']['headline']),
              targetComparison='strictly-greater-than',canonical=canonical,
              note='Exposed development research. Partial pilots have no headline. Full single-seed results require canonical confirmation on seeds 16/17 through the public compiler. Failed runs retain zero scores.',
              studies=studies,unfinished=unfinished)
out=Path(f'benchmark/v3/studies/{args.name}-research.json')
body=(json.dumps(record,indent=2,allow_nan=False)+'\n').encode()
out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps([dict(name=s['name'],headline=s['headline'],meanDelta=s['arithmeticMeanDelta'],valid=s['valid'],cases=s['cases']) for s in studies],indent=2))
