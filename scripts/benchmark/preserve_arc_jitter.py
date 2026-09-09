"""Verify and compact a completed target-jitter diagnostic without its raw tracks."""
import argparse,hashlib,json,re
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--name',required=True)
p.add_argument('--suite',choices=['v3','v4'],default='v3');args=p.parse_args()
assert re.fullmatch(r'[a-z][a-z0-9-]*',args.name)
root=Path(args.input)
def read(path):
    body=path.read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert digest==Path(str(path)+'.sha256').read_text().strip(),path
    return json.loads(body),digest
plan,plan_sha=read(root/'plan.json');summary,summary_sha=read(root/'summary.json')
for name,digest in plan['implementation'].items():
    assert hashlib.sha256((Path(plan['compilerRoot'])/name).read_bytes()).hexdigest()==digest,name
rows=[]
for source in plan['sources']:
    for seed in plan['seeds']:
        row,digest=read(root/f'{source}-{seed}.json')
        assert row['source']==source and row['seed']==seed
        assert row['budget']==plan['budget'] and row['jitter']==plan['jitter']
        assert 0<=row['stats']['sim_frames']<=plan['budget']
        rows.append(dict(source=source,seed=seed,valid=row['score']['valid'],trackHash=row['trackSha256'],physicalFrames=row['stats']['sim_frames'],sha256=digest))
assert len(rows)==summary['cells']
assert sum(r['valid'] for r in rows)==summary['valid']
assert len({r['trackHash'] for r in rows})==summary['distinctTracks']
assert sum(r['physicalFrames'] for r in rows)==summary['totalFrames']
assert max(r['physicalFrames'] for r in rows)==summary['maxFrames']
record=dict(schema=f'line.arc-{args.suite}-campaign-jitter-validation.v1',
            note=f'Separate target-jitter stress on the reused V2 development catalog. This is not a {args.suite.upper()} headline or an independent-family generalization test.',
            compilerCommit=plan['head'],plan=plan,summary=summary,rows=rows,
            rawDirectory=str(root),planSha256=plan_sha,summarySha256=summary_sha)
out=Path(f'benchmark/{args.suite}/studies/{args.name}-jitter.json');body=(json.dumps(record,indent=2)+'\n').encode()
out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),valid=summary['valid'],runs=len(rows),distinctTracks=summary['distinctTracks'])))
