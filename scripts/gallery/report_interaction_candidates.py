"""Summarize the declared comparison, retaining failures and parameter sensitivity."""
import copy
import gzip
import hashlib
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path('generated/interaction-candidates-20261002')
out = Path('docs/evidence')
payload = (source / 'audit.json.gz').read_bytes()
assert hashlib.sha256(payload).hexdigest() == (source / 'audit.json.gz.sha256').read_text().strip()
audit = json.loads(gzip.decompress(payload))
findings = {
    'upper-rival': 'The upper response around 12.45 s is distinct under both candidate methods and has no authored beat match at the provisional 100 ms tolerance. The current score does not directly capture this peak.',
    'clean-landing': 'The default contact and pulse methods both retain one interaction. A high valley threshold splits its two local peaks. The owner has already identified this as a cleaner landing.',
    'open-transfer': 'Both default candidates separate the later upper engagement from the lower landing. Its lack of an authored beat match does not make this welcome transfer undesirable.',
    'merged-hits': 'Both default candidates separate lower and upper responses. Bridging one empty contact frame merges them. All twelve pulse parameter settings retain two responses in the focus. The existing landing impact includes part of both.',
    'split-lower': 'The second lower-support response remains separate under the default candidates. Bridging empty contact frames merges it; the pulse method also identifies smaller later activity. More markers do not establish more perceived impacts.',
    'ripple-receiver': 'Both candidates identify the extra receiver response before the next landing. This is a previously measured causal guide example, not a new owner judgment.',
    'inverted-contact': 'The default methods each report one interaction here. The recorded pose is a brief inverted contact, not a demonstrated sustained overhead slide.',
    'luna-opening': 'Some low-impact activity is divided by empty contact frames or by pulse thresholds. A later physical peak can also move the pulse onset outside the provisional beat association window.',
    'tiki-opening': 'The established landing at 0.950 s has a body-response peak below the default 0.5 pulse floor. Contact episodes retain it. This exposes a measurement limitation; the physical ride has not changed.',
    'sustained-guidance': 'Actual contact continues through the focus. The pulse method can mark local fluctuations inside that same engagement; the count changes with its parameters. The open question is whether these feel like guidance or distinct accents.',
    'amour-strong': 'A tiny contact at 5.55 s gets the contact-based beat match; the stronger engagement at 5.60 s is unmatched. Pulse matching instead associates the stronger response with that beat. This tests whether first contact is a useful musical onset.',
}
review = copy.deepcopy({k: v for k, v in audit.items() if k != 'runs'})
for clip in review['clips']:
    clip['finding'] = findings.get(clip['id'], 'This contextual control was selected using authored targets before running the candidates. Listen for whether their grouping and timing describe the interaction you perceive.')
# Owner review is appended after the declared experiment. Do not rewrite the
# original panel, its pre-execution judgments, or the derived observations.
feedback_path = out / 'interaction-panel-feedback-20261002.json'
feedback_bytes = feedback_path.read_bytes()
assert hashlib.sha256(feedback_bytes).hexdigest() == Path(str(feedback_path)+'.sha256').read_text().strip()
feedback = json.loads(feedback_bytes)
assert feedback['panelSha256'] == audit['panelSha256']
review['ownerFeedbackSha256'] = hashlib.sha256(feedback_bytes).hexdigest()
for note in feedback['clips']:
    clip = next(c for c in review['clips'] if c['id'] == note['id'])
    assert clip['trackHash'] == note['trackHash']
    clip['ownerFeedbackAtDeclaration'] = clip['ownerFeedback']
    clip['ownerFeedback'] = note['summary']
    clip['question'] = 'Review focus: ' + note['reviewFocus']
for clip in review['clips']:
    if clip['id'] == 'sustained-guidance':
        clip['title'] = 'Sustained contact with unwanted speed gain'
        clip['finding'] = 'The owner rejects the unexplained speed-up here. This is a negative motion example, not an approved smooth-guidance control. Contact is continuous; small individual response peaks do not establish acceptable motion.'
    elif clip['id'] == 'amor-strong':
        clip['finding'] = 'The owner does not perceive an impactful strike near 9.2 s. The request is 1.0 and the current landing measure is about 0.689. Both its strength shortfall and the character of the contact require attention; this does not disqualify inverted riding generally.'
    elif clip['id'] == 'ripple-receiver':
        clip['finding'] = 'The owner welcomes this separate upper-receiver pattern, provided it is deliberately synchronized and its impact matches the musical request. The current response is a previously measured causal guide example.'
    elif clip['id'] == 'amour-strong':
        clip['finding'] += ' The owner finds the difficult passage not so bad overall; that is not a precise endorsement of either onset interpretation.'
review['reporterSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
review_bytes = (json.dumps(review, separators=(',', ':')) + '\n').encode()
(source / 'review.json').write_bytes(review_bytes)
(source / 'review.json.sha256').write_text(hashlib.sha256(review_bytes).hexdigest() + '\n')

runs = audit['runs']
totals = {method: {'events': sum(len(r[method]) for r in runs),
                  'matchedBeats': sum(len(r['matching'][method]['pairs']) for r in runs),
                  'unmatchedEvents': sum(len(r['matching'][method]['unmatchedEvents']) for r in runs)}
          for method in ['contact', 'pulse']}
variants = []
for i, v in enumerate(runs[0]['variants']):
    selected = [r['variants'][i] for r in runs]
    assert all(s['parameters'] == v['parameters'] and s['method'] == v['method'] for s in selected)
    variants.append({'method': v['method'], 'parameters': v['parameters'],
                     'events': sum(len(s['events']) for s in selected),
                     'matchedBeats': sum(len(s['matching']['pairs']) for s in selected)})
matching = []
for i, m in enumerate(runs[0]['matchingSensitivity']):
    selected = [r['matchingSensitivity'][i] for r in runs]
    matching.append({k: m[k] for k in ['method', 'clock', 'tolerance']} | {'matchedBeats': sum(len(s['pairs']) for s in selected)})
summary = {'schema': audit['schema'], 'panelSha256': audit['panelSha256'], 'auditSha256': hashlib.sha256(payload).hexdigest(),
           'ownerFeedbackSha256': review['ownerFeedbackSha256'],
           'reviewSha256': hashlib.sha256(review_bytes).hexdigest(), 'runs': len(runs),
           'authoredBeats': sum(len(r['beats']) for r in runs), 'totals': totals, 'variants': variants,
           'matchingSensitivity': matching, 'notes': audit['notes'],
           'clips': [{k: c[k] for k in ['id', 'title', 'trackHash', 'focus', 'ownerFeedback', 'counts', 'sensitivity', 'finding']} for c in review['clips']]}
(out / 'interaction-candidates-summary-20261002.json').write_text(json.dumps(summary, indent=2) + '\n')
(out / 'interaction-candidates-audit-20261002.json.gz').write_bytes(payload)

fig, axes = plt.subplots(4, 2, figsize=(13, 10), constrained_layout=True, gridspec_kw={'height_ratios': [1, .7, 1, .7]})
for idx, ident in enumerate(['clean-landing', 'merged-hits', 'tiki-opening', 'sustained-guidance']):
    clip = next(c for c in review['clips'] if c['id'] == ident)
    row, col = (idx // 2) * 2, idx % 2
    top, bottom = axes[row, col], axes[row+1, col]
    lo, hi = clip['range']
    top.plot([f['frame']/40 for f in clip['frames']], [f['correction'] for f in clip['frames']], color='#235a9f', marker='.', ms=3)
    top.set_title(clip['title'], loc='left', fontsize=11)
    top.set_ylabel('Body correction\n(world units/frame)')
    for y, method, color in [(2, 'landing', '#657079'), (1, 'contact', '#267e64'), (0, 'pulse', '#8260a3')]:
        for e in clip['methods'][method]:
            bottom.broken_barh([(max(lo,e['start']/40), min(hi,(e['end']+1)/40)-max(lo,e['start']/40))], (y-.18,.36), facecolors=color, alpha=.6)
            if lo <= e['peakFrame']/40 <= hi:
                bottom.plot(e['peakFrame']/40, y, '.', color=color)
    bottom.set_yticks([0,1,2], ['C · Pulse','B · Contact','A · Landing'])
    bottom.set_ylim(-.5,2.5)
    bottom.set_xlabel('Music time (seconds)')
    for ax in (top, bottom):
        ax.set_xlim(lo,hi); ax.axvspan(*clip['focus'],color='#eff2e8',zorder=-1)
        for b in clip['beats']:ax.axvline(b['time'],color='#16806a',ls='--',lw=.8)
        ax.spines[['top','right']].set_visible(False)
fig.suptitle('Candidate groupings on unchanged automatic tracks · no perceptual score adopted',fontsize=14)
fig.savefig(out / 'interaction-candidates-examples-20261002.png',dpi=150)
plt.close(fig)
for name in ['interaction-candidates-summary-20261002.json', 'interaction-candidates-audit-20261002.json.gz', 'interaction-candidates-examples-20261002.png']:
    p=out/name;Path(str(p)+'.sha256').write_text(hashlib.sha256(p.read_bytes()).hexdigest()+'\n')
print(json.dumps({'runs':summary['runs'],'beats':summary['authoredBeats'],'totals':totals,'variants':variants,'matching':matching}))
