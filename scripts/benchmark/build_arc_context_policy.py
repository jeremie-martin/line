"""Add a measured-context example library to an unchanged physical policy."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--data',required=True)
p.add_argument('--out',required=True);p.add_argument('--base-weight',type=float,default=3)
args=p.parse_args()
def checked(path):
    path=Path(path);body=path.read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert digest==Path(str(path)+'.sha256').read_text().split()[0],path
    return json.loads(body),digest
base,base_sha=checked(args.base);data,data_sha=checked(args.data)
assert base['featureCount']==57 and args.base_weight>0
count={'line.arc-control-policy-features.v1':57,'line.arc-context-control-policy-features.v1':63,'line.arc-horizon-control-policy-features.v1':67}[data['featureSchema']]
assert all(len(r['features'])==count and len(r['target'])==10 for r in data['rows'])
library=dict(schema='line.arc-control-policy-examples.v1',featureSchema=data['featureSchema'],featureCount=count,
    exemplars=[dict(features=r['features'],target=r['target']) for r in data['rows']],
    provenance=dict(dataSha256=data_sha,trainingParents=sorted({r['parent'] for r in data['rows']})))
policy=dict(schema='line.arc-control-policy-mixture.v1',featureSchema=data['featureSchema'],featureCount=count,
    models=[base,library],proposalWeights=[args.base_weight,1],
    provenance=dict(baseSha256=base_sha,dataSha256=data_sha,
        note='Unchanged baseline component plus a measured library; all proposals still require physical validation. No source or seed identifiers are supplied to the runtime.'))
if 'startupModel' in base:policy['startupModel']=base['startupModel']
out=Path(args.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True)
body=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),examples=len(data['rows']),featureCount=count)))
