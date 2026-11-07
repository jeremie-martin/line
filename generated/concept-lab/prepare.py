"""Bundle one saved ride with its music data for the concept lab.

Inputs are read-only: the saved production record (track + trace), the overlay
bundle the finished video used (measured hits, seconds), the spectrum the video
used (30 fps x 56 bands) and the spec's composition (sections, hit sources).
Output: generated/concept-lab/data/<key>.json
"""
import glob, json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SONGS = {
    'petrunko': ('petrunko_selection', 'petrunko_selection-s202', 'Petrunko'),
    'lua': ('lua_na_praca_selection', 'lua_na_praca_selection-s101', 'Lua na Praça'),
    'los': ('los_voltaje_selection', 'los_voltaje_selection-s202', 'Los Voltaje'),
    'batidao': ('no_batidao_selection', 'no_batidao_selection-s202', 'No Batidão'),
    'burn': ('let_the_world_burn_selection', 'let_the_world_burn_selection-s202', 'Let the World Burn'),
    'coma': ('montagem_coma_selection', 'montagem_coma_selection-s202', 'Montagem Coma'),
    'tomada': ('montagem_tomada_super_slowed_selection', 'montagem_tomada_super_slowed_selection-s202', 'Montagem Tomada (super slowed)'),
}
FPS = 40


def record_contacts(rec):
    """The overlay's contacts, rebuilt from the saved one-to-one impact account (as scripts/produce/overlay_impact.ts)."""
    ev = rec['impactEvaluation']
    matches = {m['target']: m for m in ev['account']['matches']}
    out = []
    for i, target in enumerate(ev['targets']):
        m = matches.get(i)
        event = None if m is None else ev['events'][m['event']]
        out.append({'t': target['frame'] / FPS, 'actualTime': None if event is None else event['onset'] / FPS,
                    'impactTarget': target.get('impact'), 'impactMeasured': None if event is None else event['strength']})
    return out


def load(path):
    with open(os.path.join(ROOT, path)) as f:
        return json.load(f)


def build(key):
    song, ride, title = SONGS[key]
    rec_path = glob.glob(os.path.join(ROOT, f'generated/music-library-round2/rides/{ride}/*-production.json'))[0]
    with open(rec_path) as f:
        rec = json.load(f)
    contacts = record_contacts(rec)
    spec_path = os.path.join(ROOT, f'generated/style-lab-v5/public/{key}.spectrum.json')
    if not os.path.exists(spec_path):
        spec_path = os.path.join(ROOT, f'generated/concept-lab/data/{key}.spectrum.json')
        if not os.path.exists(spec_path):
            subprocess.run([sys.executable, os.path.join(ROOT, 'scripts/make_spectrum.py'), f'--audio={ROOT}/productions/{song}/audio.mp3',
                            f'--out={spec_path}'], check=True)
    spectrum = load(spec_path)
    comp = load(f'productions/{song}/composition.json')
    sources = sorted(((t, g['source']) for g in comp['groups'] for t in g['times']))

    def source_at(t):
        best = min(sources, key=lambda s: abs(s[0] - t), default=None)
        return best[1] if best and abs(best[0] - t) < 0.06 else 'other'

    hits = []
    for c in contacts:
        if c.get('impactMeasured') is None:
            continue
        t = c.get('actualTime') if c.get('actualTime') is not None else c['t']
        hits.append({'t': round(t, 4), 's': round(c['impactMeasured'], 3),
                     'ask': c.get('impactTarget'), 'src': source_at(c['t'])})
    dur = rec['track']['duration'] / FPS
    phases = [{'name': p['name'], 't0': p['t'], 't1': (comp['phases'][i + 1]['t'] if i + 1 < len(comp['phases']) else dur),
               'air': p['air'], 'speed': p['speed']} for i, p in enumerate(comp['phases'])]
    out = {
        'key': key, 'title': title, 'duration': dur,
        'audio': f'/productions/{song}/audio.mp3',
        'track': rec['track'], 'trace': rec['trace'],
        'hits': hits, 'phases': phases,
        'spectrum': {'fps': spectrum['fps'], 'bands': spectrum['bands'],
                     'frames': [[round(v, 3) for v in row] for row in spectrum['frames']]},
    }
    os.makedirs(os.path.join(ROOT, 'generated/concept-lab/data'), exist_ok=True)
    with open(os.path.join(ROOT, f'generated/concept-lab/data/{key}.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(key, len(hits), 'hits', sorted({h['src'] for h in hits}), len(phases), 'phases')


for k in (sys.argv[1:] or SONGS):
    build(k)
