"""Aggregate tables for the geometry hygiene study (research only).

    python3 -I tools/measure/geometry_hygiene/aggregate.py ANALYSIS.json [OUT-summary.json]

ANALYSIS.json is the output of analyze.ts. Prints the tables of
docs/research/geometry-hygiene-20261031.md and writes their numbers.
"""
import json, sys, collections, statistics

rides = json.load(open(sys.argv[1]))
out = {}
SLED = {'PEG', 'TAIL', 'NOSE', 'STRING'}


def q(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))] if xs else None


def fam(x):
    c = x.get('construction')
    if c == 'scattered':
        return 'scattered'
    g = x.get('guidance')
    lay = x.get('layout') or 'paired'
    shaped = 'arcs' if c == 'arcs' else 'shaped'
    if g == 'forbidden':
        return f'{shaped}, guide forbidden'
    if g == 'optional':
        return f'{shaped}, guide optional (opening)'
    return f'{shaped}, guide required, {lay}'


n = len(rides)
seconds = sum(r['durationFrames'] for r in rides) / 40
out['rides'] = [{'song': r['song'], 'seed': r['seed'], 'valid': r['valid'], 'fulfilled': r['fulfilled'], 'requested': r['requested'],
                 'maxTraceError': r['maxTraceError'], 'fulfilmentReplayMatchesSaved': r['fulfilmentCheck']['matchesSaved']} for r in rides]
print(f'{n} rides, {seconds:.0f} s; trace errors max {max(r["maxTraceError"] for r in rides)}; '
      f'fulfilment replay matches saved: {sum(r["fulfilmentCheck"]["matchesSaved"] for r in rides)}/{n}')

# ---------------- pass-throughs ----------------
X = [dict(c, ride=f"{r['song']}-{r['seed']}") for r in rides for c in r['crossings']]
C = [c for r in rides for c in r['collidedThrough']]
S = [s for r in rides for s in r['sinks']]
kinds = collections.Counter(c['kind'] for c in X)
print('\n## Pass-through crossings (point crosses the drawn chain, no collision with it that frame)')
print(f'total {len(X)} = {len(X) / n:.1f}/ride; by kind {dict(kinds)}; collided-but-through {len(C)}')
out['crossings'] = {'total': len(X), 'perRide': len(X) / n, 'byKind': dict(kinds), 'collidedButThrough': len(C)}
for k in ['through-back', 'through-front', 'sink-pop']:
    xs = [c for c in X if c['kind'] == k]
    if not xs:
        continue
    row = {'n': len(xs), 'perRide': len(xs) / n,
           'role': dict(collections.Counter(c['role'] for c in xs).most_common()),
           'entry': dict(collections.Counter(c['entry'] for c in xs)), 'exit': dict(collections.Counter(c['exit'] for c in xs)),
           'sledPoint': sum(c['point'] in SLED for c in xs), 'bodyPoint': sum(c['point'] not in SLED for c in xs),
           'points': dict(collections.Counter(c['point'] for c in xs).most_common()),
           'framesOnSolidSide p50/p90/max': [q([c['stay'] for c in xs], .5), q([c['stay'] for c in xs], .9), max(c['stay'] for c in xs)],
           'depth p50/p90/max': [round(q([c['depth'] for c in xs], .5), 2), round(q([c['depth'] for c in xs], .9), 2), round(max(c['depth'] for c in xs), 2)],
           'relation': dict(collections.Counter(('own' if c['section'] == c['activeSection'] else 'later' if c['section'] > c['activeSection'] else 'earlier') for c in xs)),
           'frontReason': dict(collections.Counter(c['reason'] for c in xs if c['reason'])),
           'chainEnd': sum(c['chainEnd'] for c in xs)}
    out['crossings'][k] = row
    print(f'  {k}: {json.dumps(row)}')

print('\n## Sinks (point pushed ≥0.5 px into a line while in contact, resolved without crossing)')
sk = {'n': len(S), 'perRide': len(S) / n, '>=1px': sum(s['maxDepth'] >= 1 for s in S), '>=2px': sum(s['maxDepth'] >= 2 for s in S),
      '>=3px': sum(s['maxDepth'] >= 3 for s in S), 'frames p50/p90/max': [q([s['frames'] for s in S], .5), q([s['frames'] for s in S], .9), max(s['frames'] for s in S)],
      'role(>=1px)': dict(collections.Counter(s['role'] for s in S if s['maxDepth'] >= 1).most_common()),
      'sledPoint(>=1px)': sum(s['point'] in SLED for s in S if s['maxDepth'] >= 1)}
out['sinks'] = sk
print(' ', json.dumps(sk))

# Episodes: what a viewer could see (line drawn through the rider), per chain
E = [dict(e, ride=f"{r['song']}-{r['seed']}") for r in rides for e in r['episodes']]
print('\n## Episodes (per chain: frames with a pass-through crossing or the line drawn through a rider bone)')
for th in [0, 1, 2, 3, 5]:
    es = [e for e in E if e['maxDepth'] >= th]
    print(f'  depth ≥ {th} px: {len(es)} ({len(es) / n:.1f}/ride); with a crossing {sum(e["crossings"] > 0 for e in es)}; '
          f'frames-through p50 {q([e["insideFrames"] for e in es], .5)} p90 {q([e["insideFrames"] for e in es], .9)}; roles {dict(collections.Counter(e["role"] for e in es).most_common())}')
out['episodes'] = {f'depth>={th}': {'n': len([e for e in E if e['maxDepth'] >= th]), 'perRide': len([e for e in E if e['maxDepth'] >= th]) / n,
                                    'roles': dict(collections.Counter(e['role'] for e in E if e['maxDepth'] >= th))} for th in [0, 1, 2, 3, 5]}
deep = [e for e in E if e['maxDepth'] >= 3]
out['episodes']['depth>=3 detail'] = {
    'relation': dict(collections.Counter(e['relation'] for e in deep)),
    'family': dict(collections.Counter(fam(e) for e in deep).most_common()),
    'kinds': dict(sum((collections.Counter(e['kinds']) for e in deep), collections.Counter())),
    'insideFrames p50/p90/max': [q([e['insideFrames'] for e in deep], .5), q([e['insideFrames'] for e in deep], .9), max(e['insideFrames'] for e in deep)],
    'chainTouched': sum(e['chainTouched'] for e in deep), 'touchedBefore': sum(e['touchedBefore'] for e in deep), 'touchedAfter': sum(e['touchedAfter'] for e in deep),
    'bones': dict(collections.Counter(b for e in deep for b in e['bones']).most_common())}
print('  depth ≥ 3 detail', json.dumps(out['episodes']['depth>=3 detail']))

# By section family: episodes ≥ 1 px and crossings per section
secs = collections.Counter(fam(s) for r in rides for s in r['sections'])
print('\n## Per section family')
fam_rows = {}
for f, ns in secs.most_common():
    e1 = [e for e in E if fam(e) == f and e['maxDepth'] >= 1]
    e3 = [e for e in E if fam(e) == f and e['maxDepth'] >= 3]
    # crossings attributed to the line's section family
    secfam = {}
    for r in rides:
        for s in r['sections']:
            secfam[(f"{r['song']}-{r['seed']}", s['section'])] = fam(s)
    xs = [c for c in X if secfam.get((c['ride'], c['section'])) == f]
    fam_rows[f] = {'sections': ns, 'episodes>=1px/section': len(e1) / ns, 'episodes>=3px/section': len(e3) / ns,
                   'crossings/section': len(xs) / ns, 'through-back/section': sum(c['kind'] == 'through-back' for c in xs) / ns}
    print(f'  {f:40s} {json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in fam_rows[f].items()})}')
out['byFamily'] = fam_rows

# Per song
print('\n## Per song (per ride)')
per_song = {}
for song in sorted({r['song'] for r in rides}):
    rs = [r for r in rides if r['song'] == song]
    per_song[song] = {'rides': len(rs), 'crossings/ride': sum(len(r['crossings']) for r in rs) / len(rs),
                      'through-back/ride': sum(sum(c['kind'] == 'through-back' for c in r['crossings']) for r in rs) / len(rs),
                      'episodes>=3px/ride': sum(sum(e['maxDepth'] >= 3 for e in r['episodes']) for r in rs) / len(rs)}
    print(f'  {song}: {json.dumps(per_song[song])}')
out['bySong'] = per_song

# Necessity: removal replays
R = [x for r in rides for x in r.get('crossedRemovals', [])]
print('\n## Necessity (episodes with a crossing, evenly sampled; replays with lines removed)')
lr_same = sum(x['lineRemoval']['firstDivergence'] < 0 for x in R)
cr_same = sum(x['chainRemoval']['firstDivergence'] < 0 for x in R)
untouched_lines = [x for x in R if x['linesTouched'] == 0]
nec = {'sampled': len(R), 'crossedLinesNeverTouched': len(untouched_lines),
       'removeCrossedLines: identical': lr_same,
       'removeCrossedLines: identical when never touched': sum(x['lineRemoval']['firstDivergence'] < 0 for x in untouched_lines),
       'removeCrossedLines: diverges, first divergence vs episode start (frames) p50': q([x['lineRemoval']['firstDivergence'] - x['start'] for x in R if x['lineRemoval']['firstDivergence'] >= 0], .5),
       'diverging line removals: divergence before the episode': sum(0 <= x['lineRemoval']['firstDivergence'] < x['start'] for x in R),
       'removeWholeChain: identical': cr_same, 'chainNeverTouched': sum(not x['chainTouched'] for x in R),
       'removeWholeChain: divergence before the episode': sum(0 <= x['chainRemoval']['firstDivergence'] < x['start'] for x in R)}
out['necessity'] = nec
print(' ', json.dumps(nec))
# Ever used, across all crossings (not only the sample)
lines_by = {(f"{r['song']}-{r['seed']}", l['id']): l for r in rides for l in r['lines']}
used = collections.Counter()
for c in X:
    l = lines_by[(c['ride'], c['line'])]
    used[(c['kind'], 'crossed line touched in the ride' if l['touched'] else 'crossed line never touched')] += 1
out['crossedLineEverTouched'] = {f'{k[0]} / {k[1]}': v for k, v in used.items()}
print('  crossed line ever touched:', dict(used))

# ---------------- untouched geometry ----------------
print('\n## Untouched geometry (never in any collision, whole replay)')
L = [dict(l, ride=f"{r['song']}-{r['seed']}") for r in rides for l in r['lines']]
tot = len(L)
unt = [l for l in L if not l['touched']]
tl = sum(l['len'] for l in L)
ul = sum(l['len'] for l in unt)
summary = {'segments': tot, 'untouched': len(unt), 'share': len(unt) / tot, 'length': tl, 'untouchedLength': ul, 'lengthShare': ul / tl}
print(' ', json.dumps(summary))
out['untouched'] = {'all': summary, 'byRole': {}, 'byFamily': {}}
for role in ['main', 'approach', 'guide', 'receiver', 'scattered']:
    ls = [l for l in L if l['role'] == role]
    if not ls:
        continue
    u = [l for l in ls if not l['touched']]
    row = {'segments': len(ls), 'untouchedShare': len(u) / len(ls), 'lengthShare': sum(l['len'] for l in u) / max(1e-9, sum(l['len'] for l in ls)),
           'untouchedLength/ride': sum(l['len'] for l in u) / n, 'segment length p50': q([l['len'] for l in ls], .5),
           'bodyOnlyTouchedShare': sum(1 for l in ls if l['touched'] and l['sledTouches'] == 0) / len(ls)}
    out['untouched']['byRole'][role] = row
    print(f'  {role:10s} {json.dumps({k: round(v, 3) for k, v in row.items()})}')
fac = {}
for role in ['main', 'approach', 'guide', 'receiver']:
    for f in ['floor', 'roof']:
        ls = [l for l in L if l['role'] == role and l.get('facing') == f]
        if not ls:
            continue
        u = [l for l in ls if not l['touched']]
        fac[f'{role} / {f}'] = {'segments': len(ls), 'untouchedShare': len(u) / len(ls),
                                'untouchedLength/ride': sum(l['len'] for l in u) / n, 'lengthShare': sum(l['len'] for l in u) / max(1e-9, sum(l['len'] for l in ls))}
roofs = [l for l in L if l['role'] != 'scattered' and l.get('facing') == 'roof']
floors = [l for l in L if l['role'] != 'scattered' and l.get('facing') == 'floor']
for name, ls in [('all roofs', roofs), ('all floors', floors)]:
    u = [l for l in ls if not l['touched']]
    fac[name] = {'segments': len(ls), 'untouchedShare': len(u) / max(1, len(ls)), 'untouchedLength/ride': sum(l['len'] for l in u) / n,
                 'lengthShare': sum(l['len'] for l in u) / max(1e-9, sum(l['len'] for l in ls)),
                 'touchedBodyOnlyShareOfTouched': sum(1 for l in ls if l['touched'] and l['sledTouches'] == 0) / max(1, sum(l['touched'] for l in ls))}
out['untouched']['byFacing'] = fac
print('  by facing (roof = stops the rider from below):')
for k, v in fac.items():
    print(f'    {k:18s} {json.dumps({kk: round(vv, 3) for kk, vv in v.items()})}')
fl = collections.defaultdict(list)
for l in L:
    fl[(fam(l), l['role'] if l['role'] != 'approach' else 'main')].append(l)
for k in sorted(fl):
    ls = fl[k]
    u = [l for l in ls if not l['touched']]
    row = {'segments': len(ls), 'untouchedShare': len(u) / len(ls), 'lengthShare': sum(l['len'] for l in u) / max(1e-9, sum(l['len'] for l in ls))}
    out['untouched']['byFamily'][f'{k[0]} / {k[1]}'] = row
    print(f'  {k[0]:40s} {k[1]:9s} {json.dumps({kk: round(v, 3) for kk, v in row.items()})}')

# Chain-level: untouched runs (contiguous untouched segments in a chain) by position and length
print('\n## Untouched runs within chains (position, length)')
runs = []
for r in rides:
    by_sec = collections.defaultdict(list)
    for l in r['lines']:
        by_sec[l['section']].append(l)
    # rebuild chains by id order is not possible without coordinates; use the role grouping per section (main vs guide/receiver)
    for s, ls in by_sec.items():
        groups = collections.defaultdict(list)
        for l in sorted(ls, key=lambda x: x['id']):
            groups['main' if l['role'] in ('main', 'approach') else l['role']].append(l)
        for g, chain in groups.items():
            if g == 'scattered':
                continue
            i = 0
            while i < len(chain):
                if chain[i]['touched']:
                    i += 1
                    continue
                j = i
                while j + 1 < len(chain) and not chain[j + 1]['touched']:
                    j += 1
                pos = 'whole' if i == 0 and j == len(chain) - 1 else 'leading' if i == 0 else 'trailing' if j == len(chain) - 1 else 'interior'
                runs.append({'ride': f"{r['song']}-{r['seed']}", 'section': s, 'role': g, 'family': fam(chain[0]), 'position': pos,
                             'segments': j - i + 1, 'length': sum(x['len'] for x in chain[i:j + 1]), 'chainLength': sum(x['len'] for x in chain)})
                i = j + 1
rt = collections.defaultdict(lambda: [0, 0.0])
for x in runs:
    rt[(x['role'], x['position'])][0] += 1
    rt[(x['role'], x['position'])][1] += x['length']
out['untouchedRuns'] = {f'{k[0]} / {k[1]}': {'runs': v[0], 'lengthPerRide': v[1] / n, 'meanLength': v[1] / v[0]} for k, v in sorted(rt.items())}
for k, v in sorted(rt.items()):
    print(f'  {k[0]:9s} {k[1]:9s} runs {v[0]:5d}  length/ride {v[1] / n:8.0f} px  mean {v[1] / v[0]:6.1f} px')
bins = [(0, 5), (5, 24), (24, 100), (100, 1e9)]
lb = {}
for lo, hi in bins:
    xs = [x for x in runs if lo <= x['length'] < hi]
    lb[f'{lo}-{hi if hi < 1e9 else "inf"} px'] = {'runs': len(xs), 'lengthShare': sum(x['length'] for x in xs) / max(1e-9, sum(x['length'] for x in runs))}
out['untouchedRunLengths'] = lb
print('  run length bins:', json.dumps(lb))
# Whole guide chains never touched, by family
wg = collections.Counter((x['family'], x['role']) for x in runs if x['position'] == 'whole' and x['role'] in ('guide', 'receiver'))
gchains = collections.Counter()
for r in rides:
    for s in r['sections']:
        pass
out['wholeUntouchedGuideChains'] = {f'{k[0]} / {k[1]}': v for k, v in wg.items()}
print('  whole guide/receiver chains untouched:', dict(wg))

# Pruning
print('\n## Pruning replays')
pa = {'removedSegments/ride': sum(r['pruneAll']['removed'] for r in rides) / n,
      'ridesIdentical': sum(r['pruneAll']['firstDivergence'] < 0 for r in rides),
      'judgeRoleError (more than two chains)': sum(bool(r['pruneAll']['geometryError']) for r in rides),
      'sectionsNewlyUnfulfilled/ride': sum(len(r['pruneAll']['newlyUnfulfilled']) for r in rides) / n,
      'reasons': dict(collections.Counter(x for r in rides for s in r['pruneAll']['newlyUnfulfilled'] for x in s['reasons']).most_common())}
pe = {'removedSegments/ride': sum(r['pruneEnds']['removed'] for r in rides) / n,
      'removedLength/ride': sum(r['pruneEnds']['removedLength'] for r in rides) / n,
      'ridesIdentical': sum(r['pruneEnds']['firstDivergence'] < 0 for r in rides),
      'judgeRoleError': sum(bool(r['pruneEnds']['geometryError']) for r in rides),
      'sectionsNewlyUnfulfilled/ride': sum(len(r['pruneEnds']['newlyUnfulfilled']) for r in rides) / n,
      'ridesWithNoNewlyUnfulfilled': sum(not r['pruneEnds']['newlyUnfulfilled'] for r in rides),
      'reasons': dict(collections.Counter(x for r in rides for s in r['pruneEnds']['newlyUnfulfilled'] for x in s['reasons']).most_common())}
out['pruneAll'] = pa
out['pruneEnds'] = pe
print('  all untouched:', json.dumps(pa))
print('  chain ends only:', json.dumps(pe))

# Narrow prunes (one mechanism each)
narrow = {}
for k in ['pruneCrossed', 'pruneLeadIn', 'pruneGuideLeading']:
    rows = [r[k] for r in rides if k in r]
    if not rows:
        continue
    narrow[k] = {'removedSegments/ride': sum(x['removed'] for x in rows) / n, 'removedLength/ride': sum(x['removedLength'] for x in rows) / n,
                 'ridesIdentical': sum(x['firstDivergence'] < 0 for x in rows), 'judgeRoleError': sum(bool(x['geometryError']) for x in rows),
                 'sectionsNewlyUnfulfilled': sum(len(x['newlyUnfulfilled']) for x in rows),
                 'ridesWithNoNewlyUnfulfilled': sum(not x['newlyUnfulfilled'] for x in rows),
                 'reasons': dict(collections.Counter(z for x in rows for s in x['newlyUnfulfilled'] for z in s['reasons']).most_common())}
    print(f'  {k}: {json.dumps(narrow[k])}')
out['narrowPrunes'] = narrow

# Guide chains: what touches them
print('\n## Guide and receiver chains: what touches them')
gc = collections.Counter()
glen = collections.defaultdict(list)
for r in rides:
    by = collections.defaultdict(list)
    for l in r['lines']:
        if l['role'] in ('guide', 'receiver'):
            by[(l['section'], l['role'])].append(l)
    for (s, role), ls in by.items():
        sled = sum(l['sledTouches'] for l in ls)
        body = sum(l['bodyTouches'] for l in ls)
        kind = 'untouched' if sled + body == 0 else 'body only' if sled == 0 else 'sled (and body)' if body else 'sled only'
        gc[(role, kind)] += 1
        glen[role].append(sum(l['len'] for l in ls if l['touched']) / max(1e-9, sum(l['len'] for l in ls)))
out['guideChains'] = {f'{k[0]} / {k[1]}': v for k, v in gc.items()}
out['guideChainTouchedLengthShare p50'] = {k: q(v, .5) for k, v in glen.items()}
print(' ', dict(gc), {k: round(q(v, .5), 3) for k, v in glen.items()})
if len(sys.argv) > 2:
    json.dump(out, open(sys.argv[2], 'w'), indent=1)
