"""Average compatible continuation predictors in their trained log space."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--out',required=True);args=p.parse_args()
models=[];sources=[]
for name in args.inputs.split(','):
    path=Path(name);b=path.read_bytes();h=hashlib.sha256(b).hexdigest();assert h==Path(str(path)+'.sha256').read_text().split()[0]
    m=json.loads(b);assert m['featureSchema']=='line.arc-future-value-features.v1' and m['featureCount']==57 and m['model']['link']=='expm1_div_100'
    models.append(m);sources.append(dict(path=name,sha256=h))
assert len(models)>1
out=dict(schema='line.arc-future-value-model.v1',featureSchema=models[0]['featureSchema'],featureCount=57,
    target='Mean predicted log1p continuation-search value; constituent labels include their terminal priors.',
    model=dict(link='expm1_div_100',initial=sum(m['model']['initial'] for m in models)/len(models),
        trees=[{**t,'value':[v/len(models) for v in t['value']]} for m in models for t in m['model']['trees']]),
    provenance=dict(sources=sources,note='Equal log-space ensemble of development-trained predictors, with no new inference features or extra physics allowance.'))
path=Path(args.out);assert not path.exists();b=(json.dumps(out,separators=(',',':'),allow_nan=False)+'\n').encode();path.write_bytes(b);Path(str(path)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n');print(json.dumps(dict(out=str(path),trees=len(out['model']['trees']))))
