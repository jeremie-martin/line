"""Preserve exact raw curve controls while leaving learned retrieval unchanged."""
import argparse,hashlib,json,math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--policy',required=True);p.add_argument('--data',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def checked(path):
    b=Path(path).read_bytes();digest=hashlib.sha256(b).hexdigest();assert Path(path+'.sha256').read_text().split()[0]==digest
    return json.loads(b),digest
policy,base_sha=checked(args.policy);data,data_sha=checked(args.data)
assert data['featureSchema']==policy['featureSchema']
for startup in [False,True]:
    library=policy['startupModel'] if startup else policy
    rows=[r for r in data['rows'] if (r['index']==0)==startup];assert len(rows)==len(library['exemplars'])
    for row,example in zip(rows,library['exemplars']):
        assert row['features']==example['features'] and row['target']==example['target']
        assert math.isfinite(row['incoming']) and row['span']>0 and row['span']==int(row['span'])
        example['controlReference']=dict(control=row['control'],incoming=row['incoming'],span=row['span'])
policy['provenance']['controlReferences']=dict(basePolicySha256=base_sha,dataSha256=data_sha,
    scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    note='Original measured controls and their incoming angle/span. Features, targets, partitions and ordering are unchanged. No case or seed identity enters decoding.')
out=Path(args.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True)
b=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(b);Path(str(out)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),bytes=len(b))))
