# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Distill measured future arc costs with parent-disjoint validation."""
import argparse
import json
from pathlib import Path
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from train_physical_planner import checked, digest, export, write

parser = argparse.ArgumentParser()
parser.add_argument('--inputs', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
source = Path(args.inputs); out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
if (out / 'model.json').exists(): raise ValueError('completed output exists')
plan = json.loads((source / 'plan.json').read_text()); checked(source / 'plan.json'); checked(source / 'summary.json')
assert plan['options']['collectValue'] and plan['options']['strictHorizon']
parents = {r['sourceId']: r['parentId'] or r['sourceId'] for r in json.loads(Path('benchmark/v2/studies/current-baseline-analysis.json').read_text())['caseStatistics']}
rows = []; provenance = []
for source_id in plan['sourceIds']:
    p = source / (source_id + '.json'); provenance.append(dict(path=str(p), sha256=checked(p)))
    record = json.loads(p.read_text())
    for index, row in enumerate(record['rows']):
        for probe in (row.get('lookahead') or {}).get('probes', []):
            features = probe.get('valueFeatures')
            if features is None: continue
            assert len(features) == 57 and all(np.isfinite(features))
            rows.append(dict(source=source_id, parent=parents[source_id], context=f'{source_id}:{index}',
                features=features, future=probe['futureCost'], local=probe['localCost'], current=probe['currentCost']))
X = np.array([r['features'] for r in rows]); finite = np.array([r['future'] for r in rows if r['future'] is not None])
invalid_cost = max(1., float(np.quantile(finite, .99)) * 2)
costs = np.array([r['future'] if r['future'] is not None else invalid_cost for r in rows]); y = np.log1p(100 * costs)
groups = np.array([r['parent'] for r in rows]); predictions = np.zeros(len(rows)); validation_costs = costs.copy(); assignments = {}; metrics = []
def model():
    return HistGradientBoostingRegressor(max_iter=120, max_leaf_nodes=15, min_samples_leaf=40,
        learning_rate=.07, l2_regularization=1, early_stopping=False, random_state=260908)
def artifact(fitted, penalty=invalid_cost):
    return dict(schema='line.arc-future-value-model.v1', featureSchema='line.arc-future-value-features.v1',
        featureCount=57, target='log1p(100 * measured two-interval continuation cost)',
        invalidCost=penalty, model=export(fitted, 'expm1_div_100'))
for fold, (train, test) in enumerate(GroupKFold(n_splits=5).split(X, y, groups)):
    # A held-out parent must not influence even the infeasible-target penalty.
    train_finite = [rows[i]['future'] for i in train if rows[i]['future'] is not None]
    penalty = max(1., float(np.quantile(train_finite, .99)) * 2)
    train_costs = np.array([rows[i]['future'] if rows[i]['future'] is not None else penalty for i in train])
    validation_costs[test] = [rows[i]['future'] if rows[i]['future'] is not None else penalty for i in test]
    fitted = model().fit(X[train], np.log1p(100 * train_costs)); predictions[test] = np.maximum(0, np.expm1(fitted.predict(X[test])) / 100)
    held = sorted(set(groups[test])); metrics.append(dict(fold=fold, train=len(train), test=len(test), heldParents=held,
        invalidCostFromTrainingParents=penalty, meanAbsoluteCostError=float(np.mean(np.abs(predictions[test] - validation_costs[test])))))
    write(out / f'fold-{fold}.json', artifact(fitted, penalty))
    for row in test: assignments[rows[row]['source']] = fold
    print(json.dumps(metrics[-1]), flush=True)
contexts = {}
for i, row in enumerate(rows): contexts.setdefault(row['context'], []).append(i)
ranking = []
for context, indices in contexts.items():
    truth = [rows[i]['local'] + validation_costs[i] for i in indices]
    if len(indices) < 2 or max(truth) - min(truth) < 1e-8: continue
    predicted = int(np.argmin([rows[i]['local'] + predictions[i] for i in indices]))
    current = int(np.argmin([rows[i]['current'] for i in indices]))
    ranking.append(dict(context=context, learnedRegret=truth[predicted]-min(truth), currentOnlyRegret=truth[current]-min(truth)))
fitted = model().fit(X, y); deployed = artifact(fitted); deployed['provenance'] = dict(teacherPlanSha256=digest(source/'plan.json'), records=provenance, rows=len(rows), parents=len(set(groups)), validation='five folds with complete parents and their variants held out together')
write(out/'model.json', deployed); write(out/'assignments.json', assignments)
write(out/'parity.json', [dict(features=X[i].tolist(), prediction=max(0., float(np.expm1(fitted.predict(X[i:i+1])[0])) / 100)) for i in np.linspace(0,len(X)-1,32,dtype=int)])
write(out/'validation.json',dict(schema='line.arc-future-value-validation.v1', researchOnly=True, rows=len(rows), validRows=len(finite), parents=len(set(groups)), invalidCost=invalid_cost,
    meanAbsoluteCostError=float(np.mean(np.abs(predictions-validation_costs))), folds=metrics, comparedContexts=len(ranking),
    learnedMeanRegret=float(np.mean([r['learnedRegret'] for r in ranking])), currentOnlyMeanRegret=float(np.mean([r['currentOnlyRegret'] for r in ranking])),
    note='Offline ranking on teacher shortlists, with parent-disjoint predictions. This is not a live compiler score or independent canonical evaluation.',ranking=ranking))
print('Completed future-value model and parent-disjoint validation.',flush=True)
