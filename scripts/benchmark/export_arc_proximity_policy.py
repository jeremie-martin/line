# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1"]
# ///
"""Use supervised control-tree partitions to retrieve measured arc proposals."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np

p=argparse.ArgumentParser();p.add_argument('--policy',required=True);p.add_argument('--forest',required=True);p.add_argument('--out',required=True);args=p.parse_args()
def checked(path):
    path=Path(path);body=path.read_bytes();digest=hashlib.sha256(body).hexdigest()
    assert digest==Path(str(path)+'.sha256').read_text().split()[0],path
    return json.loads(body),digest
policy,policy_sha=checked(args.policy);forest,forest_sha=checked(args.forest)
assert policy['featureSchema']==forest['featureSchema'] and forest['featureCount']==57
examples=policy['models'][1];assert 'exemplars' in examples and 'trees' in forest
features=np.asarray([r['features'] for r in examples['exemplars']],dtype=np.float32)
leaves=[];trees=[]
for tree in forest['trees']:
    left,right=np.asarray(tree['left']),np.asarray(tree['right'])
    feature,threshold=np.asarray(tree['feature']),np.asarray(tree['threshold'])
    nodes=np.zeros(len(features),dtype=int)
    while np.any(left[nodes]>=0):
        selected=np.flatnonzero(left[nodes]>=0);n=nodes[selected]
        nodes[selected]=np.where(features[selected,feature[n]]<=threshold[n],left[n],right[n])
    leaves.append(nodes)
    trees.append({key:tree[key] for key in ['left','right','feature','threshold']})
for row,nodes in zip(examples['exemplars'],np.asarray(leaves).T):row['proximityLeaves']=nodes.tolist()
examples['proximityTrees']=trees
examples['provenance']={**examples.get('provenance',{}),'proximityForestSha256':forest_sha,
    'proximityDescription':'Control-supervised leaf sharing, with continuous physical-distance ties. No source, seed or case identity at runtime.'}
policy['provenance']={**policy.get('provenance',{}),'proximityInputPolicySha256':policy_sha,'proximityForestSha256':forest_sha}
out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);assert not out.exists()
body=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),examples=len(features),trees=len(trees),bytes=len(body))))
