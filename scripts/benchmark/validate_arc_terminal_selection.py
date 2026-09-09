"""Check complete-ending selection against a matched frozen V3 control panel."""
import argparse,gzip,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--after',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def read(path):
    b=path.read_bytes();assert hashlib.sha256(b).hexdigest()==Path(str(path)+'.sha256').read_text().split()[0]
    return json.loads(gzip.decompress(b) if path.suffix=='.gz' else b)
before=Path(args.before);after=Path(args.after);b=read(before/'run.json.gz');a=read(after/'run.json.gz')
assert len(a['rows'])==len(b['rows'])==88
for key in ['sources','seed','budget','judgeFiles']:assert a['plan'][key]==b['plan'][key]
bm={r['sourceId']:r for r in b['rows']};records=[]
for r in a['rows']:
    source=r['sourceId'];rr=read(after/(source+'.json.gz'));bb=read(before/(source+'.json.gz'));s=r['terminalSelectionStats']
    assert len(rr['rows'])==len(bb['rows'])
    prefix=all(x['control']==y['control'] for x,y in zip(rr['rows'][:-1],bb['rows'][:-1]))
    delta=r['stats']['sim_frames']-bm[source]['stats']['sim_frames'];score_delta=r['score']['score']-bm[source]['score']['score']
    error=abs(r['score']['weightedAxisRms']**2-s['finalLoss']);initial_error=abs(bm[source]['score']['weightedAxisRms']**2-s['initialLoss'])
    assert r['score']['valid'] and prefix and delta==0 and score_delta>=0 and max(error,initial_error)<1e-12
    records.append(dict(source=source,changed=s['changed'],scoreDelta=score_delta,sameEarlierControls=prefix,physicalFrameDelta=delta,objectiveError=error,initialObjectiveError=initial_error))
def reference(path,run):return dict(path=str(path/'run.json.gz'),sha256=hashlib.sha256((path/'run.json.gz').read_bytes()).hexdigest(),headline=run['summary']['headline'])
result=dict(schema='line.arc-terminal-selection-validation.v1',before=reference(before,b),after=reference(after,a),cases=88,valid=a['summary']['valid'],
    changed=sum(r['changed'] for r in records),improved=sum(r['scoreDelta']>0 for r in records),regressed=0,samePhysicsFrames=88,sameEarlierControls=88,
    maximumObjectiveError=max(max(r['objectiveError'],r['initialObjectiveError']) for r in records),records=records)
out=Path(args.out);raw=(json.dumps(result,indent=2)+'\n').encode();out.write_bytes(raw);Path(str(out)+'.sha256').write_text(hashlib.sha256(raw).hexdigest()+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['before','after','records']}))
