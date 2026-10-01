"""Summarize the read-only replay audit; keep full raw trajectories local."""
import collections
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path('generated/beat-salience-20261001')
OUT = Path('docs/evidence')


def read(path):
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == Path(str(path) + '.sha256').read_text().strip()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def save(path, data):
    path.write_bytes(data)
    Path(str(path) + '.sha256').write_text(hashlib.sha256(data).hexdigest() + '\n')


audit = read(ROOT / 'audit.json')
raw = read(ROOT / 'frames.json.gz')
clock = read(ROOT / 'browser-clock.json')
frames = {(r['version'], r['song'], r['seed']): r['frames'] for r in raw['runs']}


def stats(xs):
    if not xs:
        return {'n': 0}
    return dict(n=len(xs), mean=float(np.mean(xs)), median=float(np.median(xs)),
                p10=float(np.quantile(xs, .1)), p90=float(np.quantile(xs, .9)))


rows = []
examples = []
for run in audit['runs']:
    fs = frames[run['version'], run['song'], run['seed']]
    for i, b in enumerate(run['beats']):
        f = b['actualFrame']
        landing = fs[f:f + 7]
        # Use frame-center timestamps, as elsewhere in the audit. These are
        # kinematic observations, not measurements of a viewer's perceptual latency.
        half_end = (run['beats'][i + 1]['t'] + b['t']) * 20 if i + 1 < len(run['beats']) else run['durationFrames']
        late = [x for x in fs[f + 7:] if x['f'] < half_end]
        peak = max(landing, key=lambda x: x['solverImpulse'])
        late_peak = max(late, key=lambda x: x['solverImpulse']) if late else None
        row = {**{k: run[k] for k in ['version', 'song', 'seed', 'trackHash']}, **b,
               'landingPeakAfterTouchMs': 25 * (peak['f'] - f),
               'latePeak': late_peak and {k: late_peak[k] for k in ['f', 'solverImpulse', 'contacts']},
               'strongerAfterLandingWindow': bool(late_peak and late_peak['solverImpulse'] > peak['solverImpulse']),
               'landingPeakImpulse': peak['solverImpulse']}
        rows.append(row)


def summarize(bs):
    return {'n': len(bs),
            'landingOffsetMs': stats([b['landingOffsetMs'] for b in bs]),
            'landingPeakOffsetMs': stats([b['peaks']['solverImpulse']['landingPeakOffsetMs'] for b in bs]),
            'landingPeakAfterTouchMs': stats([b['landingPeakAfterTouchMs'] for b in bs]),
            'impactError': stats([b['impactError'] for b in bs]),
            'signedImpactError': stats([b['impact'] - b['targetImpact'] for b in bs]),
            'impactBelow80PercentOfTarget': sum(b['impact'] < .8 * b['targetImpact'] for b in bs),
            'impactBelow50PercentOfTarget': sum(b['impact'] < .5 * b['targetImpact'] for b in bs),
            'beatNeighborhoodWithBounce': sum(any(e['type'] == 'bounce' for e in b['localEvents']) for b in bs),
            'strongerAfterLandingWindow': sum(b['strongerAfterLandingWindow'] for b in bs),
            'latePeakTouchesGuide': sum(b['strongerAfterLandingWindow'] and any(c.startswith('guide:') for c in b['latePeak']['contacts']) for b in bs),
            'outsideRadius': {str(ms): sum(abs(b['peaks']['solverImpulse']['strongestOffsetMs']) > ms for b in bs) for ms in [50, 75, 100, 125, 150]},
            'lateLandingPeakOver150Ms': sum(b['peaks']['solverImpulse']['landingPeakOffsetMs'] > 150 + 1e-8 for b in bs),
            'earlyLandingPeakBeforeBeat': sum(b['peaks']['solverImpulse']['landingPeakOffsetMs'] < -1e-8 for b in bs)}


panels = []
for version in ['current', 'previous', 'ordinary']:
    for song in ['all'] + sorted({r['song'] for r in rows}):
        selected = [r for r in rows if r['version'] == version and (song == 'all' or r['song'] == song)]
        unique = {(r['trackHash'], r['index']): r for r in selected}
        panels.append({'version': version, 'song': song,
                       'strong': summarize([r for r in selected if r['targetImpact'] >= .5]),
                       'strongDistinctTracks': summarize([r for r in unique.values() if r['targetImpact'] >= .5]),
                       'thresholdSensitivity': {str(threshold): summarize([r for r in selected if r['targetImpact'] >= threshold]) for threshold in [.4, .6, .8]}})

# Deliberately selected mechanism examples, not a representative sample.
selected_examples = [
    ('tiki_tiki_48s', 101, 8.7, 'Accurate total, late accent'),
    ('amour_de_ma_vie_44s', 101, 7.88, 'Under-strength intended impact'),
    ('tiki_tiki_48s', 202, 41.74, 'Stronger secondary contact'),
    ('luna_bala_44s', 303, 24.2, 'Strong-beat comparison'),
]
fig, axes = plt.subplots(len(selected_examples), 3, figsize=(15, 11), constrained_layout=True)
audio_cache = {}
for n, (song, seed, requested_time, label) in enumerate(selected_examples):
    current = next(r for r in audit['runs'] if r['version'] == 'current' and r['song'] == song and r['seed'] == seed)
    beat = min(current['beats'], key=lambda b: abs(b['t'] - requested_time))
    t = beat['t']; extent = (t - .15, t + .4)
    if song not in audio_cache:
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'productions/{song}/audio.mp3', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], check=True, capture_output=True).stdout
        audio_cache[song] = np.frombuffer(pcm, dtype='<f4')
    samples = audio_cache[song]; a = max(0, int(extent[0]*8000)); z = min(len(samples), int(extent[1]*8000))
    ax = axes[n, 0]
    ax.plot((np.arange(a, z)/8000-t)*1000, samples[a:z], lw=.4, color='#7c848d')
    ax.set_title(f'{song.removesuffix("s")} · {seed} · {t:.3f}s\n{label}', fontsize=9)
    ax.set_ylabel('Decoded mono audio')
    example = {'song': song, 'seed': seed, 'authoredTime': t, 'selectionReason': label, 'variants': []}
    for version, color in [('ordinary', '#718096'), ('previous', '#b57c24'), ('current', '#146bb2')]:
        run = next(r for r in audit['runs'] if r['version'] == version and r['song'] == song and r['seed'] == seed)
        b = run['beats'][beat['index']]
        fs = [f for f in frames[version, song, seed] if extent[0]*40 <= f['f'] <= extent[1]*40]
        times = [(f['f']/40-t)*1000 for f in fs]
        axes[n, 1].plot(times, [f['solverImpulse'] for f in fs], '.-', ms=3, color=color, label=version)
        axes[n, 2].plot(times, [f['scoredStep'] if b['actualFrame'] <= f['f'] <= b['actualFrame']+6 else 0 for f in fs], '.-', ms=3, color=color,
                        label=f'{version}: {b["impact"]:.3f}')
        example['variants'].append({k: b[k] for k in ['actualFrame', 'targetImpact', 'impact', 'construction', 'peaks']} | {'version': version})
    axes[n, 1].set_title('Same-frame solver velocity change', fontsize=10)
    axes[n, 1].set_ylabel('px / physics frame')
    axes[n, 2].set_title(f'Credited impact steps · target {beat["targetImpact"]:.3f}', fontsize=10)
    for j in [1, 2]:
        axes[n, j].legend(fontsize=8, loc='upper right')
        axes[n, j].axvspan(beat['landingOffsetMs'], beat['landingOffsetMs']+150, color='#146bb2', alpha=.06)
    for ax in axes[n]:
        ax.axvline(0, color='#b62c42', lw=1, label='authored beat')
        ax.axvline(beat['landingOffsetMs'], color='#146bb2', lw=.8, ls=':')
        ax.set_xlim(-150, 400); ax.set_xlabel('Milliseconds from authored beat'); ax.grid(alpha=.15)
    examples.append(example)
fig.suptitle('Musical accent audit — red: authored beat; dotted blue: current first contact\nShading: current scored impact window. Physical and scored peaks are different clocks.', fontsize=13)
fig.savefig(OUT / 'beat-salience-examples-20261001.png', dpi=160)
plt.close(fig)
summary = {'schema': 'line.beat-salience-summary.v1',
           'reportHarnessSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'sourceHashes': {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['audit.json', 'frames.json.gz', 'browser-clock.json']},
           'panels': panels, 'examples': examples, 'browserClock': {k: clock[k] for k in ['playerSha256', 'limitation', 'summary', 'errors']},
           'counts': {'records': len(audit['runs']), 'distinctTracks': len({r['trackHash'] for r in audit['runs']}),
                      'byVersion': {version: {'beats': sum(r['version'] == version for r in rows),
                                             'strongBeats': sum(r['version'] == version and r['targetImpact'] >= .5 for r in rows)}
                                    for version in ['current', 'previous', 'ordinary']}},
           'contractAssay': audit['contractAssay'], 'localGuideAssays': audit['localGuideAssays'],
           'extraLatePeaks': [r for r in rows if r['targetImpact'] >= .5 and r['strongerAfterLandingWindow']]}
save(OUT/'beat-salience-summary-20261001.json', (json.dumps(summary, indent=2)+'\n').encode())
save(OUT/'beat-salience-audit-20261001.json.gz', gzip.compress((ROOT/'audit.json').read_bytes(), mtime=0))
print(json.dumps([p for p in panels if p['song']=='all'], indent=2))
