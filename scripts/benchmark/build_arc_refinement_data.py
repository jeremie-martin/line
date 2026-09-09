"""Pair independently validated teacher corrections with measured student arcs."""
import argparse,gzip,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--teacher',required=True);p.add_argument('--verified',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def checked(path):
    path=Path(path);b=path.read_bytes();h=hashlib.sha256(b).hexdigest()
    assert h==Path(str(path)+'.sha256').read_text().split()[0],path
    return json.loads(gzip.decompress(b) if path.suffix=='.gz' else b),h
verified,verified_sha=checked(args.verified);root=Path(args.teacher);plan,plan_sha=checked(root/'plan.json')
assert verified['teacherPlanSha256']==plan_sha
assert all(p['allCounterfactualControlsRevalidated'] for p in verified['provenance'])
references={(r['source'],r['index']):r for r in verified['rows']};rows=[];provenance=[]
def encode(c,incoming,span):
    return [(c['entry']-incoming)/30,c['turn']/60,(c['exit']-incoming)/60,c['support']/span,c['bias'],c['offset'],c.get('clearance',12)/12,c.get('turnFraction',min(5,c['support']*.5)/c['support']),c.get('bend',0)/30,c.get('guideFlare',0)/8]
for source in plan['sources']:
    record,h=checked(root/(source+'.json.gz'))
    for i,teacher in enumerate(record['teacherRows']):
        if not i:continue
        reference=references[(source,i)];student=record['rows'][i]
        assert teacher['control']==reference['control'] and teacher['forcedControl']==student['control']
        assert teacher['features']==reference['features']
        state=teacher['features'];control=encode(student['control'],teacher['incoming'],teacher['span'])
        desired=[state[49],state[50],state[51],state[48]]
        actual=[student['achieved'].get(k) for k in ['air','speed','amplitude']]+[student.get('impact')]
        assert all(a is not None for a,t in zip(actual,desired) if t>=0)
        residual=[a-t if t>=0 else 0 for a,t in zip(actual,desired)]
        rows.append({**reference,'features':state+control+residual,'target':[a-b for a,b in zip(reference['target'],control)],'studentControl':student['control']})
    provenance.append(dict(source=source,path=str(root/(source+'.json.gz')),sha256=h))
assert len(rows)==len(verified['rows'])
data=dict(schema='line.arc-control-policy-data.v1',featureSchema='line.arc-control-refinement-features.v1',
          note='Exposed development training. Features are current physical state and targets, normalized current controls, and four measured target residuals. Labels correct a student control toward an independently validated teacher control at the exact same prefix.',
          verifiedSource=dict(path=args.verified,sha256=verified_sha),teacherPlanSha256=plan_sha,provenance=provenance,rows=rows)
out=Path(args.out);out.mkdir(parents=True,exist_ok=True);assert not (out/'data.json').exists()
b=(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n').encode();(out/'data.json').write_bytes(b);(out/'data.json.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n')
print(json.dumps(dict(rows=len(rows),features=71,out=str(out))))
