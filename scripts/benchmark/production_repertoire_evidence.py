"""Compact the completed repertoire campaign without rerunning or filtering cases.

Run from the repository root after qualification and music rendering finish:
    python3 scripts/benchmark/production_repertoire_evidence.py
Large raw artifacts remain local. This report does not define benchmark scores.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
from statistics import median

ROOT = Path('generated/production-repertoire')
OUT = Path('docs/evidence')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--benchmarks-only', action='store_true', help='Report qualification before video rendering finishes.')
args = parser.parse_args()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    assert sha(path) == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(path.read_text())


def artifact(path):
    return {'path': str(path), 'sha256': sha(path)}


def distribution(values):
    values = sorted(v for v in values if isinstance(v, (float, int)) and math.isfinite(v))
    assert values
    return {'n': len(values), 'min': values[0], 'median': median(values),
            'p90': values[math.ceil(.9*len(values))-1], 'max': values[-1], 'sum': sum(values)}


def save(name, data):
    data['analysisScript'] = artifact(Path(__file__))
    path = OUT / ('production-repertoire-' + name + '-20261001.json')
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    Path(str(path) + '.sha256').write_text(sha(path) + '\n')
    print(path)


catalog = json.load(gzip.open('benchmark/v5/catalog.json.gz', 'rt'))
cases = {c['id']: c for c in catalog['cases']}
row_keys = ['id', 'seed', 'sourceId', 'panel', 'family', 'score', 'musicalScore',
            'valid', 'fulfilled', 'requested', 'trackHash', 'physicalFrames',
            'compileMs', 'judgeMs', 'executionError', 'constructionFailure']
baseline = read(ROOT / 'v5-baseline/run.json')

for split, directory, count in [('canonical', 'v5-qualified', 150),
                                 ('confirmation', 'v5-confirmation-qualified', 80)]:
    path = ROOT / directory / 'run.json'
    run = read(path)
    assert len(run['rows']) == count and run['plan']['profile'] == split
    assert run['executionErrors'] == 0
    rows = run['rows']
    diagnostics = {}
    for panel in ['fixed', 'automatic']:
        selected = [r for r in rows if r['panel'] == panel]
        choices, transitions, errors, misses, worst = {}, {}, {}, [], {}
        for row in selected:
            case = cases[row['id']]
            requests = case['plans'][str(row['seed'])]['requests']
            scored = set(case['scoredSections'][str(row['seed'])])
            realized = {r['section']: r for r in row['realization']['sections']}
            label = lambda r: r['construction'] + ':' + r['guidance']
            for request in requests:
                i = request['section']
                if i not in scored:
                    continue
                r = realized[i]
                key = label(request)
                item = choices.setdefault(key, {'requestedSupports': 0, 'requestedFrames': 0,
                    'locallyFulfilledSupports': 0, 'fulfilledOnValidRides': 0,
                    'supportsWithGuideContact': 0})
                item['requestedSupports'] += 1
                item['requestedFrames'] += request['next'] - request['frame']
                item['locallyFulfilledSupports'] += int(r['fulfilled'])
                item['fulfilledOnValidRides'] += int(row['valid'] and r['fulfilled'])
                item['supportsWithGuideContact'] += int(r['guideContactFrames'] > 0)
                if not r['fulfilled']:
                    misses.append({'id': row['id'], 'seed': row['seed'], 'section': i,
                                   'request': key, 'reasons': r['reasons']})
                if i:
                    edge = label(requests[i-1]) + ' → ' + key
                    t = transitions.setdefault(edge, {'requestedEntries': 0, 'fulfilledEntriesOnValidRides': 0})
                    t['requestedEntries'] += 1
                    t['fulfilledEntriesOnValidRides'] += int(row['valid'] and r['fulfilled'])
            if not row['valid']:
                continue
            for observation in row['observations']:
                # An impact belongs to the support at the end of its gap.
                i = observation['gap'] + int(observation['axis'] == 'impact')
                if i not in scored or i >= len(requests):
                    continue
                key = label(requests[i]) + '/' + observation['axis']
                item = errors.setdefault(key, {'observations': 0, 'weight': 0, 'squaredErrorSum': 0})
                weight = 1 if observation['axis'] == 'impact' else observation['endFrame'] - observation['startFrame'] + 1
                item['observations'] += 1
                item['weight'] += weight
                item['squaredErrorSum'] += weight * observation['error'] ** 2
                axis = observation['axis']
                passage = {'id': row['id'], 'seed': row['seed'], 'section': i,
                           'request': label(requests[i]), **observation}
                worst[axis] = sorted([*worst.get(axis, []), passage],
                                     key=lambda p: abs(p['error']), reverse=True)[:5]
        for item in errors.values():
            item['rms'] = math.sqrt(item['squaredErrorSum'] / item['weight'])
        diagnostics[panel] = {'choices': choices, 'transitions': transitions, 'errorsByConstructionAndAxis': errors,
            'worstPassagesByAxis': worst,
            'requestMisses': misses, 'work': distribution([r['physicalFrames'] for r in selected]),
            'compileMs': distribution([r['compileMs'] for r in selected]),
            'judgeMs': distribution([r['judgeMs'] for r in selected])}
    evidence = {'schema': 'line.production-repertoire-qualification.v1', 'raw': artifact(path),
        'plan': run['plan'], 'summary': run['summary'], 'executionErrors': run['executionErrors'],
        'interpretation': {'errors': 'Descriptive association on valid rides only, limited to scored sections. Frame-weighted per axis; impacts weighted one each. This is not a causal shape comparison.',
            'distribution': 'Requested duration includes the physical outro; counts are not musical-time quotas. Local fulfillment on a failed ride does not earn V5 credit.',
            'runtime': 'Cold compiler function-call time under concurrent benchmark/render load; excludes process startup, preceding imports and independent judging.'},
        'diagnostics': diagnostics, 'rows': [{k: r.get(k) for k in row_keys} for r in rows]}
    if split == 'canonical':
        before = {(r['id'], r['seed']): r for r in baseline['rows']}
        deltas = [r['score']-before[r['id'], r['seed']]['score'] for r in rows]
        evidence['baseline'] = {'raw': artifact(ROOT / 'v5-baseline/run.json'), 'summary': baseline['summary'],
            'headlineGain': run['summary']['headline']-baseline['summary']['headline'],
            'actualPhysicsFrames': {'before': sum(r['physicalFrames'] for r in baseline['rows']),
                                   'after': sum(r['physicalFrames'] for r in rows)},
            'pairedRows': {'improved': sum(d > 1e-8 for d in deltas), 'regressed': sum(d < -1e-8 for d in deltas),
                           'unchanged': sum(abs(d) <= 1e-8 for d in deltas)},
            'worstPairedRegressions': sorted([
                {'id': r['id'], 'seed': r['seed'], 'before': before[r['id'], r['seed']]['score'],
                 'after': r['score'], 'delta': delta} for r, delta in zip(rows, deltas) if delta < -1e-8
            ], key=lambda r: r['delta'])[:5]}
    save('v5-' + split, evidence)

path = ROOT / 'v4-qualified/run.json'
v4, previous = read(path), read(ROOT / 'v4-ordinary/run.json')
assert len(v4['rows']) == 352
previous_rows = {(r['sourceId'], r['seed']): r for r in previous['rows']}
save('v4-qualified', {'raw': artifact(path), 'plan': v4['plan'], 'summary': v4['summary'],
    'previous': artifact(ROOT / 'v4-ordinary/run.json'),
    'identicalScores': all(r['score'] == previous_rows[r['sourceId'], r['seed']]['score'] for r in v4['rows']),
    'identicalTracks': all(r['trackHash'] == previous_rows[r['sourceId'], r['seed']]['trackHash'] for r in v4['rows'])})

if args.benchmarks_only:
    raise SystemExit(0)

library = ROOT / 'library-qualified'
collection = read(library / 'collection.json')
assert len(collection['entries']) == 12
entries = []
for entry in collection['entries']:
    directory = library / entry['id']
    manifest = read(directory / 'manifest.json')
    cells = []
    for cell in manifest['cells']:
        video = read(directory / (cell['id'] + '.video.json'))
        assert video['identity']['cellSha256'] == cell['sha256']
        assert video['identity']['planSha256'] == manifest['planSha256']
        media = []
        for kind in ['full', 'excerpt']:
            item = video[kind]
            file = (directory / item['path']).resolve()
            assert sha(file) == item['sha256']
            stream = next(s for s in item['probe']['streams'] if s['codec_type'] == 'video')
            assert (stream['width'], stream['height'], stream['avg_frame_rate']) == (1080, 1920, '60/1')
            assert any(s['codec_type'] == 'audio' for s in item['probe']['streams'])
            if kind == 'full':
                expected = (manifest['plan']['cases'][0]['durationFrames'] + 20) / 40
                assert abs(float(stream['duration']) - expected) < 1/60 + 1e-6
            media.append({'kind': kind, 'path': str(file.relative_to(Path.cwd())), 'sha256': item['sha256'],
                          'duration': float(item['probe']['format']['duration']), 'videoDuration': float(stream['duration'])})
        assert video['decodedWithoutErrors'] and video['normalLinesOnly'] and video['geometryUnchangedByProductionPipeline']
        choices = {}
        if 'production' in cell:
            production = cell['production']
            realized = {r['section']: r for r in production['realization']['sections']}
            for request in production['plan']['requests'][1:]:
                key = request['construction'] + ':' + request['guidance']
                item = choices.setdefault(key, {'supports': 0, 'frames': 0, 'fulfilled': 0})
                item['supports'] += 1
                item['frames'] += request['next'] - request['frame']
                item['fulfilled'] += int(realized[request['section']]['fulfilled'])
        cells.append({'id': cell['id'], 'method': cell['method'], 'score': cell['score']['score'],
            'valid': cell['valid'], 'trackHash': cell['trackHash'], 'physicalFrames': cell['physicalFrames'],
            'compileMs': cell['compileMs'], 'media': media, 'reusedFrom': video.get('reusedFrom'),
            'qualified': cell.get('production', {}).get('qualified'), 'choices': choices,
            'realization': {k: cell.get('production', {}).get('realization', {}).get(k) for k in ['requested', 'fulfilledSections']}})
    entries.append({'id': entry['id'], 'settings': entry['settings'], 'manifest': artifact(directory / 'manifest.json'),
                    'processElapsedMs': manifest['processElapsedMs'], 'accounting': manifest['sets'], 'cells': cells})
save('music-library', {'schema': 'line.production-repertoire-music-evidence.v1',
    'plan': read(library / 'collection-plan.json'), 'entries': entries,
    'uniqueFullVideoHashes': len({c['media'][0]['sha256'] for e in entries for c in e['cells']}),
    'visualApproval': None})

browser_path = ROOT / 'production-final-browser.json'
browser = json.loads(browser_path.read_text())
assert not browser['errors']
assert len([c for c in browser['checks'] if c.get('nativeReplay')]) == 12
compiler_tests = ROOT / 'qualified-tests.txt'
render_tests = ROOT / 'render-resource-tests.txt'
assert '30 passed (30)' in compiler_tests.read_text()
assert '4 passed (4)' in render_tests.read_text()
typecheck = ROOT / 'tsc-delivery.txt'
assert typecheck.read_bytes() == (ROOT / 'tsc-qualified.txt').read_bytes()
evidence_inputs = ['api-check.json', 'playback-check.json', 'audio-identity-browser.json',
                   'render-cache-equivalence.json', 'render-resume-check.json', 'production-final-browser.json']
delivery_identity_path = ROOT / 'delivery-compiler-identity.json'
delivery_identity = json.loads(delivery_identity_path.read_text())
for directory in ['v5-qualified', 'v5-confirmation-qualified']:
    assert delivery_identity['candidateFingerprint'] == read(ROOT / directory / 'run.json')['plan']['compiler']['candidateFingerprint']
# V4 retains its older identity schema, with explicit source-file hashes.
assert all(sha(Path(path)) == digest for path, digest in v4['plan']['compiler']['files'].items())
assert delivery_identity['engineArtifactFingerprint'] == v4['plan']['compiler']['engineSha256']
save('validation', {'schema': 'line.production-repertoire-validation.v1',
    'deliveredCompiler': {'raw': artifact(delivery_identity_path), 'matchesQualifiedCompiler': True,
        **{k: delivery_identity[k] for k in ['head', 'compilerSourceFingerprint', 'engineArtifactFingerprint', 'candidateFingerprint']}},
    'compilerTests': {'raw': artifact(compiler_tests), 'files': 13, 'passed': 30},
    'renderTests': {'raw': artifact(render_tests), 'files': 2, 'passed': 4,
                    'overlap': 'Includes the already-tested spectrum-cache case; three new resource tests.'},
    'typecheck': {'raw': artifact(typecheck), 'previous': artifact(ROOT / 'tsc-qualified.txt'),
                  'passes': False, 'diagnosticsIdentical': True, 'errors': typecheck.read_text().count('error TS')},
    'checks': {name: {'raw': artifact(ROOT / name), 'result': json.loads((ROOT / name).read_text())}
               for name in evidence_inputs}})
