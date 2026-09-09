# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Fit a modest ensemble of joint arc controls, with complete-parent validation."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.model_selection import GroupKFold
parser=argparse.ArgumentParser();parser.add_argument('--data',required=True);parser.add_argument('--out',required=True);parser.add_argument('--target-metric',choices=['raw','variance','search-step'],default='raw')
parser.add_argument('--trees',type=int,default=32);parser.add_argument('--depth',type=int,default=10);parser.add_argument('--leaf',type=int,default=12)
parser.add_argument('--algorithm',choices=['extra','forest'],default='extra');parser.add_argument('--folds',type=int,default=5)
parser.add_argument('--sample-weight',choices=['uniform','duration','sqrt-duration'],default='uniform');args=parser.parse_args()
assert args.trees>=2 and args.depth>0 and args.leaf>0 and (args.folds==0 or args.folds>=2)
p=Path(args.data);body=p.read_bytes();digest=hashlib.sha256(body).hexdigest();assert digest==Path(str(p)+'.sha256').read_text().strip()
data=json.loads(body);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
assert not (out/'model.json').exists()
X=np.array([r['features'] for r in data['rows']]);y=np.array([r['target'] for r in data['rows']]);groups=np.array([r['parent'] for r in data['rows']]);assert X.shape[1]=={'line.arc-control-policy-features.v1':57,'line.arc-control-refinement-features.v1':71}[data['featureSchema']] and np.isfinite(X).all() and np.isfinite(y).all()
def fitted(indices):
 weights=np.ones(10)
 if args.target_metric=='variance':weights=1/np.maximum(.05,np.std(y[indices],axis=0))
 if args.target_metric=='search-step':weights=np.array([15,12,10,10,4,5,8,12.5,30/7,3.2])
 cls=ExtraTreesRegressor if args.algorithm=='extra' else RandomForestRegressor
 # Feature 47 is the current physical interval duration in seconds. It is
 # available at runtime and gives longer, rarer spans a share of training work
 # without consulting source identities or benchmark aggregation weights.
 sample_weight=None
 if args.sample_weight!='uniform':
  sample_weight=np.maximum(.025,X[indices,47])**(.5 if args.sample_weight=='sqrt-duration' else 1.)
  sample_weight=sample_weight/np.mean(sample_weight)
 model=cls(n_estimators=args.trees,max_depth=args.depth,min_samples_leaf=args.leaf,max_features=.8,random_state=260908,n_jobs=4).fit(X[indices],y[indices]*weights,sample_weight=sample_weight)
 return model,weights
def write(path,record):
 b=(json.dumps(record,separators=(',',':'),allow_nan=False)+'\n').encode();path.write_bytes(b);Path(str(path)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n')
def export(model,parents,weights):
 trees=[]
 for estimator in model.estimators_:
  t=estimator.tree_;trees.append(dict(left=t.children_left.tolist(),right=t.children_right.tolist(),feature=t.feature.tolist(),threshold=t.threshold.tolist(),value=(t.value[:,:,0]/weights).tolist()))
 return dict(schema='line.arc-control-policy.v1',featureSchema=data['featureSchema'],featureCount=int(X.shape[1]),trees=trees,provenance=dict(dataSha256=digest,trainingParents=parents,rows=int(np.isin(groups,parents).sum()),datasetRows=len(data['rows']),targetMetric=args.target_metric,targetWeights=weights.tolist(),sampleWeight=args.sample_weight,algorithm=args.algorithm,estimators=args.trees,depth=args.depth,minLeaf=args.leaf,description='Joint control regression; no case or seed identity in features; full physical validation required.'))
metrics=[];assignments={};pred=np.zeros_like(y)
for fold,(train,test) in enumerate(GroupKFold(args.folds).split(X,y,groups) if args.folds else []):
 m,w=fitted(train);pred[test]=m.predict(X[test])/w;held=sorted(set(groups[test]));write(out/f'fold-{fold}.json',export(m,sorted(set(groups[train])),w))
 for index in test:assignments[data['rows'][index]['source']]=fold
 metrics.append(dict(fold=fold,heldParents=held,train=len(train),test=len(test),controlRms=np.sqrt(np.mean((pred[test]-y[test])**2,axis=0)).tolist()))
 print(json.dumps(metrics[-1]),flush=True)
m,w=fitted(np.arange(len(y)));write(out/'model.json',export(m,sorted(set(groups)),w));write(out/'assignments.json',assignments)
write(out/'validation.json',dict(rows=len(y),parents=len(set(groups)),folds=metrics,controlRms=np.sqrt(np.mean((pred-y)**2,axis=0)).tolist() if args.folds else None,note='Offline control prediction, not feasibility or a live compiler score. Complete parent families are held out together when folds are requested.'))
write(out/'parity.json',[dict(features=X[i].tolist(),mean=(m.predict(X[i:i+1])[0]/w).tolist()) for i in np.linspace(0,len(y)-1,24,dtype=int)])
