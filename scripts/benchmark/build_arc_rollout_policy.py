"""Split one verified expert library into opening and subsequent-curve proposals."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--combined',required=True);p.add_argument('--data',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def checked(path):
    body=Path(path).read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert Path(path+'.sha256').read_text().split()[0]==digest
    return json.loads(body),digest
combined,_=checked(args.combined);data,digest=checked(args.data);library=combined['models'][1]
assert library['provenance']['dataSha256']==digest
assert data['featureSchema']==library['featureSchema']=='line.arc-horizon-control-policy-features.v1'
assert len(library['exemplars'])==len(data['rows'])==16138
for example,row in zip(library['exemplars'],data['rows']):
    assert example['features']==row['features'] and example['target']==row['target']
startup={**library,'exemplars':[e for e,r in zip(library['exemplars'],data['rows']) if r['index']==0]}
policy={**library,'exemplars':[e for e,r in zip(library['exemplars'],data['rows']) if r['index']>0],'startupModel':startup}
assert len(startup['exemplars'])==176 and len(policy['exemplars'])==15962
out=Path(args.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True)
body=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),bytes=len(body),startup=176,catches=15962)))
