# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""exp/retrain-v3: rebuild the construction policies and memory from
demonstrations harvested from the line.strike.v3 production compiler on
benchmark/v4 cases disjoint from the evaluation songs
(tools/research/value_collect.ts, field `construction`).

  uv run --offline tools/research/train_construction_v3.py --inputs=generated/value-v3/collect-1 --out=generated/value-v3/construction-1

Selection, grouping and dedupe follow archive build_construction_examples.ts;
the proximity forests follow archive train_construction_retrieval.py
(32 trees, leaf 4, seed 261001); packing follows pack_construction_search_model.py
with memory = the same demonstrations (every memory entry references a policy
exemplar). Writes the pointer JSON and its gzip companion in the runtime format."""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.ensemble import ExtraTreesRegressor

p = argparse.ArgumentParser(); p.add_argument('--inputs', required=True); p.add_argument('--out', required=True)
p.add_argument('--trees', type=int, default=32); p.add_argument('--leaf', type=int, default=4)
args = p.parse_args(); out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
EVAL_SONGS = ('luna', 'amor', 'tiki', 'amour'); REQUIRED = ('entry', 'turn', 'exit', 'support', 'bias', 'offset')
groups, seen, sources = {}, set(), []
for root in args.inputs.split(','):
    for path in sorted(Path(root).glob('*.json.gz')):
        b = path.read_bytes(); d = json.loads(gzip.decompress(b))
        assert not any(s in d['id'].lower() for s in EVAL_SONGS)
        if not isinstance(d.get('construction'), list): continue
        accepted = 0
        for row in d['construction']:
            c = row['control']; f = row['features']
            if not (row['key'] and row['context'] and row['fulfilled'] and c and f and len(f) == 57 and np.isfinite(f).all()
                    and np.isfinite(row['incoming']) and row['span'] > 0 and all(np.isfinite(c.get(k, np.nan)) for k in REQUIRED)
                    and all(isinstance(v, (int, float)) and np.isfinite(v) for v in c.values())): continue
            example = {'control': c, 'incoming': row['incoming'], 'span': row['span'], 'features': f}
            identity = hashlib.sha256(json.dumps([row['key'], example], separators=(',', ':')).encode()).hexdigest()
            if identity in seen: continue
            seen.add(identity); groups.setdefault(row['key'], []).append(example); accepted += 1
        sources.append({'file': path.name, 'id': d['id'], 'group': d['group'], 'seed': d['seed'], 'complete': d['complete'], 'accepted': accepted,
            'sha256': hashlib.sha256(b).hexdigest()})
policies, memory, sizes = {}, {}, {}
for key, rows in groups.items():
    if len(rows) < 2 * args.leaf: continue
    features = np.asarray([r['features'] for r in rows], dtype=np.float32)
    fields = sorted(set().union(*(r['control'].keys() for r in rows))); targets = []
    for row in rows:
        vector = []
        for field in fields:
            value = row['control'].get(field, 0)
            if field in ('entry', 'exit'): value -= row['incoming']
            elif field == 'support': value /= row['span']
            vector.extend([value, float(field in row['control'])])
        targets.append(vector)
    targets = np.asarray(targets); scales = np.maximum(.02, targets.std(axis=0))
    forest = ExtraTreesRegressor(n_estimators=args.trees, max_depth=12, min_samples_leaf=args.leaf, max_features=.8, random_state=261001, n_jobs=4)
    forest.fit(features, targets / scales); memberships = forest.apply(features)
    trees = [dict(left=e.tree_.children_left.tolist(), right=e.tree_.children_right.tolist(), feature=e.tree_.feature.tolist(),
        threshold=e.tree_.threshold.tolist()) for e in forest.estimators_]
    exemplars = [dict(features=r['features'], target=[], controlReference={k: r[k] for k in ('control', 'incoming', 'span')},
        proximityLeaves=memberships[i].tolist()) for i, r in enumerate(rows)]
    policies[key] = dict(featureSchema='line.arc-control-policy-features.v1', featureCount=57, proximityTrees=trees, exemplars=exemplars)
    memory[key] = list(range(len(rows)))
    sizes[key] = len(rows)
model = {'schema': 'line.construction-policies.v1', 'groups': policies, 'memoryGroups': memory,
    'provenance': {'seed': 261001, 'trees': args.trees, 'leaf': args.leaf, 'trainer': 'tools/research/train_construction_v3.py',
        'trainerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'impactContract': 'line.strike.v3',
        'catalog': 'benchmark/v4 excluding groups luna_bala, amor_na_praia, tiki_tiki, amour_de_ma_vie', 'evalPanelDisjoint': True,
        'examples': len(seen), 'groups': sizes, 'sources': sources,
        'note': 'Demonstrations are the committed controls of fulfilled sections from compiles that used the previous construction artifact as their proposal source.'}}
raw = (json.dumps(model, separators=(',', ':')) + '\n').encode(); packed = gzip.compress(raw, compresslevel=9, mtime=0)
(out / 'repertoire_policy_model.json.gz').write_bytes(packed)
pointer = {'schema': 'line.arc-compressed-policy.v1', 'compression': 'gzip-file', 'file': 'repertoire_policy_model.json.gz',
    'compressedSha256': hashlib.sha256(packed).hexdigest(), 'sha256': hashlib.sha256(raw).hexdigest(), 'uncompressedBytes': len(raw),
    'provenance': {'policyTraining': 'tools/research/train_construction_v3.py', 'collector': 'tools/research/value_collect.ts',
        'evidence': 'embedded in the archive (provenance field)'}}
(out / 'repertoire_policy_model.json').write_text(json.dumps(pointer, indent=2) + '\n')
print(json.dumps({'examples': len(seen), 'groups': sizes, 'bytes': len(packed), 'uncompressed': len(raw), 'sources': len(sources)}))
