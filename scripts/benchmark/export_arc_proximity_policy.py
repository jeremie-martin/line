# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1"]
# ///
"""Use supervised control-tree partitions to retrieve measured arc proposals."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np

p=argparse.ArgumentParser();p.add_argument('--policy',required=True);p.add_argument('--forest',required=True);p.add_argument('--out',required=True);p.add_argument('--correction',type=float,default=0,help='Research only: requires the saved analogy prototype runtime.');args=p.parse_args()
assert np.isfinite(args.correction) and 0 <= args.correction <= 1
def checked(path):
    path=Path(path);body=path.read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert digest==Path(str(path)+'.sha256').read_text().split()[0],path
    return json.loads(body),digest
policy,policy_sha=checked(args.policy);forest,forest_sha=checked(args.forest)
assert policy['featureSchema']==forest['featureSchema'] and forest['featureCount']==policy['featureCount']
assert forest['featureCount'] in (57,63,67)
examples=policy['models'][1];assert 'exemplars' in examples and 'trees' in forest
assert examples['featureCount']==forest['featureCount']
features=np.asarray([r['features'] for r in examples['exemplars']],dtype=np.float32)
leaves=[];trees=[];means=np.zeros((len(features),10))
for tree in forest['trees']:
    left,right=np.asarray(tree['left']),np.asarray(tree['right'])
    feature,threshold=np.asarray(tree['feature']),np.asarray(tree['threshold'])
    nodes=np.zeros(len(features),dtype=int)
    while np.any(left[nodes]>=0):
        selected=np.flatnonzero(left[nodes]>=0);n=nodes[selected]
        nodes[selected]=np.where(features[selected,feature[n]]<=threshold[n],left[n],right[n])
    leaves.append(nodes)
    exported={key:tree[key] for key in ['left','right','feature','threshold']}
    if args.correction:
        means+=np.asarray(tree['value'])[nodes]
        exported['value']=[v if left[k]<0 else None for k,v in enumerate(tree['value'])]
    trees.append(exported)
for index,(row,nodes) in enumerate(zip(examples['exemplars'],np.asarray(leaves).T)):
    row['proximityLeaves']=nodes.tolist()
    if args.correction:row['proximityMean']=(means[index]/len(trees)).tolist()
    else:row.pop('proximityMean',None)
examples['proximityTrees']=trees
if args.correction:examples['proximityCorrection']=args.correction
else:examples.pop('proximityCorrection',None)
examples['provenance']={**examples.get('provenance',{}),'proximityForestSha256':forest_sha,
    'proximityDescription':'Control-supervised leaf sharing, with continuous physical-distance ties. No source, seed or case identity at runtime.'}
if args.correction:examples['provenance']['proximityCorrection']=args.correction
else:examples['provenance'].pop('proximityCorrection',None)
policy['provenance']={**policy.get('provenance',{}),'proximityInputPolicySha256':policy_sha,'proximityForestSha256':forest_sha}
out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);assert not out.exists()
body=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),examples=len(features),trees=len(trees),bytes=len(body))))
