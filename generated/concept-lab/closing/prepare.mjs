// Prepares the closing boards: the study that takes their answers, and the songs board's data.
//   node generated/concept-lab/closing/prepare.mjs [videos=generated/videos/songs]
// Writes the study's manifest (labels/studies/ and generated/label-studies/: the ids that may be answered are the decisions of
// decisions.json and the songs of productions/) and generated/lab-rides/closing-songs.json: per song its title and zoom lanes
// (from its lab scene), the owner's marks on those lanes, whether he has judged its spec (decisions.json, "judged"), and its
// video from a batch folder (npm run videos -- --songs=all --seeds=1 --out=generated/videos/songs). Run again after any of
// those change.
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

const STUDY = 'closing-2026-11', ZOOM_MARKS = 'labels/studies/zoom-2026-11b.jsonl';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const videos = args.videos ?? 'generated/videos/songs', here = import.meta.dirname;
const {decisions, judged} = JSON.parse(readFileSync(join(here, 'decisions.json'), 'utf8'));
const names = readdirSync('productions').filter(d => existsSync(join('productions', d, 'spec.ts'))).sort();

const manifest = JSON.stringify({study: STUDY, questions: [],
  note: 'The closing boards (generated/concept-lab/closing/). One row per save; the latest row per clip counts. A clip is a decision (decisions.json; answers.choice is one of its options) or a song (answers.mark: in, rework or out). note: the owner\'s words.',
  clips: [...decisions.map(d => ({id: d.id})), ...names.map(id => ({id}))]}, null, 1) + '\n';
mkdirSync(join('generated/label-studies', STUDY), {recursive: true});
writeFileSync(join('generated/label-studies', STUDY, 'manifest.json'), manifest);
writeFileSync(join('labels/studies', `${STUDY}.manifest.json`), manifest);

const laneMarks = new Map(); // song → lane id → mark
if (existsSync(ZOOM_MARKS)) for (const line of readFileSync(ZOOM_MARKS, 'utf8').split('\n').filter(Boolean)) {
  const row = JSON.parse(line), lane = row.answers?.lane;
  if (lane) (laneMarks.get(row.clip) ?? laneMarks.set(row.clip, new Map()).get(row.clip)).set(lane, row.answers.mark);
}
const report = existsSync(join(videos, 'report.json')) ? JSON.parse(readFileSync(join(videos, 'report.json'), 'utf8')).videos : [];
const pretty = song => song.replace(/_selection$|_\d+s$/g, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const songs = names.map(song => {
  const scenePath = join('generated/lab-rides', `${song}.json`), scene = existsSync(scenePath) ? JSON.parse(readFileSync(scenePath, 'utf8')) : null;
  const video = report.find(v => v.song === song && (v.state === 'made' || v.state === 'kept'));
  const length = song.match(/_(\d+)s$/)?.[1], kind = song.match(/_((?:ultra_|super_)?slowed|extended|original)(?:_selection)?$/)?.[1];
  return {song, title: [pretty(song.replace(/_((ultra_|super_)?slowed|extended|original)(?=_selection$)/, '')), kind?.replace('_', ' '), length ? `${length} s` : null].filter(Boolean).join(' · '),
    judged: judged[song] ?? null,
    lanes: (scene?.zooms ?? []).map(z => ({id: z.id, name: z.name, mark: laneMarks.get(song)?.get(z.id) ?? null})),
    video: video ? {src: `/${relative(resolve('.'), resolve(videos, `${video.name}.mp4`))}`, theme: video.theme, zoom: video.zoom, seed: video.seed, valid: video.valid} : null};
});
writeFileSync('generated/lab-rides/closing-songs.json', JSON.stringify({songs}, null, 1) + '\n');
console.log(`${decisions.length} decisions, ${songs.length} songs (${songs.filter(s => s.video).length} with a video, ${songs.filter(s => s.judged).length} with a judged spec)`);
console.log('Boards: /generated/concept-lab/closing/decisions.html and /generated/concept-lab/closing/songs.html');
