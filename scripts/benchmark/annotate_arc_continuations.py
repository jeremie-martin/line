"""Attach following controls from independently validated coherent teacher tracks."""
import argparse,hashlib,json,math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--policy',required=True);p.add_argument('--data',required=True);p.add_argument('--out',required=True);p.add_argument('--component',default='1')
args=p.parse_args()
def checked(path):
    body=Path(path).read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert Path(path+'.sha256').read_text().split()[0]==digest
    return json.loads(body),digest
policy,policy_sha=checked(args.policy);data,data_sha=checked(args.data)
assert data['featureSchema']=='line.arc-control-policy-features.v1'
rows=data['rows'];library=policy
for index in args.component.split(','):library=library['models'][int(index)]
assert library['provenance']['dataSha256']==data_sha
assert len(rows)==len(library['exemplars'])
def trajectory_maps(dataset):
    if 'inputs' in dataset:
        result=[];offset=0
        for item in dataset['inputs']:
            child,digest=checked(item['path']);assert digest==item['sha256']
            assert child['rows']==dataset['rows'][offset:offset+len(child['rows'])]
            result.extend(trajectory_maps(child));offset+=len(child['rows'])
        assert offset==len(dataset['rows']);return result
    if 'teacherPlanSha256' in dataset:
        # Counterfactual queries share student prefixes, not one coherent rollout.
        return [None]*len(dataset['rows'])
    assert 'panels' in dataset and 'provenance' in dataset
    lookup={(r['source'],r['index']):r for r in dataset['rows']}
    assert len(lookup)==len(dataset['rows'])
    return [lookup]*len(dataset['rows'])
maps=trajectory_maps(data)
counts=[0,0,0]
for exemplar,row,by_index in zip(library['exemplars'],rows,maps):
    assert exemplar['features']==row['features'] and exemplar['target']==row['target']
    templates=[]
    for offset in [1,2]:
        following=by_index.get((row['source'],row['index']+offset)) if by_index is not None else None
        if following is None:break
        assert len(following['target'])==10 and all(math.isfinite(v) for v in following['target'])
        templates.append(following['target'])
    if templates:exemplar['continuationTemplates']=templates
    counts[len(templates)]+=1
policy['provenance'].setdefault('continuationAnnotations',[]).append(dict(policySha256=policy_sha,dataSha256=data_sha,component=args.component,
    countByDepth=counts,scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    note='Only the numeric next two controls from each verified whole teacher trajectory. Existing proposals, partitions and weights are unchanged; no case identity is consumed at runtime.'))
out=Path(args.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True)
body=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),countByDepth=counts,bytes=len(body))))
