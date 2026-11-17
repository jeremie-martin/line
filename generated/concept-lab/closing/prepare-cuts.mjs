// node generated/concept-lab/closing/prepare-cuts.mjs
// For the cuts board (cuts.html): what the page needs of every song to choose a short cut of it. Writes
// generated/lab-rides/cuts.json: per song its length, a loudness curve to draw (every 50 ms), its rhythm (the measure a loop is
// judged by, scripts/video/loop_audio.ts, every STEP seconds, as small integers), its sections, the owner's note on its newest
// spec, a video of that spec where one exists, and the proposed cuts (cuts-a.json, cuts-b.json beside this file, where present).
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {HOP, decode, rhythm} from '../../../scripts/video/loop_audio.ts';

const RATE = 48000, DRAW = 0.05, here = 'generated/concept-lab/closing', skip = new Set(['derniere_danse_coral_selection']);
const notes = new Map(); for (const line of existsSync('labels/studies/astra-2026-11.jsonl') ? readFileSync('labels/studies/astra-2026-11.jsonl', 'utf8').split('\n').filter(Boolean) : []) {const row = JSON.parse(line); notes.set(row.clip, row.note?.trim() ?? '');}
const proposed = Object.assign({}, ...['cuts-a.json', 'cuts-b.json'].map(f => existsSync(`${here}/${f}`) ? JSON.parse(readFileSync(`${here}/${f}`, 'utf8')) : {}));
const titles = existsSync('generated/watch/astra.json') ? new Map(JSON.parse(readFileSync('generated/watch/astra.json', 'utf8')).passages.map(p => [p.id, p.label])) : new Map();
const songs = [];
for (const song of readdirSync('productions').sort()) {
  const audio = `productions/${song}/audio.mp3`; if (!existsSync(audio) || skip.has(song)) continue;
  const samples = decode(audio), frames = samples.length / 2, level = [];
  for (let at = 0; at < frames; at += DRAW * RATE) {let sum = 0, n = 0; for (let i = at; i < Math.min(frames, at + DRAW * RATE); i += 4) {sum += samples[2 * i] ** 2 + samples[2 * i + 1] ** 2; n++;} level.push(Math.sqrt(sum / (2 * n || 1)));}
  const top = Math.max(...level) || 1, scene = existsSync(`generated/lab-rides/${song}.json`) ? JSON.parse(readFileSync(`generated/lab-rides/${song}.json`, 'utf8')) : null;
  const video = ['pass2', 'astra2', 'astra', 'current'].map(v => `generated/videos/astra/${song}-${v}.mp4`).find(existsSync);
  songs.push({song, title: titles.get(song) ?? (scene?.title ?? song).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()), seconds: frames / RATE, level: level.map(v => Math.round(Math.sqrt(v / top) * 100)), rhythm: Array.from(rhythm(samples), v => Math.round(v * 4)),
    sections: (scene?.phases ?? []).map(p => ({name: p.name, t: p.t0})), note: notes.get(song) ?? '', video: video ? '/' + video : null, audio: '/' + audio,
    comment: proposed[song]?.comment ?? '', cuts: proposed[song]?.cuts ?? []});
  console.log(song, (frames / RATE).toFixed(1), `${proposed[song]?.cuts?.length ?? 0} proposals`, video ? '' : 'no video');
}
writeFileSync('generated/lab-rides/cuts.json', JSON.stringify({step: HOP / RATE, draw: DRAW, compared: 6, songs}));
