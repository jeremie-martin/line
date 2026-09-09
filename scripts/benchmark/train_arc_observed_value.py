# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Learn actual two-interval outcomes of accepted complete trajectories.

Unlike continuation-search labels, these do not contain a terminal prior.
Coverage is limited to accepted, valid trajectories; live evaluation is required.
"""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from train_physical_planner import export, write

p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--out',required=True);args=p.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True);assert not (out/'model.json').exists()
def checked(path):
    raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==Path(str(path)+'.sha256').read_text().strip()
    return json.loads(gzip.decompress(raw) if path.suffix=='.gz' else raw)
catalog=json.loads(gzip.decompress(Path('benchmark/v3/specifications.json.gz').read_bytes()))
groups={c['id']:c['group'] for c in (catalog if isinstance(catalog,list) else catalog['cases'])}
rows=[];sources=[];unmatched=0
for path in args.inputs.split(','):
    root=Path(path);run=checked(root/'run.json.gz');assert run['summary']['valid']==88 and run['plan']['options']['collectValue']
    sources.append(dict(path=str(root/'run.json.gz'),sha256=hashlib.sha256((root/'run.json.gz').read_bytes()).hexdigest()))
    for source in run['plan']['sources']:
        record=checked(root/(source+'.json.gz'));costs=np.zeros(len(record['rows']))
        for observation in record['observations']:
            owner=observation['gap']+(observation['axis']=='impact')
            costs[owner]+=(observation['error']**2)*(1/3 if observation['axis']=='amplitude' else 1)
        for i,row in enumerate(record['rows'][:-1]):
            probes=(row.get('lookahead') or {}).get('probes',[])
            selected=next((p for p in probes if p['control']==row['control'] and p.get('valueFeatures') is not None),None)
            if selected is None:unmatched+=1;continue
            features=selected['valueFeatures'];assert len(features)==57 and np.isfinite(features).all()
            rows.append(dict(source=source,group=groups[source],index=i,features=features,cost=float(sum(costs[i+1:i+3]))))
X=np.array([r['features'] for r in rows]);cost=np.array([r['cost'] for r in rows]);g=np.array([r['group'] for r in rows]);pred=np.zeros(len(rows))
def model():return HistGradientBoostingRegressor(max_iter=180,max_leaf_nodes=31,min_samples_leaf=40,learning_rate=.06,l2_regularization=1,early_stopping=False,random_state=260909)
folds=[]
for fold,(train,test) in enumerate(GroupKFold(5).split(X,cost,g)):
    m=model().fit(X[train],np.log1p(100*cost[train]));pred[test]=np.maximum(0,np.expm1(m.predict(X[test]))/100)
    folds.append(dict(fold=fold,heldGroups=sorted(set(g[test])),train=len(train),test=len(test),mae=float(np.mean(np.abs(pred[test]-cost[test])))))
    print(json.dumps(folds[-1]),flush=True)
m=model().fit(X,np.log1p(100*cost));artifact=dict(schema='line.arc-future-value-model.v1',featureSchema='line.arc-future-value-features.v1',featureCount=57,
    target='log1p(100 * actual next-two-interval axis loss on a complete accepted track)',model=export(m,'expm1_div_100'),
    provenance=dict(sources=sources,rows=len(rows),unmatchedControls=unmatched,groups=len(set(g)),
        note='Exposed V3 development training, accepted trajectories only. No terminal heuristic in the labels. Family-disjoint checks concern only this predictor; teachers already use exposed development models.'))
write(out/'model.json',artifact);write(out/'validation.json',dict(rows=len(rows),folds=folds,mae=float(np.mean(np.abs(pred-cost))),provenance=artifact['provenance']))
write(out/'parity.json',[dict(features=X[i].tolist(),prediction=max(0.,float(np.expm1(m.predict(X[i:i+1])[0]))/100)) for i in np.linspace(0,len(X)-1,32,dtype=int)])
print(json.dumps(dict(rows=len(rows),out=str(out))),flush=True)
