// Round 51 (2026-11-14), toward closing the visual lab: what was left open. The band lit on strong hits (from 0.65) theme by theme
// on the dark themes, a dark partner at the drop for the light themes that have none, and two themes never picked on their own page.
//   node generated/concept-lab/round51.mjs   → candidates-closing.json (open /generated/concept-lab/?set=closing&q=1)
import {writeFileSync} from 'node:fs';
import {COLLECTION} from '../../scripts/video/collection.js';
import {GROUPS} from '../../scripts/video/choose.js';

const schemes = {}, drops = {}, drafts = [], spec = key => COLLECTION[key].spec, name = key => COLLECTION[key].name.replace(/ · v1$/, '');
const HIT_MOMENTS = [['Batidão, a run of strong hits, 38 s', 38.3, 'batidao'], ['Lua, a run of strong hits, 41 s', 40.5, 'lua'], ['Tomada, 47 s', 46.5, 'tomada'],
  ['Petrunko, 30 s', 30.2, 'petrunko'], ['Circus Minimus, its strongest hit, 51 s', 50.6, 'circus']];

// ── the band lit on strong hits, on every dark theme drawn with bars (themes too alike are shown once) ──
const dark = GROUPS.dark.map(g => [g].flat()[0]).filter(key => spec(key).look.band === 'bars');
for (const [i, keys] of [dark.slice(0, 16), dark.slice(16)].entries()) drafts.push({id: `c51lit${i + 1}`, name: `The band lights on strong hits: dark themes, ${i + 1} of 2`, source: 'Round 51',
  line: 'On every hit of strength 0.65 or more, the whole band takes the hot colour for as long as the hit lasts. You found it better on dark themes. Watch it play, change the song with the moments, and pick every theme that should get it; the others stay as they are.',
  song: 'batidao', t: 38.3, len: 6, moments: HIT_MOMENTS,
  variants: keys.map(key => ({label: name(key), look: {...spec(key).look, scheme: COLLECTION[key].id, hits: 'lit65'}, note: ''}))});

// ── a dark partner at the drop for the light themes that have none; the partners are the nine dark themes used as partners today ──
const PARTNERS = ['rothko', 'cyanotype', 'cobaltChartreuse', 'blackIris', 'negoro', 'lilyLeaf', 'jungleMoon', 'violetMarigold', 'forestGold'];
for (const light of ['stone', 'stoneCool', 'linen', 'sage', 'sky', 'eucalyptus', 'heather', 'olivePaper', 'lichen', 'dove', 'morandi']) drafts.push({id: `c51drop${light}`, name: `${name(light)}: a dark partner at the drop`, source: 'Round 51',
  line: `${name(light)} has no partner for the drop, so it never changes. Here it hands over to nine dark themes at the drop and keeps its own hot bar and sun. Play through the drop and pick every partner you would be happy to see; “none” keeps it without a drop.`,
  variants: PARTNERS.map(darkKey => {
    const scheme = `c51-${light}+${darkKey}`;
    schemes[scheme] = spec(light).colours; drops[scheme] = COLLECTION[darkKey].id;
    return {label: `→ ${name(darkKey)}`, look: {...spec(light).look, scheme, drop: 'switch'}, note: ''};
  })});

// ── two themes never picked on a page of their own ──
drafts.push({id: 'c51keep', name: 'Two themes you passed over: still wanted?', source: 'Round 51',
  line: 'Seashell and Amber and Purple are in the collection from the early rounds, and neither was picked when it came back on a page of its own. As they are today. Pick the ones to keep; “none” removes both.',
  variants: ['seashell', 'amberPurple'].map(key => ({label: name(key), look: {...spec(key).look, scheme: COLLECTION[key].id}, note: ''}))});

writeFileSync(new URL('./candidates-closing.json', import.meta.url), JSON.stringify({round: 51, about: 'Round 51, toward closing: the band lit on strong hits, drop partners for the newer light themes, two themes to keep or remove.', schemes, drops, drafts}, null, 1) + '\n');
console.log(`closing: ${drafts.length} pages`);
