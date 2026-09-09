"""Preserve proposal slots for different measured control distributions."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--out',required=True);args=p.parse_args()
models=[];sources=[]
for name in args.inputs.split(','):
    path=Path(name);b=path.read_bytes();digest=hashlib.sha256(b).hexdigest();assert digest==Path(str(path)+'.sha256').read_text().split()[0]
    m=json.loads(b);assert len(m['models'])==2 and m['proposalWeights']==[2,1]
    if models:assert m['models'][0]==models[0]['models'][0]
    models.append(m);sources.append(dict(path=name,sha256=digest))
assert len(models)>1
m=models[0];examples=[x['models'][1] for x in models]
m['models'][1]=dict(schema='line.arc-control-policy.v2',featureSchema=m['featureSchema'],featureCount=m['featureCount'],
    models=examples,proposalWeights=[1]*len(examples),provenance=dict(sources=sources,note='Partition existing example proposal slots across measured distributions; keep the forest/example allocation and total proposal count.'))
m['provenance']=dict(sources=sources,forestTrainingRows=m['models'][0]['provenance']['rows'],exemplarRows=sum(len(x['exemplars']) for x in examples),
    description='The original forest plus quota-preserved measured control generations. Exposed V3 development training; relative state and target features only.')
out=Path(args.out);assert not out.exists();b=(json.dumps(m,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(b);Path(str(out)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n');print(json.dumps(dict(out=str(out),bytes=len(b))))
