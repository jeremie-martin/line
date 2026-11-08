# Builds morning.html and films5.json for round 5.
import json, re
style = re.search(r'<style>(.*?)</style>', open('round3/morning.html').read(), re.S).group(1)
SONGS = [('los', 'Los Voltaje', 1), ('petrunko', 'Petrunko', 1), ('lua', 'Lua na Praça', 1), ('batidao', 'No Batidão', 0), ('burn', 'Let the World Burn', 0), ('coma', 'Montagem Coma', 0), ('tomada', 'Tomada (super slowed)', 0)]
links = ' · '.join(f'<a href="fourup/r5/{k}.mp4">{l}</a>' for k, l, _ in SONGS)
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Round five</title>
<style>{style}
table{{border-collapse:collapse;width:100%;font-size:14px;margin:6px 0}}
th,td{{text-align:left;padding:4px 6px;border-bottom:1px solid var(--line)}}
</style>
</head>
<body><main>
<p class="kicker">Round five · 6 November</p>
<h1>Your four films, sharpened</h1>
<p class="lead">Your decisions are in, the grey you noticed is fixed, and your ear on timing turned out to be right. Same format you got stuck to.</p>

<a class="card primary" href="fourup/r5/los.mp4"><span class="go">→</span><b>The four looks, 4K</b><span>Paper, Hokusai, Lagoon, Black. Lagoon replaces Waterline.</span></a>
<a class="card" href="fourup/r5/los-colours.mp4"><span class="go">→</span><b>Four new colours, 4K</b><span>Lagoon, Riso, Dune, Plum. You asked for more candidates. Also on <a href="fourup/r5/petrunko-colours.mp4">Petrunko</a> and <a href="fourup/r5/lua-colours.mp4">Lua</a>.</span></a>
<a class="card" href="./?q=1"><span class="go">→</span><b>Five short questions</b><span>Whenever you have time. No rush at all: the films are the main thing.</span></a>
<a class="card" href="/motion-gallery/video-compare.html?collection=/generated/concept-lab/films5.json"><span class="go">→</span><b>Switching player</b><span>One look at a time at full size, with Today alongside on three songs.</span></a>
<p class="small">The four looks on every song: {links}. <a href="./">Free lab</a>.</p>

<h2>What changed in the films</h2>
<ul>
<li><strong>Gone, as you decided:</strong> the ending ring, the larger rider, Waterline and the Ridge, Score, hits by source, Stay, Trailing, and Night on Hokusai.</li>
<li><strong>Red logic:</strong> your instinct was right. Hokusai and Black share a logic: red goes to the loudest bars. On Hokusai the number of red bars also grows and shrinks with recent impact (Heat), and on Black it stays at three. Paper’s Standing was the odd one out, so Paper now uses Black’s.</li>
<li><strong>Hits:</strong> Paper, Lagoon and Black use Refined. Hokusai stays on Held, because that’s the film you fell for. Question 1 settles it.</li>
<li><strong>Afterimage (Lagoon):</strong> it lasts 0.5–1.2 s now, four to five times longer, so at speed the camera carries it away before it fades, as you suggested. Lagoon also sits a little wider and uses the looser camera.</li>
<li><strong>Black:</strong> a rail now lights whole the moment the rider meets it. That’s my attempt at a well-posed ink ahead.</li>
<li><strong>Opening:</strong> the band is there from frame 0.</li>
<li><strong>Title</strong> sits higher (Lagoon). The vignette is static, about half its old strength, and off by default.</li>
<li><strong>Your Hokusai bars</strong> are unchanged on purpose.</li>
</ul>

<h2>You were right about the grey</h2>
<p>On all five songs I measured, 8–17 % of the course stayed pencil behind the rider, about 90 % of it within 14 units of the body, and a third of used rails ended in a grey tail. Inking relied only on recorded contacts, so a rail the sled skimmed never counted. Rails now ink as the rider passes. After the fix, nothing is left grey behind the rider on those five songs.</p>

<h2>Timing: your ear was right too</h2>
<p>I lined up the sound around every strong hit, on eight songs, and averaged it, so no detector is involved:</p>
<table><tr><th>Moment</th><th>Relative to the rider’s first touch</th></tr>
<tr><td>The sound’s rise (half-way up)</td><td>−6 to +10 ms, every song</td></tr>
<tr><td>“Later”, the measured hit time</td><td>+25 ms, one physics frame</td></tr>
<tr><td>The impact’s peak</td><td>+25 ms typical, +50 ms or later on about 30 % of hits</td></tr></table>
<p>So the first touch already lands with the sound, and “Later” really was about 25 ms late. Accents stay on the touch, which is measured per hit, with no fixed delay in the lab. The touch is quantised to 25 ms physics frames, and these averages say nothing about each single hit.</p>
<p><strong>The jolt</strong> is a different thing: a −15 ms shift built into the compiler, so it moves the tracks themselves. The code records it as your own choice by ear in June, from 0, −15 and −25 ms on one song. It seems to be working, since touches land within about 10 ms of the sound. I’d rather replace it than just delete it: removing it alone would probably move touches about 15 ms early. The clean version aims each contact at that hit’s measured sound, with no constant. That’s a compiler change with its own paired comparison, outside the lab, so tell me if you want it opened. <span class="small">My first detector misread Los Voltaje by about 60 ms; only the direct averaging above is reliable.</span></p>

<h2>Blind test</h2>
<p>Whenever you picked a side, the metric agreed: <strong>8 of 8</strong>. Speed alone also got 8 of 8, and impact alone 7. The one pair that really separated them went speed’s way, which fits what you wrote, though one pair proves little. Your repeated pairs were consistent, both answered “same”.</p>
<p>The misses matter more. You said “same” on Petrunko 7 s vs 33 s, where the metric says 0.16 vs 0.64, and on Burn 10 s vs 43 s, 0.62 vs 0.36. On Burn you explained that the passage changes half-way through, so five-second averages can mislead. Petrunko I can’t explain. So the metric has been right on direction and may overstate size. I haven’t tuned anything on this, and I’d leave it alone: nothing depends on it strongly yet, and only Whisper, the sun and the zoom options use it.</p>
<p>The blind test now lets you answer at any time, doesn’t jump ahead, keeps a note per pair, and every page links back here.</p>

<h2>Your other questions</h2>
<ul>
<li><strong>Are bars and fork the only two?</strong> No. Three colours, Blocks, Iris and the plain fork are still in the pool, and weighted choice per song is easy.</li>
<li><strong>Lyrics:</strong> we have when each note is sung, but not the words. A line of lyrics needs the text from you, or a transcription.</li>
<li><strong>Night’s exit:</strong> noted, and left alone until we hand-place all songs together. Night now appears only on Paper.</li>
<li><strong>The sun</strong> stays only with a palette that earns it: Hokusai, plus Dune’s own, which is a test.</li>
</ul>

<details><summary>Not checked</summary>
<ul>
<li>I’ve seen frames, not motion, and heard nothing. The timing table measures the sound, not how it feels.</li>
<li>Afterimage at this length is untested in motion and could clutter dense passages.</li>
<li>Whole rail may look jumpy where rails are short, and dotted rails light as one.</li>
<li>Plum’s amber and lilac have the same brightness, so they differ by hue alone. Dune’s accent is low-contrast on sand (1.8:1).</li>
<li>Nothing is committed, and production is unchanged. The compiler and specs are untouched.</li>
</ul></details>

<p class="small">Earlier rounds: <a href="round4/morning.html">4</a>, <a href="round3/morning.html">3</a>, <a href="round2/morning.html">2</a>, <a href="round1/morning.html">1</a>.</p>
</main></body></html>
'''
# Round 5 is frozen in round5/morning.html, and morning.html is now the index of every round (gen-morning6.py): never write over it.
print('round 5 is frozen in round5/: its page is not rewritten (films5.json is)')
LOOKS = [('paper', 'Paper', 'Graphite and one red on the fork, Refined, Night on the drop.'), ('hokusai', 'Hokusai', 'Indigo on washi, the bars, the sun, Held.'),
         ('lagoon', 'Lagoon', 'A new palette, wider, a looser camera, the title, the afterimage.'), ('black', 'Black', 'The dark, the fork, each rail lighting whole.')]
EXTRA = [('riso', 'Riso', 'Blue and fluorescent pink.'), ('dune', 'Dune', 'Sand and rust, with its own sun.'), ('plum', 'Plum', 'A second dark, plum and amber.')]
ps = []
for k, label, today in SONGS:
    v = [{'id': i, 'label': l, 'description': d, 'src': f'films5/{k}-{i}.mp4'} for i, l, d in LOOKS]
    if today:
        v.insert(0, {'id': 'today', 'label': 'Today (shipped)', 'description': 'The real production film.', 'src': f'../style-lab-v5/{k}-approved-full.mp4'})
        v += [{'id': i, 'label': l, 'description': d, 'src': f'films5/{k}-{i}.mp4'} for i, l, d in EXTRA]
    ps.append({'id': k, 'label': label, 'description': 'Full song, 1080 × 1920, 60 fps, with its music.', 'videos': v})
ids = [i for i, _, _ in LOOKS]
json.dump({'title': 'Concept films · round 5', 'groups': [
    {'id': 'looks', 'label': 'The four looks', 'description': 'Switch at the same moment.', 'variants': ids},
    {'id': 'today', 'label': 'Against today', 'description': 'On Los Voltaje, Petrunko and Lua, the real shipped film is here too.', 'variants': ['today'] + ids},
    {'id': 'colours', 'label': 'New colours', 'description': 'On Los Voltaje, Petrunko and Lua.', 'variants': ['lagoon', 'riso', 'dune', 'plum']}],
  'passages': ps, 'links': [{'label': 'Morning page', 'href': '/generated/concept-lab/morning.html'}, {'label': 'Round 4 films', 'href': '/motion-gallery/video-compare.html?collection=/generated/concept-lab/films4.json'}]},
  open('films5.json', 'w'), ensure_ascii=False, indent=1)
