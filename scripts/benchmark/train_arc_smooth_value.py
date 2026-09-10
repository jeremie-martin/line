# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Fit a smooth physical-state future-value model for geometry search."""
import argparse,gzip,hashlib,json
from pathlib import Path
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import GroupKFold
from train_physical_planner import write
p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--base',required=True);p.add_argument('--out',required=True);p.add_argument('--epochs',type=int,default=120);args=p.parse_args()
assert args.epochs>0
roots=[Path(name) for name in args.inputs.split(',')];out=Path(args.out);out.mkdir(parents=True,exist_ok=True);assert not (out/'model.json').exists()
def checked(path):
    b=path.read_bytes();assert hashlib.sha256(b).hexdigest()==Path(str(path)+'.sha256').read_text().split()[0]
    return json.loads(gzip.decompress(b) if path.suffix=='.gz' else b)
catalog=Path('benchmark/v4');lock=checked(catalog/'catalog.lock.json');raw=gzip.decompress((catalog/'specifications.json.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest()==lock['specificationsSha256'];cases=json.loads(raw)
byid={c['id']:c for c in cases};rows=[];records=[];omitted=0;panels=[]
for root in roots:
    plan=checked(root/'plan.json');run=checked(root/'run.json.gz');assert run['plan']==plan and plan['suite']=='v4' and plan['options']['collectValue']
    assert plan['sources']==[c['id'] for c in cases] and run['summary']['valid']==len(cases)==176
    plan_sha=hashlib.sha256((root/'plan.json').read_bytes()).hexdigest()
    assert plan_sha not in {p['planSha256'] for p in panels}, 'duplicate teacher panel'
    panels.append(dict(path=str(root),planSha256=plan_sha,runSha256=hashlib.sha256((root/'run.json.gz').read_bytes()).hexdigest()))
    for source in plan['sources']:
        path=root/(source+'.json.gz');record=checked(path);assert record['planSha256']==plan_sha
        records.append(dict(source=source,planSha256=plan_sha,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        for index,row in enumerate(record['rows']):
            for probe in (row.get('lookahead') or {}).get('probes',[]):
                features=probe.get('valueFeatures')
                if features is None:continue
                assert probe['depth']<=2, 'three-interval labels cannot silently replace the two-interval value target'
                if probe['futureCost'] is not None and probe['depth']<2 and features[52]>0:omitted+=1;continue
                assert len(features)==57 and np.isfinite(features).all()
                # The same source/index can have different physical prefixes in
                # different panels. Never rank those as one decision context.
                rows.append(dict(source=source,group=byid[source]['group'],context=f'{plan_sha}:{source}:{index}',features=features,
                    future=probe['futureCost'],local=probe['localCost'],old=probe['predictedFuture']))
features=np.asarray([r['features'] for r in rows]);old=np.asarray([r['old'] for r in rows]);groups=np.asarray([r['group'] for r in rows])
base_path=Path(args.base);base_bytes=base_path.read_bytes();base=json.loads(base_bytes)
assert base['featureCount']==57 and base['featureSchema']=='line.arc-future-value-features.v1'
pred=np.full(len(features),base['model']['initial'],dtype=float)
for tree in base['model']['trees']:
    leaf=np.asarray(tree['leaf']);left=np.asarray(tree['left']);right=np.asarray(tree['right']);feature=np.asarray(tree['feature']);threshold=np.asarray(tree['threshold']);value=np.asarray(tree['value']);nodes=np.zeros(len(features),dtype=int)
    while np.any(~leaf[nodes]):
        selected=np.flatnonzero(~leaf[nodes]);n=nodes[selected];nodes[selected]=np.where(features[selected,feature[n]]<=threshold[n],left[n],right[n])
    pred+=value[nodes]
pred=np.maximum(0,np.expm1(pred)/100);base_error=float(np.max(np.abs(pred-old)));assert base_error<1e-12
log_old=np.log1p(100*old);X=features;finite=np.asarray([r['future'] for r in rows if r['future'] is not None])
def costs(indices,penalty):return np.asarray([max(0,rows[i]['future']) if rows[i]['future'] is not None else penalty for i in indices])
def fit(indices):
    xm=X[indices].mean(axis=0);xs=np.maximum(X[indices].std(axis=0),1e-6)
    finite_train=[rows[i]['future'] for i in indices if rows[i]['future'] is not None]
    penalty=max(1,float(np.quantile(finite_train,.99))*2)
    y=np.log1p(100*costs(indices,penalty));ym=float(y.mean());ys=max(.01,float(y.std()))
    model=MLPRegressor(hidden_layer_sizes=(96,96),activation='tanh',solver='adam',alpha=.01,
        batch_size=1024,learning_rate_init=.001,max_iter=args.epochs,early_stopping=True,
        validation_fraction=.1,n_iter_no_change=12,tol=1e-5,random_state=260910)
    model.fit((X[indices]-xm)/xs,(y-ym)/ys)
    return model,xm,xs,ym,ys,penalty
def predict(bundle,indices):
    m,xm,xs,ym,ys,_=bundle;return np.maximum(0,np.expm1(m.predict((X[indices]-xm)/xs)*ys+ym)/100)
def artifact(bundle,fitted_rows):
    m,xm,xs,ym,ys,_=bundle
    return dict(schema='line.arc-smooth-future-value.v1',featureSchema=base['featureSchema'],featureCount=57,
        network=dict(activation='tanh',inputMean=xm.tolist(),inputScale=xs.tolist(),outputMean=ym,outputScale=ys,
            layers=[dict(weights=w.tolist(),bias=b.tolist()) for w,b in zip(m.coefs_,m.intercepts_)]),
        provenance=dict(teacherPanels=panels,datasetRows=len(rows),fittedRows=fitted_rows,trainerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            epochs=m.n_iter_,target='log1p(100 * nonnegative two-interval search value including terminal prior)'))
contexts={}
for i,r in enumerate(rows):contexts.setdefault(r['context'],[]).append(i)
def ranking(indices,estimates,penalty):
    positions={int(index):j for j,index in enumerate(indices)};regrets=[]
    for values in contexts.values():
        if values[0] not in positions or len(values)<2:continue
        assert all(i in positions for i in values)
        local=np.asarray([rows[i]['local'] for i in values]);truth=local+costs(values,penalty)
        if np.ptp(truth)<1e-8:continue
        choice=int(np.argmin(local+np.asarray([estimates[positions[i]] for i in values])))
        regrets.append(float(truth[choice]-min(truth)))
    return dict(contexts=len(regrets),meanRegret=float(np.mean(regrets)))
# The first predeclared group fold is a screening study, not a pooled five-fold claim.
train,test=next(GroupKFold(5).split(X,groups=groups));held=fit(train);predictions=predict(held,test)
validation=dict(train=len(train),test=len(test),heldGroups=sorted(set(groups[test])),
    baseRanking=ranking(test,old[test],held[-1]),networkRanking=ranking(test,predictions,held[-1]),
    logCostRms=float(np.sqrt(np.mean((np.log1p(100*predictions)-np.log1p(100*costs(test,held[-1])))**2))),
    teacherPanels=panels,epochs=held[0].n_iter_,
    note='One declared fold holds complete catalog groups out across all teacher panels. Physical decision contexts retain plan identity. Labels include terminal priors. This diagnostic does not establish a compiler headline or physical feasibility.')
write(out/'validation.json',validation);write(out/'held-model.json',artifact(held,len(train)));print(json.dumps(validation),flush=True)
final=fit(np.arange(len(X)));write(out/'model.json',artifact(final,len(X)))
indices=np.linspace(0,len(X)-1,32,dtype=int);predictions=predict(final,indices)
write(out/'parity.json',[dict(features=X[i].tolist(),prediction=float(v)) for i,v in zip(indices,predictions)])
print(json.dumps(dict(out=str(out),epochs=final[0].n_iter_,rows=len(rows))),flush=True)
