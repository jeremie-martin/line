// node generated/concept-lab/closing/guides.mjs [--readings SONG …]
// What the owner said on the ear board (labels/studies/ear-2026-11.jsonl, the latest row per song), written for an author as
// productions/<song>/guide.json: per passage, what to follow as he set it, and the notes that selects (time, stem, attack,
// heard: tools/music/lines.py). A passage he did not make is the author's to read. The selection is the same as the page's
// (ear.mjs `selected`): a stem's notes at or above its least attack, in the kept bar slots, one note per 60 ms.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

const file = 'labels/studies/ear-2026-11.jsonl', latest = new Map();
if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {const row = JSON.parse(line); latest.set(row.clip, row);}
// --readings SONG …: for songs he has not answered, the proposed reading (productions/<song>/reading.json) stands in
if (process.argv[2] === '--readings') for (const song of process.argv.slice(3)) if (!latest.has(song) && existsSync(`productions/${song}/reading.json`))
  latest.set(song, {answers: JSON.parse(readFileSync(`productions/${song}/reading.json`, 'utf8')), note: 'From a proposed reading the owner has not confirmed.', at: null});
for (const [song, row] of latest) {
  const passages = row.answers?.passages ?? []; if (!passages.length) continue;
  const lines = JSON.parse(readFileSync(`productions/${song}/lines.json`, 'utf8')), {seconds: bar, first} = lines.bar;
  const slot = t => Math.round(((t - first) % bar + bar) % bar / bar * 16) % 16;
  const guide = {song, saved: row.at, note: row.note || undefined, bar: lines.bar, passages: passages.map(p => {
    const all = Object.entries(p.follow).flatMap(([stem, least]) => lines.stems[stem].filter(n => n.t >= p.from && n.t < p.to && n.attack >= least && (!p.slots || p.slots.includes(slot(n.t)))).map(n => ({t: n.t, stem, attack: n.attack, heard: n.heard}))).sort((a, b) => a.t - b.t);
    const notes = []; for (const n of all) {const last = notes.at(-1); if (last && n.t - last.t < 0.06) {if (Math.min(1, n.attack) > Math.min(1, last.attack)) notes[notes.length - 1] = n;} else notes.push(n);}
    return {from: p.from, to: p.to, follow: p.follow, slots: p.slots ?? undefined, note: p.note || undefined, notes};
  })};
  writeFileSync(`productions/${song}/guide.json`, JSON.stringify(guide, null, 1));
  console.log(song, guide.passages.map(p => `${p.from}-${p.to} ${Object.keys(p.follow).join('+')} ${p.notes.length}`).join(' | '));
}
