"""Bind final Arc 825 validation to checked local artifacts; no scoring changes.

Run from the repository root after restoring the local campaign archive:
    python scripts/benchmark/analyze_arc825.py
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path('generated/benchmark-v2/arc-825')
artifacts = {}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked(name):
    path = ROOT / name
    sha = digest(path)
    assert sha == Path(str(path) + '.sha256').read_text().strip().split()[0], path
    artifacts[name] = {'sha256': sha, 'bytes': path.stat().st_size}
    return json.loads(path.read_text())


def metered_runs(archive, count):
    runs = archive['runs']
    assert len(runs) == count
    assert all(r['status'] == 'ok' and r['score']['valid'] for r in runs)
    assert all(r['stats']['sim_frames'] <= r['task']['budget'] for r in runs)
    return {'valid': count, 'runs': count, 'sources': len(archive['sources']),
            'distinctTracks': len({r['trackHash'] for r in runs}),
            'maxFrames': max(r['stats']['sim_frames'] for r in runs),
            'totalFrames': sum(r['stats']['sim_frames'] for r in runs)}


prior = json.loads(Path('benchmark/v2/studies/compiler-integrity-audit-validation.json').read_text())
canonical = checked('final-canonical.md.N8.json')
comparison = checked('final-canonical.md.comparison.json')
qualification = checked('final-qualification.json')
geometry = checked('final-geometry-audit.json')
protected = checked('protected-file-check.json')
jitter = checked('final-jitter/summary.json')
folds = checked('final-held-families.json')
low = checked('final-150k/summary.json')
high = checked('final-1m/summary.json')
videos = checked('final-videos.json')
assert comparison['outcome'] == 'accept' and comparison['promotable']
assert canonical['canonicalHeadline'] == 828.1228 >= 825
assert comparison['candidate']['archiveSha256'] == artifacts['final-canonical.md.N8.json']['sha256']
assert qualification['linkedDevelopment']['sha256'] == comparison['candidate']['archiveSha256']
assert geometry['archiveSha256'] == comparison['candidate']['archiveSha256']
for archive in (canonical, qualification):
    assert all(archive['identity'][k] == v for k, v in prior['fixedIdentity'].items())
    assert archive['git']['candidateFingerprint'] == comparison['candidate']['snapshot']['candidateFingerprint']
assert not protected['unexpectedChanges']
assert protected['judgeSha256'] == canonical['git']['engineArtifactFingerprint']
assert canonical['identity']['budgets'] == [750000]
assert canonical['identity']['seedSchedule']['byBudget'][0]['actualSeeds'] == list(range(16, 24))
canon_stats = metered_runs(canonical, 352)
qual_stats = metered_runs(qualification, 120)
assert canon_stats['sources'] == canon_stats['distinctTracks'] == 44
assert all(sum(r['task']['sourceId'] == s['id'] for r in canonical['runs']) == 8 for s in canonical['sources'])
assert jitter['cells'] == jitter['valid'] == jitter['distinctTracks'] == 176
assert jitter['maxFrames'] <= 750000 and not jitter['failures']
assert folds['summary']['validRuns'] == folds['summary']['totalRuns'] == 44
assert len(folds['models']) == 5
assert all(not set(m['heldParents']).intersection(m['trainingParents']) for m in folds['models'])
assert geometry['sources'] == 44 and geometry['canonicalRuns'] == 352 and geometry['allNormal']
assert geometry['shortestChain'] >= 10
assert all(r['reportMatches'] and r['scoreMatches'] and r['framesMatch'] for r in geometry['rows'])
assert low['score']['score'] == prior['lowBudget150k']['final']['score']
assert low['valid'] == prior['lowBudget150k']['final']['valid'] == 41
assert low['maxFrames'] <= 150000 and high['maxFrames'] <= 1000000 and high['valid'] == 44

test_log = ROOT / 'final-frozen-tests.log'
test_text = test_log.read_text()
assert re.search(r'Test Files\s+13 passed \(13\)', test_text)
assert re.search(r'Tests\s+51 passed \(51\)', test_text)
ts_before = (ROOT / 'final-typescript.log').read_text()
ts_after = (ROOT / 'completion-typescript.log').read_text()
assert ts_before == ts_after
assert len(re.findall(r'error TS\d+:', ts_after)) == 251
model_path = Path('scripts/v0/optimizer/arc_control_policy_model.json')
model = json.loads(model_path.read_text())
assert model['featureCount'] == 57 and len(model['trees']) == 32
assert model['provenance']['rows'] == 4056 and len(model['provenance']['trainingParents']) == 21
assert len(videos['records']) == 3
for video in videos['records']:
    review = json.loads((Path(video['video']).parent / 'review.json').read_text())
    assert digest(Path(video['video'])) == video['videoSha256'] == review['videoSha256']
    assert review['gitSha'] == canonical['git']['head'] and review['validated']
    assert all(digest(Path(p)) == sha for p, sha in review['implementation'].items())
    assert video['allNormal'] and video['physicsFrames'] <= video['budget'] == 1000000
    assert video['metrics']['contractPassed'] and video['metrics']['reachedEnd']
    assert all(Path(p).exists() for p in video['inspectedFrames'])

result = {
    'schema': 'line.arc-825-validation.v1', 'date': '2026-09-09',
    'branch': 'codex/arc-825', 'referenceCommit': protected['referenceCommit'],
    'compilerCommit': canonical['git']['head'], 'decision': 'promoted arc-control-policy',
    'constraint': 'Coherent substantial normal type-0 curves; fixed benchmark, scorer, targets, detector, physics and actual-frame accounting.',
    'compilerIdentity': {k: canonical['git'][k] for k in ('candidateFingerprint', 'compilerSourceFingerprint', 'engineArtifactFingerprint')},
    'fixedIdentity': prior['fixedIdentity'], 'protectedFiles': protected,
    'canonical': {**canon_stats, 'headline': canonical['canonicalHeadline'], 'referenceHeadline': comparison['decision']['base']['headline'],
                  'delta': round(canonical['canonicalHeadline'] - comparison['decision']['base']['headline'], 4),
                  'budget': 750000, 'seeds': list(range(16, 24)), 'jitter': 0,
                  'sequential': comparison['sequential'],
                  'note': '44 distinct geometries repeated across eight zero-jitter seeds; not 352 independent geometries.',
                  'specifications': canonical['developmentSummaries'][0]['specifications']},
    'qualification': {**qual_stats, 'monitorScore': qualification['qualificationMonitorScore'],
                      'byBudget': qualification['qualificationSummaries'],
                      'note': 'Reused regression panel after budget diagnosis; not a fresh holdout or promotion veto.'},
    'jitter': {**jitter, 'jitter': 0.02, 'seeds': [101, 102, 103, 104],
               'note': 'Unweighted cell mean; separate robustness research, not the canonical headline.'},
    'heldFamilies': folds, 'geometry': geometry,
    'lowBudget150k': low, 'oneMillion': high,
    'model': {'path': str(model_path), 'sha256': digest(model_path), 'bytes': model_path.stat().st_size,
              'features': model['featureCount'], 'trees': len(model['trees']), 'provenance': model['provenance'],
              'inference': 'Float32 features matching training-library tree comparisons; all candidates physically evaluated.'},
    'tests': {'passed': 51, 'files': 13, 'logSha256': digest(test_log),
              'typecheck': {'command': 'npx tsc --noEmit --allowImportingTsExtensions --pretty false',
                            'existingDiagnostics': 251, 'newDiagnostics': 0,
                            'logSha256': digest(ROOT / 'completion-typescript.log')}},
    'videos': videos,
    'limitations': [
        'The deployed policy is trained on development-family teacher trajectories; five parent-excluded models are additional research evidence, not a fresh external holdout.',
        'Three inherited 150k invalid cases remain; the aggregate and validity match the accepted baseline.',
        '1M gains remain modest relative to 750k; broader high-budget scaling is not established by this campaign.',
        'All three rendered tracks have zero standing time and miss the original 2% creative-selection floor. These are full review renders, not creative-selection passes.',
        'Visual review covers sampled frames at 12s and 30s in each video, plus full decode validation; no whole-video perceptual review is claimed.',
        'Repository-wide TypeScript still has 251 pre-existing diagnostics. Legacy fallback budget overruns identified in the preceding audit are outside this arc-path change.'
    ],
    'localArtifacts': artifacts,
}
out = Path('benchmark/v2/studies/arc-825-validation.json')
body = (json.dumps(result, indent=2) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps({'headline': result['canonical']['headline'], 'delta': result['canonical']['delta'],
                  'valid': canon_stats['valid'], 'qualificationValid': qual_stats['valid'], 'output': str(out)}))
