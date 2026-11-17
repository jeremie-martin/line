// node generated/concept-lab/closing/prepare-ear.mjs [SONG …]
// For the ear board (ear.html): per song, the notes of each stem (productions/<song>/lines.json, tools/music/lines.py: made
// here when missing and the stems exist), the song's sections, the owner's marks where he made some, and the landings of the
// specs that have a compiled ride, to hear them as clicks, and a proposed reading where there is one
// (productions/<song>/reading.json: {summary, passages in the board's form, questions}). Writes generated/lab-rides/ear.json.
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';

const astra = '/home/holo/prog/line-specs-astra/generated', asked = folder => {
  const path = `${folder}/manifest.json`; if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')).cells[0].impactEvaluation.targets.map(t => [+(t.frame / 40).toFixed(3), +t.impact.toFixed(2)]);
};
const titles = existsSync('generated/lab-rides/cuts.json') ? new Map(JSON.parse(readFileSync('generated/lab-rides/cuts.json', 'utf8')).songs.map(s => [s.song, s.title])) : new Map();
const only = process.argv.slice(2), songs = [];
for (const song of readdirSync('productions').sort()) {
  if (!existsSync(`productions/${song}/audio.mp3`) || !existsSync(`generated/stems/${song}/drums.wav`) || (only.length && !only.includes(song))) continue;
  if (!existsSync(`productions/${song}/lines.json`)) execFileSync('python3', ['tools/music/lines.py', song], {stdio: 'ignore'});
  const lines = JSON.parse(readFileSync(`productions/${song}/lines.json`, 'utf8')), scene = existsSync(`generated/lab-rides/${song}.json`) ? JSON.parse(readFileSync(`generated/lab-rides/${song}.json`, 'utf8')) : null;
  const marks = {}; if (existsSync(`productions/${song}/notes.json`)) for (const n of JSON.parse(readFileSync(`productions/${song}/notes.json`, 'utf8')).notes) for (const tag of n.tags ?? []) if ((tag === 'voice' || tag === 'mark') && n.scope === 'moment') (marks[tag] ??= []).push(n.t);
  const specs = Object.fromEntries([['guided', `${astra}/guided/${song}-101`], ['blind', `${astra}/fresh/${song}-101`], ['round 2', [`${astra}/astra4/${song}-101`, `${astra}/astra4/${song}-ambitious-101`].find(f => existsSync(`${f}/manifest.json`))], ['astra', [`${astra}/astra3/${song}-101`, `${astra}/astra2/${song}-101`, `${astra}/astra/${song}-r2-101`, `${astra}/astra/${song}-101`].find(f => existsSync(`${f}/manifest.json`))], ['current', `generated/lab-rides/rides/${song}`]]
    .map(([name, folder]) => [name, folder && asked(folder)]).filter(([, v]) => v));
  songs.push({song, title: titles.get(song) ?? song, seconds: lines.seconds, bar: lines.bar, audio: `/productions/${song}/audio.mp3`,
    stems: Object.fromEntries(Object.entries(lines.stems).map(([s, notes]) => [s, notes.map(n => [n.t, n.attack, n.heard, n.share])])),
    sections: (scene?.phases ?? []).map(p => ({name: p.name, t: p.t0})), marks, specs,
    reading: existsSync(`productions/${song}/reading.json`) ? JSON.parse(readFileSync(`productions/${song}/reading.json`, 'utf8')) : undefined});
  console.log(song, Object.keys(specs).join(', '), Object.keys(marks).join(', '));
}
writeFileSync('generated/lab-rides/ear.json', JSON.stringify({songs}));
