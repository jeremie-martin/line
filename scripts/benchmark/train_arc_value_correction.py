# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Learn corrections to a frozen future-value prior from accurate continuations."""
import argparse,gzip,hashlib,json
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from train_physical_planner import export,write
p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--base',required=True);p.add_argument('--out',required=True);args=p.parse_args()
root,out=Path(args.inputs),Path(args.out);out.mkdir(parents=True,exist_ok=True);assert not (out/'policy-1.json').exists()
def checked(path):
    b=path.read_bytes();assert hashlib.sha256(b).hexdigest()==Path(str(path)+'.sha256').read_text().split()[0]
    return json.loads(gzip.decompress(b) if path.suffix=='.gz' else b)
plan=checked(root/'plan.json');run=checked(root/'run.json.gz');assert run['plan']==plan and plan['suite']=='v4' and plan['options']['collectValue']
catalog=Path('benchmark/v4');lock=checked(catalog/'catalog.lock.json');raw=gzip.decompress((catalog/'specifications.json.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest()==lock['specificationsSha256'];cases=json.loads(raw)
assert plan['sources']==[c['id'] for c in cases] and run['summary']['valid']==len(cases)==176
byid={c['id']:c for c in cases};rows=[];records=[];omitted=0
for source in plan['sources']:
    path=root/(source+'.json.gz');record=checked(path);assert record['planSha256']==hashlib.sha256((root/'plan.json').read_bytes()).hexdigest()
    records.append(dict(source=source,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    for index,row in enumerate(record['rows']):
        for probe in (row.get('lookahead') or {}).get('probes',[]):
            features=probe.get('valueFeatures')
            if features is None:continue
            if probe['futureCost'] is not None and probe['depth']<2 and features[52]>0:omitted+=1;continue
            assert len(features)==57 and np.isfinite(features).all()
            rows.append(dict(source=source,group=byid[source]['group'],context=f'{source}:{index}',features=features,
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
log_old=np.log1p(100*old);X=np.column_stack([features,log_old]);finite=np.asarray([r['future'] for r in rows if r['future'] is not None])
def costs(indices,penalty):return np.asarray([max(0,rows[i]['future']) if rows[i]['future'] is not None else penalty for i in indices])
def model():return HistGradientBoostingRegressor(max_iter=180,max_leaf_nodes=31,min_samples_leaf=40,learning_rate=.06,l2_regularization=1,early_stopping=False,random_state=260910)
def artifact(fitted,strength):return dict(schema='line.arc-future-value-correction.v1',featureSchema=base['featureSchema'],featureCount=57,
    residualBase=base,residualModel=export(fitted,'identity'),residualStrength=strength,residualInput='features-plus-log1p-base',
    target='correction to log1p(100 * nonnegative two-interval search value including terminal prior)')
residual_prediction=np.zeros(len(rows));validation_cost=np.zeros(len(rows));folds=[]
for fold,(train,test) in enumerate(GroupKFold(5).split(X,groups=groups)):
    train_finite=[rows[i]['future'] for i in train if rows[i]['future'] is not None];penalty=max(1,float(np.quantile(train_finite,.99))*2)
    fitted=model().fit(X[train],np.log1p(100*costs(train,penalty))-log_old[train]);residual_prediction[test]=fitted.predict(X[test]);validation_cost[test]=costs(test,penalty)
    write(out/f'fold-{fold}.json',artifact(fitted,1));folds.append(dict(fold=fold,heldGroups=sorted(set(groups[test])),train=len(train),test=len(test)));print(json.dumps(folds[-1]),flush=True)
contexts={}
for i,r in enumerate(rows):contexts.setdefault(r['context'],[]).append(i)
ranking=[]
for strength in [0,.5,1]:
    estimates=old if strength==0 else np.maximum(0,np.expm1(log_old+strength*residual_prediction)/100);regrets=[]
    for indices in contexts.values():
        truth=np.asarray([rows[i]['local']+validation_cost[i] for i in indices])
        if len(indices)<2 or np.ptp(truth)<1e-8:continue
        selected=int(np.argmin([rows[i]['local']+estimates[i] for i in indices]));regrets.append(float(truth[selected]-min(truth)))
    ranking.append(dict(strength=strength,contexts=len(regrets),meanRegret=float(np.mean(regrets))))
provenance=dict(basePath=str(base_path),baseSha256=hashlib.sha256(base_bytes).hexdigest(),allRecordedBasePredictionsMatched=True,maxBasePredictionError=base_error,
    teacherPlanSha256=hashlib.sha256((root/'plan.json').read_bytes()).hexdigest(),teacherRunSha256=hashlib.sha256((root/'run.json.gz').read_bytes()).hexdigest(),records=records,rows=len(rows),omittedShorterNonterminalHorizons=omitted,
    trainerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
penalty=max(1,float(np.quantile(finite,.99))*2);fitted=model().fit(X,np.log1p(100*costs(range(len(rows)),penalty))-log_old)
indices=np.linspace(0,len(X)-1,32,dtype=int);residuals=fitted.predict(X[indices])
for strength in [.5,1]:
    deployed=artifact(fitted,strength);deployed['provenance']=provenance;write(out/f'policy-{strength:g}.json',deployed)
    expected=np.maximum(0,np.expm1(log_old[indices]+strength*residuals)/100)
    write(out/f'parity-{strength:g}.json',[dict(features=features[i].tolist(),prediction=float(value)) for i,value in zip(indices,expected)])
validation=dict(provenance=provenance,folds=folds,ranking=ranking,note='Five folds hold out complete catalog groups. The frozen prior remains development-trained. Labels include terminal priors; this is predictor validation, not independent compiler qualification. The extra input is the frozen prior prediction, derived only from physical features.')
write(out/'validation.json',validation);print(json.dumps(dict(out=str(out),ranking=ranking,rows=len(rows))),flush=True)
