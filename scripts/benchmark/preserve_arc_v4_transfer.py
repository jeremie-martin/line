"""Preserve compact provenance for replay-verified, exposed V4 teacher controls."""
import argparse, gzip, hashlib, json, math, shutil
from collections import Counter
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--proofs',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def checked(path):
    path=Path(path);body=path.read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert digest==Path(str(path)+'.sha256').read_text().strip(),path
    return json.loads(gzip.decompress(body) if path.suffix=='.gz' else body),digest
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);body=(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
    path.write_bytes(body);Path(str(path)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
data,data_sha=checked(args.data)
lock,_=checked('benchmark/v4/catalog.lock.json');raw=gzip.decompress(Path('benchmark/v4/specifications.json.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest()==lock['specificationsSha256'];cases=json.loads(raw)
assert {c['id'] for c in cases}=={r['source'] for r in data['provenance']}
assert len(data['provenance'])==len(cases)==176
proofs=[];verified={};out=Path(args.out)
for path in args.proofs.split(','):
    proof,digest=checked(path)
    assert len(proof['rows'])==proof['cases']
    for row in proof['rows']:
        assert row['exactRetainedGeometry'] and row['exactPrefixAndTerminalStates']
        verified[row['recordSha256']]=row
    preserved=out.parent/'geometry-proofs'/(digest+'.json');preserved.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(path,preserved);shutil.copyfile(path+'.sha256',str(preserved)+'.sha256')
    proofs.append(dict(path=str(preserved),sha256=digest,cases=proof['cases'],controls=proof['controls'],scriptSha256=proof['scriptSha256']))
for row in data['provenance']:
    assert row['prefixesMatchedFullTrack'] and row['sha256'] in verified
    assert verified[row['sha256']]['source']==row['source']
for row in data['rows']:
    assert len(row['features'])==57 and len(row['target'])==10
    assert all(math.isfinite(x) for x in row['features']+row['target'])
panels=[]
for panel in data['panels']:
    path=Path(panel['path'])/'run.json.gz';run,digest=checked(path);assert digest==panel['sha256']
    panels.append(dict(path=str(path),sha256=digest,budget=run['plan']['budget'],seed=run['plan']['seed'],
                       cases=len(run['rows']),valid=run['summary'].get('valid'),headline=run['summary'].get('headline'),
                       compiler=run['plan']['compiler']['candidateFingerprint'],options=run['plan']['options']))
record=dict(schema='line.arc-v4-teacher-transfer.v1',dataset=dict(path=args.data,sha256=data_sha,rows=len(data['rows']),sources=176,
            parents=len({r['parent'] for r in data['rows']}),featureCount=57,controlCount=10),panels=panels,geometryProofs=proofs,
            selectedTrajectoryCounts=dict(Counter(str(Path(r['path']).parent) for r in data['provenance'])),
            verifiedSelectedPrefixes=176,selectedReplayPhysicsFrames=sum(r['replayFrames'] for r in data['provenance']),
            scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            note='Exposed development training. The best valid complete trajectory per case supplies training actions; this selection is not a compiler run or score. Higher teacher budgets do not qualify for the 750k goal. Runtime inputs are physical state and upcoming targets, without source, seed or absolute-position identifiers.')
write(out,record);print(json.dumps(dict(out=str(out),sources=176,rows=len(data['rows']),proofs=len(proofs))))
