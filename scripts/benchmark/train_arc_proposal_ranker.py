# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Predict measured proposal quality; hold complete development families out.

Labels come from ordinary physical searches, including failed proposals. The
runtime model ranks proposals only; it never certifies geometry or substitutes
for a physical evaluation. Offline metrics are equal-context diagnostics, not
benchmark headlines or claimed live improvements.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.model_selection import GroupKFold

p = argparse.ArgumentParser()
p.add_argument('--study', required=True)
p.add_argument('--out', required=True)
p.add_argument('--trees', type=int, default=32)
p.add_argument('--depth', type=int, default=18)
p.add_argument('--leaf', type=int, default=12)
p.add_argument('--folds', type=int, default=3)
args = p.parse_args()
assert args.trees >= 2 and args.depth > 0 and args.leaf > 0 and args.folds >= 2
root, out = Path(args.study), Path(args.out)
out.mkdir(parents=True, exist_ok=True)
assert not (out / 'model.json').exists()


def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


def write(path, value):
    body = (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()
    path.write_bytes(body)
    Path(str(path) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')


plan, plan_sha = checked(root / 'plan.json')
run, run_sha = checked(root / 'run.json.gz')
assert run['plan'] == plan and plan['suite'] == 'v4'
assert plan['options'] == {'collectProposals': True}
catalog_body = Path('benchmark/v4/specifications.json.gz').read_bytes()
catalog = json.loads(gzip.decompress(catalog_body))
assert hashlib.sha256(gzip.decompress(catalog_body)).hexdigest() == plan['judge']['inputSha256']
cases = {c['id']: c for c in catalog}
assert len(cases) == len(plan['sources']) == len(run['rows']) == 176
assert set(cases) == set(plan['sources'])
reference, reference_sha = checked(Path('benchmark/v4/runs/recovery.json.gz'))
baseline = {r['sourceId']: r for r in reference['rows'] if r['seed'] == plan['seed']}
summary_rows = {r['sourceId']: r for r in run['rows']}
blocks, labels, groups, context_indices, initial, raw_losses = [], [], [], [], [], []
contexts, sources = [], []
rejections = {}


def encode(c, incoming, span):
    assert not any(k in c for k in ['guideStart', 'guideEnd', 'exitBias', 'guideBend'])
    return [(c['entry'] - incoming) / 30, c['turn'] / 60,
            (c['exit'] - incoming) / 60, c['support'] / span,
            c['bias'], c['offset'], c.get('clearance', 12) / 12,
            c.get('turnFraction', min(5, c['support'] * .5) / c['support']),
            c.get('bend', 0) / 30, c.get('guideFlare', 0) / 8]


for source in plan['sources']:
    record, digest = checked(root / (source + '.json.gz'))
    assert record['planSha256'] == plan_sha and record['sourceId'] == source
    assert record['score'] == summary_rows[source]['score'] == baseline[source]['score']
    assert record['trackHash'] == summary_rows[source]['trackHash'] == baseline[source]['trackHash']
    assert record['resources']['physicalFrames'] == baseline[source]['resources']['physicalFrames']
    assert record['score']['valid']
    local_x, local_y, local_groups, local_context, local_initial, local_loss = [], [], [], [], [], []
    for context in record['proposalContexts']:
        # Startup has its own distribution and is not ranked by this experiment.
        if context['index'] == 0:
            continue
        assert len(context['features']) == 63 and context['span'] > 0
        proposals = context['proposals']
        assert proposals
        context_id = len(contexts)
        contexts.append(dict(source=source, index=context['index'], proposals=len(proposals)))
        refined = context.get('refined')
        rows = proposals + ([dict(**refined, reason=None)] if refined else [])
        for j, row in enumerate(rows):
            features = context['features'] + encode(row['control'], context['incoming'], context['span'])
            valid = row['reason'] is None
            assert valid == (row['loss'] is not None)
            loss = row['loss'] if valid else None
            if valid:
                assert np.isfinite(loss) and loss >= -1e-10
            else:
                rejections[row['reason']] = rejections.get(row['reason'], 0) + 1
            local_x.append(features)
            # Smooth quality on feasible proposals; rejection is a fixed worst
            # class. Clipping affects only this ranker, never the public score.
            local_y.append(min(2, np.sqrt(max(0, loss))) if valid else 2.)
            local_loss.append(loss if valid else np.nan)
            local_groups.append(cases[source]['parentId'])
            local_context.append(context_id)
            local_initial.append(j < len(proposals))
    blocks.append(np.asarray(local_x, dtype=np.float32))
    labels.extend(local_y)
    groups.extend(local_groups)
    context_indices.extend(local_context)
    initial.extend(local_initial)
    raw_losses.extend(local_loss)
    sources.append(dict(source=source, sha256=digest, contexts=len(record['proposalContexts']),
                        trackHash=record['trackHash'], exactReferenceParity=True))

X = np.concatenate(blocks)
del blocks
y, groups = np.asarray(labels), np.asarray(groups)
context_indices, initial = np.asarray(context_indices), np.asarray(initial)
raw_losses = np.asarray(raw_losses)
assert X.shape[1] == 73 and np.isfinite(X).all() and np.isfinite(y).all()
del labels
context_sizes = np.bincount(context_indices)
weights = 1 / context_sizes[context_indices]
weights /= np.mean(weights)
dataset = out / 'data.npz'
np.savez_compressed(dataset, X=X, y=y, groups=groups, contexts=context_indices,
                    initial=initial, raw_losses=raw_losses)
data_sha = hashlib.sha256(dataset.read_bytes()).hexdigest()
Path(str(dataset) + '.sha256').write_text(data_sha + '\n')
write(out / 'data-provenance.json', dict(
    schema='line.arc-proposal-measurements.v1', featureSchema='line.arc-proposal-features.v1',
    featureCount=73, rows=len(y), contexts=len(contexts), parents=len(set(groups)),
    study=str(root), planSha256=plan_sha, runSha256=run_sha,
    referenceSha256=reference_sha, dataSha256=data_sha, sources=sources,
    rejections=rejections, compiler=plan['compiler'],
    collectionScriptSha256=plan['scriptSha256'],
    trainerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    note='All 176 traced tracks, scores and charged physics frames match the frozen student reference. '
         'Proposal labels are direct measurements from that declared compiler. '
         'Inputs: 57 relative physical/next-target features, three prior targets, '
         'three measured prior axes, ten normalized controls. No case, parent, '
         'seed, contact index or absolute position is a runtime feature.'))


def fitted(indices):
    return ExtraTreesRegressor(n_estimators=args.trees, max_depth=args.depth,
        min_samples_leaf=args.leaf, max_features=.8, random_state=260910,
        n_jobs=4).fit(X[indices], y[indices], sample_weight=weights[indices])


predicted = np.zeros_like(y)
folds = []
for fold, (train, test) in enumerate(GroupKFold(args.folds).split(X, y, groups)):
    model = fitted(train)
    predicted[test] = model.predict(X[test])
    folds.append(dict(fold=fold, heldParents=sorted(set(groups[test])),
                      trainingRows=len(train), testRows=len(test)))
    print(json.dumps(folds[-1]), flush=True)

# Compare equal-sized selections from the exact same held-out initial pool.
# Refined outcomes are training examples but never candidates in this test.
metrics = {}
offsets = np.r_[0, np.cumsum(context_sizes)]
for count in [1, 4, 8, 16]:
    selections = {'original': [], 'ranked': [], 'oracle': []}
    feasible = {key: [] for key in selections}
    for context_id in range(len(contexts)):
        indices = np.arange(offsets[context_id], offsets[context_id + 1])
        indices = indices[initial[indices]]
        choices = dict(original=indices[:count],
                       ranked=indices[np.argsort(predicted[indices], kind='stable')[:count]],
                       oracle=indices[np.argsort(y[indices], kind='stable')[:count]])
        for key, chosen in choices.items():
            selections[key].append(float(np.min(y[chosen])))
            feasible[key].append(bool(np.isfinite(raw_losses[chosen]).any()))
    metrics[count] = {key: dict(meanBestClippedRootLoss=float(np.mean(values)),
                               fractionWithFeasible=float(np.mean(feasible[key])))
                      for key, values in selections.items()}
write(out / 'validation.json', dict(folds=folds, metrics=metrics,
    note='Equal-context development diagnostics with complete parent families held out. '
         'Candidates are the initial observed pool only. Refined actions are excluded from selection. '
         'These metrics do not measure a live rollout or a benchmark headline.'))
print(json.dumps(metrics), flush=True)
model = fitted(np.arange(len(y)))
trees = []
for estimator in model.estimators_:
    t = estimator.tree_
    trees.append(dict(left=t.children_left.tolist(), right=t.children_right.tolist(),
                      feature=t.feature.tolist(), threshold=t.threshold.tolist(),
                      value=t.value[:, 0, 0].tolist()))
write(out / 'model.json', dict(schema='line.arc-proposal-ranker.v1',
    featureSchema='line.arc-proposal-features.v1', featureCount=73, trees=trees,
    provenance=dict(dataSha256=data_sha, trees=args.trees, depth=args.depth, leaf=args.leaf,
                    trainingParents=sorted(set(groups)), rows=len(y))))
indices = np.linspace(0, len(y) - 1, 64, dtype=int)
write(out / 'parity.json', [dict(features=X[i].tolist(), value=float(v))
    for i, v in zip(indices, model.predict(X[indices]))])
print(json.dumps(dict(out=str(out), rows=len(y), contexts=len(contexts))), flush=True)
