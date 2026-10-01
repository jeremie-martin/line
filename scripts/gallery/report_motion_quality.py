"""Compact the read-only motion study and draw diagnostic figures (not scores)."""
import gzip
import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path('generated/motion-quality-20261001')
OUT = Path('docs/evidence')


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def read(p):
    assert sha(p) == Path(str(p)+'.sha256').read_text().strip()
    return json.loads(gzip.decompress(p.read_bytes()) if p.suffix == '.gz' else p.read_text())


def savefig(fig, name):
    fig.savefig(OUT / name, dpi=150, facecolor='white', bbox_inches='tight')
    plt.close(fig)


d = read(ROOT / 'study.json')
tails = read(ROOT / 'tail-study.json')
raw = read(ROOT / 'frames.json.gz')
assert tails['sourceStudySha256'] == sha(ROOT / 'study.json')
assert d['inputs']['studySha256'] == sha(Path('scripts/gallery/study_motion_quality.ts'))
assert tails['studySha256'] == sha(Path('scripts/gallery/study_motion_tail_pruning.ts'))
by_id = {r['id']: r for r in raw}
opening_impacts = {}
for row in d['runs']:
    directory = Path('generated/production-repertoire/library-qualified') / row['id'].rsplit('-', 1)[0]
    manifest = read(directory / 'manifest.json')
    cell = next(c for c in manifest['cells'] if c['id'] == row['id'])
    observations = [o for o in cell['observations'] if o['axis'] == 'impact' and o['endFrame'] <= 120]
    opening_impacts[row['id']] = {'observations': observations,
        'normalizedRmsError': float(np.sqrt(np.mean([o['error']**2 for o in observations])))}
colors = {'baseline': '#777777', 'production': '#733eac'}
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
order = ['amour_de_ma_vie_44s-303', 'tiki_tiki_48s-101', 'amour_de_ma_vie_44s-101']
titles = ['L’amour de ma vie · 303', 'Tiki Tiki · 101', 'L’amour de ma vie · 101']
fig, axs = plt.subplots(3, 2, figsize=(12, 10), constrained_layout=True)
examples = []
for i, (prefix, title) in enumerate(zip(order, titles)):
    automatic = next(c for c in d['citations'] if c['id'] == prefix+'-production')
    baseline = next(c for c in d['citations'] if c['id'] == prefix+'-baseline')
    frames = automatic['frames']
    full = by_id[automatic['id']]['frames']
    end = max(frames[4:], key=lambda f: sum(x['gain'] for x in full[f['f']-3:f['f']+1]))
    start = next(f for f in frames if f['f'] == end['f']-4)
    samples = [f for f in frames if start['f'] <= f['f'] <= end['f']]
    gravity_steps = [np.linalg.norm(f['incoming'])-full[f['f']-1]['speed'] for f in samples[1:]]
    prediction = start['speed'] + np.cumsum([0, *gravity_steps])
    solver_gain = sum(f['gain'] for f in samples[1:])
    assert abs(sum(gravity_steps)+solver_gain-(end['speed']-start['speed'])) < 1e-8
    for cell in [baseline, automatic]:
        fs = cell['frames']
        axs[i, 0].plot([f['t'] for f in fs], [f['speed'] for f in fs], color=colors[cell['method']], label=cell['method'])
    axs[i, 0].plot([f['t'] for f in samples], prediction, '--', color='#087f78', label='Gravity contribution along actual motion')
    axs[i, 0].axvspan(start['t'], end['t'], color='#e2d7ee', alpha=.6)
    axs[i, 0].set(title=title, ylabel='Post-solve body speed (px/frame)', xlabel='Seconds')
    axs[i, 1].bar([f['t'] for f in frames], [f['gain'] for f in frames], width=.018, color=colors['production'])
    axs[i, 1].plot([f['t'] for f in baseline['frames']], [f['gain'] for f in baseline['frames']], color=colors['baseline'], label='Ordinary reference')
    for f in frames:
        if f['guideIds']:
            axs[i, 1].plot([f['t']], [-.95], '|', color='#087f78', markersize=9)
    axs[i, 1].axhline(0, color='#555555', linewidth=.6)
    axs[i, 1].set(title='Speed change from solving, after gravity', ylabel='Speed change (px/frame)', xlabel='Seconds')
    if i == 0:
        axs[i, 0].legend(fontsize=8)
        axs[i, 1].text(.02, .95, 'Green ticks: guide contact', va='top', transform=axs[i, 1].transAxes, color='#087f78')
    examples.append({'id': automatic['id'], 'reportedTime': automatic['reportedTime'],
                     'measurementWindow': automatic['window'], 'selected100msInterval': [start['t'], end['t']],
                     'speedBefore': start['speed'], 'speedAfter': end['speed'],
                     'relativeSpeedGainPercent': 100*(end['speed']/start['speed']-1),
                     'gravitySpeedContribution': sum(gravity_steps), 'solverSpeedContribution': solver_gain,
                     'excessOverGravityPrediction': end['gain100ms'],
                     'oneFramePeak': automatic['peak'], 'ordinaryOneFramePeak': baseline['peak'],
                     'scoredImpacts': automatic['scoredImpacts']})
fig.suptitle('Reported acceleration: saved physical tracks, unchanged engine\n100 ms highlights select the largest total solver speed gain inside each declared inspection window.', fontsize=12)
savefig(fig, 'motion-quality-examples-20261001.png')

fig, axs = plt.subplots(2, 2, figsize=(12, 7), constrained_layout=True)
seed_colors = {101: '#b85c00', 202: '#087f78', 303: '#733eac'}
for i, (song, title) in enumerate([('luna_bala_44s', 'Luna Bala'), ('tiki_tiki_48s', 'Tiki Tiki')]):
    rows = [by_id[song+'-101-baseline'], *[by_id[song+f'-{seed}-production'] for seed in [101, 202, 303]]]
    for row in rows:
        fs = [f for f in row['frames'] if 0 < f['t'] <= 3]
        color = '#777777' if row['method'] == 'baseline' else seed_colors[row['seed']]
        label = 'Ordinary (same at all 3 seeds)' if row['method'] == 'baseline' else f'Automatic {row["seed"]}'
        axs[i, 0].plot([f['t'] for f in fs], [f['speed'] for f in fs], color=color, label=label)
        axs[i, 1].plot([f['t'] for f in fs], np.cumsum([f['directionCorrection'] for f in fs]), color=color)
    axs[i, 0].set(title=title+' · first 3 seconds', xlabel='Seconds', ylabel='Post-solve body speed (px/frame)')
    axs[i, 1].set(title='Accumulated solver direction correction', xlabel='Seconds', ylabel='Speed-weighted turning (px/frame)')
    if i == 0:
        axs[i, 0].legend(fontsize=8)
fig.suptitle('Calm-opening diagnostics: differences depend on seed and measurement\nThese are physical descriptions, not a smoothness or beauty score.', fontsize=12)
savefig(fig, 'motion-quality-openings-20261001.png')

fig, axs = plt.subplots(2, 3, figsize=(12, 8), constrained_layout=True)
for ax, e in zip(axs.flat, tails['experiments']):
    removed = set(e['removedIds'])
    for line in e['originalSectionLines']:
        gone = line['id'] in removed
        ax.plot([line['x1'], line['x2']], [line['y1'], line['y2']], color='#dc8b34' if gone else '#25343f',
                linewidth=1.5, linestyle='--' if gone else '-')
    idx = [e['pointIds'].index(p) for p in ['BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT']]
    frames = e['trace']
    xy = np.array([[sum(f[2*i] for i in idx)/6, sum(f[2*i+1] for i in idx)/6] for f in frames])
    ax.plot(xy[:, 0], xy[:, 1], ':', color='#733eac', linewidth=1)
    ax.scatter(xy[0, 0], xy[0, 1], color='#733eac', s=12)
    check = 'fulfilled' if e['constructionCheck']['fulfilled'] else 'unfulfilled'
    ax.set_title(f'{e["construction"]} · section {e["transfer"]["section"]}\nExact replay; original geometry request {check}', fontsize=9)
    ax.set_aspect('equal');ax.invert_yaxis();ax.set_xticks([]);ax.set_yticks([])
axs.flat[-1].axis('off')
axs.flat[-1].text(0, .9, 'Black: retained physical rails\nOrange: removed unused tail\nPurple: unchanged body path\n\nDiagnostic geometry only.\nAn unchanged trajectory may\nstill miss the original request.\nNo new default is promoted.', va='top')
fig.suptitle('A possible way to expose separate support and receiver rails\nLargest eligible unused tail per connected shape; all five selected outcomes retained.', fontsize=12)
savefig(fig, 'motion-quality-tail-experiments-20261001.png')

panels = {}
for method in ['baseline', 'production']:
    rows = [r for r in d['runs'] if r['method'] == method]
    panels[method] = {'records': len(rows), 'uniqueTracks': len({r['trackHash'] for r in rows}),
        'frames': sum(r['full']['frames'] for r in rows),
        'bands': [{**{'threshold': threshold}, **{key: sum(r['full']['bands'][i][key] for r in rows)
            for key in ['frames', 'episodes', 'withGuideContact', 'outsideLandingImpactWindow']}}
            for i, threshold in enumerate([.5, 1, 2, 4])]}
attribution = []
for a in d['attribution']:
    groups = {}
    for frame in a['frames']:
        for kind, group in frame['groups'].items():
            output = groups.setdefault(kind, Counter())
            for key in ['count', 'deltaPointEnergy', 'projectionEnergy', 'frictionEnergy']:
                output[key] += group.get(key, 0)
    attribution.append({'id': a['id'], 'frames': [a['frames'][0]['f'], a['frames'][-1]['f']],
                        'upstreamNativeMaxError': a['upstreamNativeMaxError'], 'groups': groups})
transfers = {}
for method in ['baseline', 'production']:
    rows = list({r['trackHash']: r for r in d['transfers'] if r['method'] == method}.values())
    result = {}
    for row in rows:
        for section in row['sections']:
            c = result.setdefault(section['construction'], Counter())
            c['guideTailAtLeastTwoFrames'] += 1
            c['guideStartsAfterAllMainContact'] += section['guideStartsAfterAllMainContact']
            c['collisionFreeTransfer'] += section['collisionFreeFramesBetween'] > 0
    transfers[method] = result
evidence = {'schema': 'line.motion-quality-evidence.v1',
    'analysisScriptSha256': sha(Path(__file__)), 'inputs': d['inputs'], 'validation': d['validation'],
    'raw': {name: {'path': str(ROOT / name), 'sha256': sha(ROOT / name)}
            for name in ['study.json', 'frames.json.gz', 'tail-study.json', 'free-flight-control.json']},
    'definitions': d['definitions'], 'panels': panels,
    'panelWeighting': '12 records per method, same four songs and seeds. Identical ordinary references retained for paired exposure, not counted as independent tracks. No confidence interval or population inference.',
    'examples': examples, 'attribution': attribution, 'isolatedCollisions': d['isolatedCollisions'],
    'existingImpactDuringOpening': opening_impacts,
    'runs': [{k: r[k] for k in ['id', 'song', 'seed', 'method', 'trackHash', 'artifactSha256', 'score', 'full', 'opening3Seconds', 'lowImpactSupports', 'highImpactSupports']} for r in d['runs']],
    'counterfactuals': d['counterfactuals'], 'transfersOnUniqueTracks': transfers,
    'tailExperiments': {'selection': tails['selection'], 'limitation': tails['limitation'], 'eligibleByConstruction': tails['eligibleByConstruction'],
        'results': [{k: v for k, v in e.items() if k not in ['originalSectionLines', 'removedIds', 'pointIds', 'trace']} for e in tails['experiments']]},
    'figures': {name: sha(OUT / name) for name in ['motion-quality-examples-20261001.png', 'motion-quality-openings-20261001.png', 'motion-quality-tail-experiments-20261001.png']}}
typecheck = ROOT / 'typecheck.txt'
previous_typecheck = Path('generated/production-repertoire/tsc-delivery.txt')
assert typecheck.read_bytes() == previous_typecheck.read_bytes()
evidence['typecheck'] = {'command': 'npx tsc --noEmit --allowImportingTsExtensions --pretty false',
    'errors': typecheck.read_text().count('error TS'), 'identicalToPreStudyDiagnostics': True,
    'rawSha256': sha(typecheck), 'passes': False}
current_compiler = json.loads(subprocess.check_output([
    'node', '--import', 'tsx', '--input-type=module', '-e',
    'import {compilerCandidateIdentity} from "./scripts/v0/benchmark_v2/compiler_identity.ts"; '
    'const c=compilerCandidateIdentity("wasm"); console.log(JSON.stringify({candidateFingerprint:c.candidateFingerprint, '
    'compilerSourceFingerprint:c.compilerSourceFingerprint,engineArtifactFingerprint:c.engineArtifactFingerprint}));'
], text=True))
assert current_compiler['candidateFingerprint'] == manifest['plan']['compiler']['candidateFingerprint']
evidence['unchangedDeliveredCompiler'] = current_compiler
path = OUT / 'motion-quality-20261001.json'
path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False)+'\n')
Path(str(path)+'.sha256').write_text(sha(path)+'\n')
print(json.dumps({'evidence': str(path), 'panels': panels, 'examples': [{k: e[k] for k in ['id', 'selected100msInterval', 'relativeSpeedGainPercent']} for e in examples]}))
