"""Replace measured proposal examples while retaining a policy's learned component."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--policy',required=True);p.add_argument('--data',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def checked(path):
    path=Path(path);b=path.read_bytes();h=hashlib.sha256(b).hexdigest()
    assert h==Path(str(path)+'.sha256').read_text().split()[0],path
    return json.loads(b),h
policy,policy_sha=checked(args.policy);data,data_sha=checked(args.data)
assert policy['featureSchema']==data['featureSchema'] and policy['featureCount']==57
assert len(policy['models'])==2 and 'exemplars' in policy['models'][1]
assert all(len(r['features'])==57 and len(r['target'])==10 for r in data['rows'])
policy['models'][1]=dict(schema='line.arc-control-policy-examples.v1',featureSchema=policy['featureSchema'],featureCount=57,
    exemplars=[dict(features=r['features'],target=r['target']) for r in data['rows']],
    provenance=dict(dataSha256=data_sha,trainingParents=sorted({r['parent'] for r in data['rows']}),
                    description='Relative physical state and authored targets, without runtime case or seed identity.'))
policy['provenance']={**policy.get('provenance',{}),'parentPolicySha256':policy_sha,'examplesSha256':data_sha}
out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);assert not out.exists()
b=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(b);Path(str(out)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),examples=len(data['rows']),bytes=len(b))))
