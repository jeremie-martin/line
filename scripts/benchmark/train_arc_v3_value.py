# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Distill logged continuation search values with family-disjoint checks.

Labels include the teacher's terminal heuristic/value prior after the simulated
intervals. They are bootstrapped search values, not pure measured benchmark loss.
"""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from train_physical_planner import export, write

p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--out',required=True);p.add_argument('--folds',type=int,default=5);args=p.parse_args()
root=Path(args.inputs);out=Path(args.out);out.mkdir(parents=True,exist_ok=True);assert not (out/'model.json').exists()
def checked(path):
    b=path.read_bytes();assert hashlib.sha256(b).hexdigest()==Path(str(path)+'.sha256').read_text().strip()
    return json.loads(gzip.decompress(b) if path.suffix=='.gz' else b)
plan=checked(root/'plan.json');run=checked(root/'run.json.gz');assert plan['options']['collectValue'];assert run['summary']['valid']==88
# Read the frozen materialized catalog for group identities, not runtime features.
specs=json.loads(gzip.decompress(Path('benchmark/v3/specifications.json.gz').read_bytes()))
cases=specs if isinstance(specs,list) else specs['cases']
groups_by_source={c['id']:c['group'] for c in cases}
rows=[];records=[];omitted=0
for source in plan['sources']:
    path=root/(source+'.json.gz');record=checked(path);records.append(dict(source=source,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    for index,row in enumerate(record['rows']):
        for probe in (row.get('lookahead') or {}).get('probes',[]):
            features=probe.get('valueFeatures')
            if features is None:continue
            # A shorter successful nonterminal horizon is a different label.
            if probe['futureCost'] is not None and probe['depth']<2 and features[52]>0:
                omitted+=1;continue
            assert len(features)==57 and np.isfinite(features).all()
            rows.append(dict(source=source,group=groups_by_source[source],context=f'{source}:{index}',features=features,
                future=probe['futureCost'],local=probe['localCost'],old=probe['predictedFuture']))
X=np.array([r['features'] for r in rows]);groups=np.array([r['group'] for r in rows])
finite=np.array([r['future'] for r in rows if r['future'] is not None]);penalty=max(1.,float(np.quantile(finite,.99))*2)
costs=np.array([max(0.,r['future']) if r['future'] is not None else penalty for r in rows]);predictions=np.zeros(len(rows));validation_costs=costs.copy()
def model():return HistGradientBoostingRegressor(max_iter=180,max_leaf_nodes=31,min_samples_leaf=40,learning_rate=.06,l2_regularization=1,early_stopping=False,random_state=260909)
def artifact(fitted,invalid):return dict(schema='line.arc-future-value-model.v1',featureSchema='line.arc-future-value-features.v1',featureCount=57,
    target='log1p(100 * nonnegative two-interval search value including terminal prior)',invalidCost=invalid,model=export(fitted,'expm1_div_100'))
folds=[]
for fold,(train,test) in enumerate(GroupKFold(args.folds).split(X,costs,groups) if args.folds else []):
    train_finite=[rows[i]['future'] for i in train if rows[i]['future'] is not None];invalid=max(1.,float(np.quantile(train_finite,.99))*2)
    train_cost=np.array([max(0.,rows[i]['future']) if rows[i]['future'] is not None else invalid for i in train])
    validation_costs[test]=[max(0.,rows[i]['future']) if rows[i]['future'] is not None else invalid for i in test]
    fitted=model().fit(X[train],np.log1p(100*train_cost));predictions[test]=np.maximum(0.,np.expm1(fitted.predict(X[test]))/100)
    write(out/f'fold-{fold}.json',artifact(fitted,invalid))
    folds.append(dict(fold=fold,heldGroups=sorted(set(groups[test])),train=len(train),test=len(test),mae=float(np.mean(np.abs(predictions[test]-validation_costs[test])))))
    print(json.dumps(folds[-1]),flush=True)
contexts={}
for i,row in enumerate(rows):contexts.setdefault(row['context'],[]).append(i)
ranking=[]
if args.folds:
    for context,indices in contexts.items():
        truth=np.array([rows[i]['local']+validation_costs[i] for i in indices])
        if len(indices)<2 or float(np.ptp(truth))<1e-8:continue
        new=int(np.argmin([rows[i]['local']+predictions[i] for i in indices]));old=int(np.argmin([rows[i]['local']+rows[i]['old'] for i in indices]))
        ranking.append(dict(context=context,new=float(truth[new]-min(truth)),old=float(truth[old]-min(truth))))
fitted=model().fit(X,np.log1p(100*costs));deployed=artifact(fitted,penalty)
deployed['provenance']=dict(teacherPlanSha256=hashlib.sha256((root/'plan.json').read_bytes()).hexdigest(),records=records,rows=len(rows),groups=len(set(groups)),
    negativeBoundaryCorrectionsClipped=int(sum(finite<0)),omittedShorterNonterminalHorizons=omitted,
    note='Exposed V3 development training. Labels include the teacher terminal prior, not just measured interval loss. Family-disjoint checks concern this predictor only; the teacher compiler already contains development-trained models. No independent end-to-end generalization claim.')
write(out/'model.json',deployed)
write(out/'parity.json',[dict(features=X[i].tolist(),prediction=max(0.,float(np.expm1(fitted.predict(X[i:i+1])[0]))/100)) for i in np.linspace(0,len(X)-1,32,dtype=int)])
write(out/'validation.json',dict(rows=len(rows),groups=len(set(groups)),folds=folds,comparedContexts=len(ranking),
    newMeanRegret=float(np.mean([r['new'] for r in ranking])) if ranking else None,oldMeanRegret=float(np.mean([r['old'] for r in ranking])) if ranking else None,
    provenance=deployed['provenance'],ranking=ranking))
print(json.dumps(dict(rows=len(rows),groups=len(set(groups)),out=str(out))),flush=True)
