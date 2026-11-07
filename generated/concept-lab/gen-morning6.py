# Builds round6.html and films6.json for round 6. morning.html is only an index of rounds.
import json, re
style = re.search(r'<style>(.*?)</style>', open('round3/morning.html').read(), re.S).group(1)
F = 'fourup/r6'
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Round six</title>
<style>{style}
table{{border-collapse:collapse;width:100%;font-size:14px;margin:6px 0}}
th,td{{text-align:left;padding:4px 6px;border-bottom:1px solid var(--line)}}
</style>
</head>
<body><main>
<p class="kicker">Round six · 7 November</p>
<h1>Your clarifications, on fresh rides</h1>
<p class="lead">Every film is on the rides recompiled with today’s compiler. The round is smaller on purpose: one comparison per open question, four questions, and the rest to look at when you like.</p>

<a class="card primary" href="{F}/los-moment.mp4"><span class="go">→</span><b>Your two Los Voltaje moments</b><span>7 s on the old ride, 24.95 s and 28.58 s: Tamed, Follows direction, then each with a faint paper grain.</span></a>
<a class="card" href="{F}/hits-tomada.mp4"><span class="go">→</span><b>The biggest hits, 4K</b><span>Held, + shake, + shake, split &amp; flash, and Today’s by strength. Tomada has many big hits; Los Voltaje has few, so it shows the calm case.</span></a>
<p class="small" style="margin:-4px 0 12px 18px">Also: <a href="{F}/hits-los.mp4">Los Voltaje</a></p>
<a class="card" href="{F}/cam-los.mp4"><span class="go">→</span><b>The camera on whole songs, 4K</b><span>Tamed, Higher, Follows direction, and the same with grain. Also on Petrunko.</span></a>
<p class="small" style="margin:-4px 0 12px 18px">Also: <a href="{F}/cam-petrunko.mp4">Petrunko</a></p>
<a class="card" href="{F}/colours-1.mp4"><span class="go">→</span><b>New colours, 4K</b><span>Slate, Olive, Mauve, Sumi. Then Bauhaus, Riso with deeper ink, Lagoon, Plum, the last two shown again as you asked.</span></a>
<p class="small" style="margin:-4px 0 12px 18px">Also: <a href="{F}/colours-2.mp4">Bauhaus, Riso with deeper ink, Lagoon, Plum</a></p>
<a class="card" href="{F}/drop-petrunko.mp4"><span class="go">→</span><b>A scheme switch at the drop, 4K</b><span>Paper with Night, then Hokusai → Midnight, Dune → Espresso, Lagoon → Moss.</span></a>
<a class="card" href="{F}/bands-petrunko.mp4"><span class="go">→</span><b>The band pool, 4K</b><span>Bars, fork, Iris, Three colours: back on screen as you asked. No question; tell me if one deserves a place.</span></a>
<a class="card" href="./?q=1"><span class="go">→</span><b>Four questions</b><span>Hits, camera, colours, drop. Same format as before.</span></a>
<a class="card" href="/motion-gallery/video-compare.html?collection=/generated/concept-lab/films6.json"><span class="go">→</span><b>Switching player</b><span>Every film at full size, one at a time.</span></a>

<h2>What I did with your answers</h2>
<ul>
<li><strong>The “oh yeah”:</strong> mostly the shake, really all three together, only on the impact. One option adds a refined shake. The next adds shake, split and flash together, all growing on the hardest hits. The fourth is Today’s own execution on the same ride, gated by real strength instead of the top-10 % gate you called a terrible idea, so you compare execution rather than ride.</li>
<li><strong>Calm songs</strong> get less, as you confirmed. Los Voltaje’s new ride has one hit at full strength; Tomada has eleven.</li>
<li><strong>Your moments</strong> are the steep descents with an overhead contact. You asked for something generic rather than a niche rule, plus a way to measure it. Below are the measurement and one generic rule, plus an idea a reviewer raised that may matter more: on plain paper nothing moves past the rider, so no camera can make a dive read as falling. A faint grain fixed to the world fixes that everywhere.</li>
<li><strong>Balance:</strong> the rider is higher in both new cameras. Dune’s sun shows that a top element also balances the frame. Both stay options.</li>
<li><strong>Drop switch:</strong> cut on the hand-placed cue, into a darker scheme of the same family. The accent always carries over, and the sun too, unless the partner has its own. No inversion. Pairs start from schemes you rated, not the new ones.</li>
<li><strong>Title:</strong> optional per look. <strong>Line modes:</strong> any look, any mode. <strong>Lyrics:</strong> deferred. <strong>Phone:</strong> no show-stopper, so closed for now.</li>
<li><strong>Also:</strong> the rider keeps half its clean image through the colour split (your round-4 “slightly less split”). Black is back on a steady zoom. Lagoon’s ink is a shade deeper, the one lightness fix. Plum is unchanged.</li>
</ul>

<h2>The camera, measured</h2>
<p>I measured how the rider moves in the frame against how it moves in the world, on all seven new rides. Two numbers matter most:</p>
<table><tr><th>Camera</th><th>Rider rises on screen while going down</th><th>Rider height (median)</th></tr>
<tr><td>Today’s official camera</td><td>5.1 s per minute</td><td>44 %</td></tr>
<tr><td>Tamed</td><td>1.8 s per minute</td><td>43 %</td></tr>
<tr><td>Higher</td><td>1.8 s per minute</td><td>38 %</td></tr>
<tr><td>Follows direction</td><td>0 s per minute</td><td>38 %</td></tr></table>
<p><strong>Follows direction</strong> is one rule for everything. The rider’s height on screen follows the slope it rides, growing with the slope’s square, so a 60° ride sits clearly lower than a 35° one. While the rider descends, it may rise on screen only slowly (45 px/s). It is also calmer overall: 59 px/s of on-screen motion against Tamed’s 94. At your two moments it lowers the rider by 5.5 % and 4.0 % of the screen, against Tamed’s 3.7 % and 2.1 %.</p>
<p>A narrower rule I tried first, dropping the rider only on steep rides, moved more at your moment (6 %). But it made the rider climb back during descents (5 s per minute), so I left it out. The full table is in <code>analysis/camstats.txt</code>.</p>

<h2>Scheme, style, step: how the pieces fit</h2>
<p>You asked for my view on this, so it has its own page: <a href="system.html"><strong>How the pieces fit</strong></a>. In short, there are four kinds of things. <strong>Signals</strong> are what is true about the ride. <strong>Elements</strong> are the instruments. <strong>Schemes</strong> are colours only. <strong>Direction</strong> is the choices for one video, where intent lives. A look is only a saved direction. Every comparison should name what it varies, and your verdicts are now filed per piece in a <a href="https://github.com/jeremie-martin/line/blob/visual-lab/generated/concept-lab/LEDGER.md">ledger</a> (also <code>LEDGER.md</code> in the lab), so feedback on a palette is never mistaken for feedback on a video.</p>

<h2>Timing</h2>
<p>On the old rides, the rider’s first touch lands within −6 to +10 ms of the sound’s rise, under one video frame. So syncing the visuals to the touch or to the music onset is currently the same thing, and the lab fires accents at the touch. The −15 ms jolt is a compiler constant, and whether it’s still right is the compiler track’s question. I wrote the other agent a brief with your questions and my measurements: <code>agents/jolt-brief.md</code>.</p>

<h2>v1: settled, open, later</h2>
<p class="small">You confirmed nothing was misfiled. Updated:</p>
<ul>
<li><strong>Settled:</strong> Paper, Hokusai, Black, Dune and Plum. Pencil → ink, inked as the rider passes. Held hits on real strength. Whole course at both ends, band from frame 0. Bars or fork with the loudest in red. Night as a hand-placed cue. The title is optional, at most two lines.</li>
<li><strong>Open (this round):</strong> the biggest hits, the steep-ride camera and grain, which colours join, the drop switch.</li>
<li><strong>Open (next):</strong> zoom beyond steady (you’re not sure yet, and neither am I). Re-checking everything on the fresh rides.</li>
<li><strong>Later:</strong> how a song gets its look, a per-song hint sheet, the production port, and the jolt (the compiler track).</li>
<li><strong>Parked:</strong> afterimage, ring, larger rider, Ridge, Score, hits by source, vignette, punch and recoil (in the lab, not shown), lyrics.</li>
</ul>

<details><summary>Not checked</summary>
<ul>
<li>Grain at phone size after YouTube’s compression: fine texture is what encoders smooth first, so it may vanish or shimmer.</li>
<li>The drop switch is a hard cut on the cue, with no transition, and only on Petrunko’s cue.</li>
<li>Today’s by strength is my lab approximation of today’s effect, not the shipped renderer.</li>
<li>The colour measure behind the new schemes is weak evidence, seven ratings and many measures. The schemes have to win on screen.</li>
</ul></details>

<p class="small">Earlier rounds: <a href="round5/morning.html">5</a>, <a href="round4/morning.html">4</a>, <a href="round3/morning.html">3</a>, <a href="round2/morning.html">2</a>, <a href="round1/morning.html">1</a>. <a href="clarify.html">Clarifications</a>. <a href="./">Free lab</a>.</p>
</main></body></html>
'''
open('round6.html', 'w').write(html)

def v(i, l, d, src): return {'id': i, 'label': l, 'description': d, 'src': src}
P = []
for s, label in [('tomada', 'Tomada'), ('los', 'Los Voltaje')]:
    P.append({'id': f'hits-{s}', 'label': f'Biggest hits · {label}', 'description': 'Full song on the recompiled ride.', 'videos': [
        v('strong', 'Held', 'As you chose it.', f'films6/{s}-h-strong.mp4'), v('shake', '+ shake', 'On the hardest hits.', f'films6/{s}-h-shake.mp4'),
        v('impact', '+ shake, split & flash', 'All three together.', f'films6/{s}-h-impact.mp4'), v('todayW', 'Today’s, by strength', 'Today’s execution, real strength.', f'films6/{s}-h-todayW.mp4')]})
P.append({'id': 'moment', 'label': 'Your moments · Los Voltaje, old ride', 'description': '23.5–30.5 s.', 'videos': [
    v('tamed', 'Tamed', '', 'films6/moment/los-tamed.mp4'), v('follow', 'Follows direction', '', 'films6/moment/los-follow.mp4'),
    v('tamed-grain', 'Tamed + grain', '', 'films6/moment/los-tamed-grain.mp4'), v('follow-grain', 'Follows direction + grain', '', 'films6/moment/los-follow-grain.mp4')]})
for s, label in [('los', 'Los Voltaje'), ('petrunko', 'Petrunko')]:
    P.append({'id': f'cam-{s}', 'label': f'Camera · {label}', 'description': 'Full song on the recompiled ride.', 'videos': [
        v('tamed', 'Tamed', '', f'films6/{s}-p-tamed.mp4'), v('high', 'Higher', '', f'films6/{s}-p-high.mp4'),
        v('follow', 'Follows direction', '', f'films6/{s}-p-follow.mp4'), v('follow-grain', 'Follows direction + grain', '', f'films6/{s}-p-follow-grain.mp4')]})
P.append({'id': 'colours', 'label': 'Colours · Lua', 'description': 'One plain look, colour only.', 'videos': [v(c, c.capitalize() if c != 'risoDeep' else 'Riso, deeper ink', '', f'films6/lua-c-{c}.mp4') for c in ['slate', 'olive', 'mauve', 'sumi', 'bauhaus', 'risoDeep', 'lagoon', 'plum']]})
P.append({'id': 'drop', 'label': 'Drop switch · Petrunko', 'description': 'The cue is at 22.4 s.', 'videos': [
    v('paper', 'Paper, Night', '', 'films6/petrunko-d-paper.mp4'), v('hokusai', 'Hokusai → Midnight', '', 'films6/petrunko-d-hokusai.mp4'),
    v('dune', 'Dune → Espresso', '', 'films6/petrunko-d-dune.mp4'), v('lagoon', 'Lagoon → Moss', '', 'films6/petrunko-d-lagoon.mp4')]})
P.append({'id': 'bands', 'label': 'Band pool · Petrunko', 'description': 'On Paper.', 'videos': [
    v('redbars', 'Bars', '', 'films6/petrunko-b-redbars.mp4'), v('red', 'Fork', '', 'films6/petrunko-b-red.mp4'),
    v('iris', 'Iris', '', 'films6/petrunko-b-iris.mp4'), v('bars3', 'Three colours', '', 'films6/petrunko-b-bars3.mp4')]})
ids = sorted({x['id'] for p in P for x in p['videos']})
json.dump({'title': 'Concept films · round 6', 'groups': [{'id': 'all', 'label': 'Every comparison', 'description': 'Pick a comparison, then switch between its films.', 'variants': ids}],
           'passages': P, 'links': [{'label': 'Round 6 page', 'href': '/generated/concept-lab/round6.html'}, {'label': 'Round 5 films', 'href': '/motion-gallery/video-compare.html?collection=/generated/concept-lab/films5.json'}]},
          open('films6.json', 'w'), ensure_ascii=False, indent=1)
