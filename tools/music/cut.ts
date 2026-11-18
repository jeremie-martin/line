/** A part of a song made a song of its own: productions/<name>/ holds the parent's audio from `from` to `to` and the parent's
 * evidence, shifted.
 *
 *   node tools/music/cut.ts --song=PARENT --name=NEW [--from=S --to=S] [--force]
 *
 * Without --from/--to, the cut is the owner's latest answer for PARENT in labels/studies/cut-2026-11.jsonl. A ride is compiled
 * from its song's first second, so a short needs its own folder; its spec is then written by hand from the parent's.
 *
 * Nothing is measured again: the cut's events are the parent's events. Every time in seconds becomes `t - from`, and an entry
 * is kept only when every time it holds lies in [0, length): an event and all its stems' times, a sung note and its event, a
 * vocal candidate and its landmarks, a beat, an onset, a frame. A note's duration and a span (an audio.json segment, a range
 * note) crossing an end are clipped to it. lines.json's beat phase (`bar.first`, a phase within one beat) is re-phased. The
 * vocal evidence's frame arrays are indexed, not timed: they start at the parent's frame nearest `from` (within half a hop).
 * The spectrogram is a picture and is drawn again from the new audio (tools/music/spectrogram.py).
 *
 * Written: audio.mp3 (decoded, cut to the sample, encoded with libmp3lame VBR quality 0 at the parent's rate), source.json
 * (the excerpt's place in the recording moved, `cutOf`), the evidence the parent has, notes.json (the owner's notes inside the
 * cut), and generated/stems/<name>/ (the four stems cut to the sample, stems.json and drums.json). Not written: spec.ts,
 * variants/, zooms.ts, music.ts, composition.json, readings, the catalog entry: an author writes them. An existing folder is
 * refused unless --force, which rewrites only the files listed in OWNED. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, symlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..'), STUDY = 'labels/studies/cut-2026-11.jsonl', STEMS = ['drums', 'bass', 'other', 'vocals'];
/** The files a cut writes, in its song folder and its stems folder; nothing else is touched. */
export const OWNED = {song: ['audio.mp3', 'source.json', 'events.json', 'sung.json', 'vocal-evidence.json', 'lines.json', 'audio.json', 'notes.json', 'spectrogram.json', 'spectrogram.png'],
  stems: [...STEMS.map(s => `${s}.wav`), 'stems.json', 'drums.json']};

/** A cut: `from` in seconds of the parent, `length` in seconds of the new song (its decoded length). */
export type Cut = {from: number; length: number};
type Json = any;
export type Shifted = {data: Json; kept: number; dropped: number};

const places = (x: number) => {const s = String(x), e = s.indexOf('e'), d = s.indexOf('.'); return e >= 0 ? 10 : d < 0 ? 0 : s.length - d - 1;};
/** `t - from`, written with no more decimals than the two had. */
export const shift = (t: number, from: number) => Number((t - from).toFixed(Math.min(10, Math.max(places(t), places(from)))));
const inside = (t: number | null | undefined, c: Cut) => t === null || t === undefined || (t >= 0 && t < c.length);

/** Keeps the entries of `list` whose times all fall inside once shifted, shifting them; counts kept and dropped. */
function keep<T>(list: T[], c: Cut, move: (x: T) => T, times: (x: T) => Array<number | null | undefined>, tally: {kept: number; dropped: number}): T[] {
  const out: T[] = [];
  for (const x of list) {const y = move(x); if (times(y).every(t => inside(t, c))) out.push(y);}
  tally.kept += out.length; tally.dropped += list.length - out.length;
  return out;
}
const counter = () => ({kept: 0, dropped: 0});
/** A duration from `t` clipped to the end of the cut (two decimals, as sung.py writes them). */
const clipDur = (t: number, dur: number | undefined, c: Cut) => dur === undefined ? undefined : Math.min(dur, Math.floor((c.length - t) * 100 + 1e-9) / 100);

/** events.json: an event is kept when its time and every stem's time are inside. */
export function cutEvents(data: Json, c: Cut, song: string): Shifted {
  const n = counter(), at = (t: number) => shift(t, c.from);
  const events = keep(data.events, c, (e: Json) => ({...e, t: at(e.t), sources: Object.fromEntries(Object.entries(e.sources).map(([k, s]: [string, Json]) => [k, {...s, t: at(s.t)}]))}),
    e => [e.t, ...Object.values(e.sources).map((s: Json) => s.t)], n);
  return {data: {...data, song, events}, ...n};
}

const sungNote = (x: Json, c: Cut) => {
  const t = shift(x.t, c.from), y = {...x, t, ...(x.event ? {event: {...x.event, t: shift(x.event.t, c.from)}} : {})};
  if (x.dur !== undefined) y.dur = clipDur(t, x.dur, c);
  return y;
};
/** sung.json: a note (pitched or not) is kept when it and its event are inside; its duration is clipped to the end. */
export function cutSung(data: Json, c: Cut, song: string): Shifted {
  const n = counter(), times = (x: Json) => [x.t, x.event?.t];
  return {data: {...data, song, notes: keep(data.notes, c, x => sungNote(x, c), times, n), unpitched: keep(data.unpitched ?? [], c, x => sungNote(x, c), times, n)}, ...n};
}

/** vocal-evidence.json: candidates as sung notes, kept only when their landmarks are inside too; the frame arrays (rms,
 * spectralChange, bandFlux values; time = i * hop / rate) start at the parent's frame nearest `from` and hold as many frames as
 * the analysis gives a stem of the new length. `offset`: how far frame 0 is from `from` (s). `stemSeconds`: the cut stem. */
export function cutVocalEvidence(data: Json, c: Cut, song: string, stemSeconds: number): Shifted & {offset: number} {
  const n = counter(), hop = data.hopSamples, rate = data.sampleRate, first = Math.round(c.from * rate / hop);
  const count = Math.min(1 + Math.floor(Math.round(stemSeconds * rate) / hop), data.rms.length - first), frames = (a: unknown[]) => a.slice(first, first + count);
  const candidates = keep(data.candidates, c, (x: Json) => {
    const y = sungNote(x, c);
    if (x.landmarks) y.landmarks = {...x.landmarks, precedingMinimumT: shift(x.landmarks.precedingMinimumT, c.from), steepestRiseT: x.landmarks.steepestRiseT === null ? null : shift(x.landmarks.steepestRiseT, c.from)};
    return y;
  }, x => [x.t, x.event?.t, x.landmarks?.precedingMinimumT, x.landmarks?.steepestRiseT], n);
  return {data: {...data, song, duration: stemSeconds, rms: frames(data.rms), spectralChange: frames(data.spectralChange), bandFlux: data.bandFlux.map((b: Json) => ({...b, values: frames(b.values)})), candidates},
    ...n, offset: first * hop / rate - c.from};
}

/** lines.json: each stem's notes inside, shifted; the beat phase `bar.first` (in [0, bar/4), lines.py) moved by `-from`
 * modulo one beat, as lines.py finds it from the same notes. */
export function cutLines(data: Json, c: Cut, song: string): Shifted {
  const n = counter(), beat = data.bar.seconds / 4;
  const stems = Object.fromEntries(Object.entries(data.stems).map(([k, list]: [string, Json]) => [k, keep(list, c, (x: Json) => ({...x, t: shift(x.t, c.from)}), x => [x.t], n)]));
  const first = Number((((data.bar.first - c.from) % beat + beat) % beat).toFixed(3));
  return {data: {...data, song, seconds: Number(Math.min(data.seconds - c.from, c.length).toFixed(2)), bar: {...data.bar, first: first >= beat ? 0 : first}, stems}, ...n};
}

/** Frames given by a `times` array: those inside, with every parallel array cut alike. */
function framesInside(times: number[], c: Cut) {const keepAt = times.map(t => inside(shift(t, c.from), c)); return {keepAt, times: times.filter((_, i) => keepAt[i]).map(t => shift(t, c.from))};}

/** audio.json (analyze_audio.py, or the librosa-only form with `beat_times`): frames, onsets, beats and downbeats inside;
 * segments clipped to the cut (their means stay the parent's, over the whole segment); tempo unchanged. */
export function cutAudio(data: Json, c: Cut, song: string): Shifted {
  const n = counter(), at = (t: number) => shift(t, c.from), out: Json = {...data, duration: Number(c.length.toFixed(6))};
  if (typeof data.audio === 'string') out.audio = `productions/${song}/audio.mp3`;
  if (data.frames?.times) {
    const {keepAt, times} = framesInside(data.frames.times, c);
    out.frames = Object.fromEntries(Object.entries(data.frames).map(([k, v]: [string, Json]) => [k, k === 'times' ? times : v.filter((_: unknown, i: number) => keepAt[i])]));
    n.kept += times.length; n.dropped += data.frames.times.length - times.length;
    if (data.analysis?.n_frames !== undefined) out.analysis = {...data.analysis, n_frames: times.length};
  }
  if (data.onsets) out.onsets = keep(data.onsets, c, (x: Json) => ({...x, t: at(x.t)}), x => [x.t], n);
  if (data.beat_times) out.beat_times = keep(data.beat_times, c, at, t => [t], n);
  if (data.beat_grid) out.beat_grid = {...data.beat_grid, beats: keep(data.beat_grid.beats, c, (x: Json) => ({...x, t: at(x.t)}), x => [x.t], n), downbeats: keep(data.beat_grid.downbeats, c, at, t => [t], n)};
  if (data.segments) {
    const segments = data.segments.map((s: Json) => ({...s, t0: Math.max(0, at(s.t0)), t1: Math.min(Number(c.length.toFixed(3)), at(s.t1))})).filter((s: Json) => s.t1 > s.t0);
    out.segments = segments; n.kept += segments.length; n.dropped += data.segments.length - segments.length;
  }
  return {data: out, ...n};
}

/** stems.json: the envelope frames inside (their `times` shifted, so frame 0 is not at 0 but within one frame of it), with
 * every rms array cut alike; the mix's and each stem's onsets inside. */
export function cutStems(data: Json, c: Cut, song: string): Shifted {
  const n = counter(), {keepAt, times} = framesInside(data.times, c), rms = (a: number[]) => a.filter((_, i) => keepAt[i]);
  const part = (p: Json) => ({...p, rms: rms(p.rms), onsets: keep(p.onsets, c, (x: Json) => ({...x, t: shift(x.t, c.from)}), x => [x.t], n)});
  return {data: {...data, song, times, mix: part(data.mix), stems: Object.fromEntries(Object.entries(data.stems).map(([k, p]) => [k, part(p)]))}, ...n};
}

/** drums.json (drums.py): the hits inside. */
export function cutDrums(data: Json, c: Cut, song: string): Shifted {
  const n = counter();
  return {data: {...data, ...(data.song ? {song} : {}), hits: keep(data.hits, c, (x: Json) => ({...x, t: shift(x.t, c.from)}), x => [x.t], n)}, ...n};
}

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
/** notes.json (the owner's notes on the spec dashboard): moments and contacts inside, ranges that overlap the cut (clipped to
 * it); ids, tags and text kept, the clock in a title moved. A contact note's index is the parent ride's contact. */
export function cutNotes(data: Json, c: Cut, song: string): Shifted {
  const n = counter(), end = Number(c.length.toFixed(3)), out: Json[] = [];
  for (const x of data.notes) {
    const t = shift(x.t, c.from), t0 = x.t0 === null ? null : shift(x.t0, c.from), t1 = x.t1 === null ? null : shift(x.t1, c.from);
    const ranged = t0 !== null && t1 !== null;
    if (ranged ? !(t1 > 0 && t0 < end) : !inside(t, c)) {n.dropped++; continue;}
    const title = typeof x.title === 'string' ? x.title.replace(/\b(\d+):(\d\d\.\d\d)\b/g, (_: string, m: string, s: string) => clock(Math.max(0, shift(Number(m) * 60 + Number(s), c.from)))) : x.title;
    out.push({...x, t: ranged ? Math.min(end, Math.max(0, t)) : t, t0: ranged ? Math.max(0, t0) : t0, t1: ranged ? Math.min(end, t1) : t1, title}); n.kept++;
  }
  return {data: {...data, specPath: `productions/${song}/spec.ts`, notes: out}, ...n};
}

/** source.json: the excerpt's place in the recording moved to the cut, `cutOf` added; what was measured on the parent's excerpt
 * as a whole and would be false of the cut is dropped (`match`, `note`), its lengths and hashes recomputed. */
export function cutSource(data: Json | null, c: Cut & {to: number}, parent: string, hashes: {audio: string; stems: Record<string, string>}): Json {
  const cutOf = {song: parent, from: c.from, to: c.to};
  // a parent with no full recording is its cut's recording: what leads into the cut is in the parent's own excerpt
  if (!data?.file) return {...(data ?? {}), file: `${parent}.mp3`, sourceStartSeconds: Number(c.from.toFixed(3)), sourceEndSeconds: Number((c.from + c.length).toFixed(3)), cutOf};
  const {match: _match, note: _note, intent: _intent, reviewStatus: _status, ...rest} = data, out: Json = {...rest};  // words about the parent's excerpt are not the cut's
  if (typeof data.sourceStartSeconds === 'number') {
    out.sourceStartSeconds = Number((data.sourceStartSeconds + c.from).toFixed(3));
    out.sourceEndSeconds = Number((data.sourceStartSeconds + c.from + c.length).toFixed(3));
  }
  if ('decodedExcerptSeconds' in data) out.decodedExcerptSeconds = Number(c.length.toFixed(6));
  if ('audioSha256' in data) out.audioSha256 = hashes.audio;
  if (data.separation?.stemSha256) out.separation = {...data.separation, stemSha256: Object.fromEntries(Object.keys(data.separation.stemSha256).map(k => [k, hashes.stems[k]]))};
  return {...out, cutOf};
}

/** A WAV file cut to `seconds` from `from` (s), to the sample: RIFF chunks kept (`fact` updated), bytes copied, nothing
 * re-encoded. Returns the file, its sample rate and its frames. */
export function cutWav(file: Buffer, from: number, seconds: number): {wav: Buffer; rate: number; frames: number} {
  if (file.toString('ascii', 0, 4) !== 'RIFF' || file.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  const chunks: Array<{id: string; body: Buffer}> = [];
  for (let i = 12; i + 8 <= file.length;) {const id = file.toString('ascii', i, i + 4), size = file.readUInt32LE(i + 4); chunks.push({id, body: file.subarray(i + 8, i + 8 + size)}); i += 8 + size + (size & 1);}
  const fmt = chunks.find(x => x.id === 'fmt ')?.body, data = chunks.find(x => x.id === 'data');
  if (!fmt || !data) throw new Error('a WAV file without fmt or data');
  const rate = fmt.readUInt32LE(4), align = fmt.readUInt16LE(12), total = data.body.length / align;
  const a = Math.min(total, Math.round(from * rate)), b = Math.min(total, a + Math.round(seconds * rate)), body = data.body.subarray(a * align, b * align), frames = b - a;
  const parts = chunks.map(x => {
    const bodyOut = x.id === 'data' ? body : x.id === 'fact' ? Buffer.from(x.body) : x.body;
    if (x.id === 'fact') bodyOut.writeUInt32LE(frames, 0);
    const head = Buffer.alloc(8); head.write(x.id, 0, 'ascii'); head.writeUInt32LE(bodyOut.length, 4);
    return Buffer.concat([head, bodyOut, Buffer.alloc(bodyOut.length & 1)]);
  });
  const riff = Buffer.alloc(12); riff.write('RIFF', 0, 'ascii'); riff.write('WAVE', 8, 'ascii');
  const wav = Buffer.concat([riff, ...parts]); wav.writeUInt32LE(wav.length - 8, 4);
  return {wav, rate, frames};
}

/** The owner's cut for `clip`: his latest answer in the study file. */
export function savedCut(lines: string, clip: string): {from: number; to: number} {
  const rows = lines.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.clip === clip).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const last = rows.at(-1);
  if (!last || last.skipped || typeof last.answers?.start !== 'number' || typeof last.answers?.end !== 'number') throw new Error(`no saved cut for ${clip} in ${STUDY}`);
  return {from: last.answers.start, to: last.answers.end};
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const probe = (path: string) => {
  const [rate, channels] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'csv=p=0', path], {encoding: 'utf8'}).trim().split(',').map(Number);
  return {rate, channels};
};
const decodeNative = (path: string, channels: number) => {const b = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-'], {maxBuffer: 1 << 30}); return {pcm: b, frames: b.length / 4 / channels};};
const writeJson = (path: string, data: Json, like: string) => writeFileSync(path, (like.includes('\n') ? JSON.stringify(data, null, 2) : JSON.stringify(data)) + (like.endsWith('\n') ? '\n' : ''));

export type Report = {length: number; files: Array<{file: string; kept?: number; dropped?: number; note?: string}>; lineCheck: string};
/** Makes productions/<name>/ and generated/stems/<name>/ from `parent` cut at [from, to) (see the module text). `root`: the
 * repository. Refuses an existing folder unless `force`. */
export function cutSong(o: {root?: string; parent: string; name: string; from: number; to: number; force?: boolean}): Report {
  const root = o.root ?? ROOT, src = join(root, 'productions', o.parent), dst = join(root, 'productions', o.name), stemSrc = join(root, 'generated/stems', o.parent), stemDst = join(root, 'generated/stems', o.name);
  if (!/^[a-z0-9_]+$/.test(o.name) || o.name === o.parent) throw new Error(`not a new song name: ${o.name}`);
  if (!existsSync(join(src, 'audio.mp3'))) throw new Error(`no productions/${o.parent}/audio.mp3`);
  if (existsSync(dst) && !o.force) throw new Error(`productions/${o.name} exists; --force rewrites only the files a cut owns`);
  if (!(o.from >= 0 && o.to > o.from)) throw new Error(`not a cut: ${o.from}–${o.to}`);
  mkdirSync(dst, {recursive: true});
  const files: Report['files'] = [], wrote = new Set<string>();
  const put = (path: string, write: (temporary: string) => void) => {const temporary = `${path}.${process.pid}.tmp`; write(temporary); renameSync(temporary, path); wrote.add(path);};

  // the audio, to the sample: decoded at its own rate, cut, encoded, decoded again to check its length
  const {rate, channels} = probe(join(src, 'audio.mp3')), whole = decodeNative(join(src, 'audio.mp3'), channels);
  const a = Math.round(o.from * rate), b = Math.min(whole.frames, Math.round(o.to * rate));
  if (a >= b) throw new Error(`the cut starts after ${o.parent}'s end (${whole.frames / rate} s)`);
  const audioPath = join(dst, 'audio.mp3');
  put(audioPath, t => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', String(channels), '-i', 'pipe:0', '-c:a', 'libmp3lame', '-q:a', '0', '-f', 'mp3', t],
    {input: whole.pcm.subarray(a * channels * 4, b * channels * 4)}));
  const decoded = decodeNative(audioPath, channels).frames;
  if (decoded !== b - a) throw new Error(`the encoded cut decodes to ${decoded} frames, not ${b - a}`);
  const c: Cut = {from: o.from, length: (b - a) / rate};
  files.push({file: 'audio.mp3', note: `${c.length} s (${b - a} frames at ${rate} Hz, ${channels} ch; libmp3lame -q:a 0; decoded length checked)`});

  // the stems, to the sample
  mkdirSync(stemDst, {recursive: true});
  const stemHashes: Record<string, string> = {};
  let stemSeconds = c.length;
  for (const s of STEMS) {
    const path = join(stemSrc, `${s}.wav`);
    if (!existsSync(path)) continue;
    const {wav, frames, rate: r} = cutWav(readFileSync(path), o.from, c.length);
    put(join(stemDst, `${s}.wav`), t => writeFileSync(t, wav)); stemHashes[s] = sha(wav); stemSeconds = frames / r;
    files.push({file: `generated/stems/${o.name}/${s}.wav`, note: `${frames} frames at ${r} Hz`});
  }

  const evidence: Array<[string, string, (d: Json) => Shifted & {offset?: number}]> = [
    [src, 'events.json', d => cutEvents(d, c, o.name)], [src, 'sung.json', d => cutSung(d, c, o.name)],
    [src, 'vocal-evidence.json', d => cutVocalEvidence(d, c, o.name, stemSeconds)], [src, 'lines.json', d => cutLines(d, c, o.name)],
    [src, 'audio.json', d => cutAudio(d, c, o.name)], [src, 'notes.json', d => cutNotes(d, c, o.name)],
    [stemSrc, 'stems.json', d => cutStems(d, c, o.name)], [stemSrc, 'drums.json', d => cutDrums(d, c, o.name)]];
  const results: Record<string, Json> = {};
  for (const [from, name, apply] of evidence) {
    const path = join(from, name);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8'), out = apply(JSON.parse(text)), target = join(from === src ? dst : stemDst, name);
    put(target, t => writeJson(t, out.data, text)); results[name] = out.data;
    files.push({file: `${from === src ? 'productions' : 'generated/stems'}/${o.name}/${name}`, kept: out.kept, dropped: out.dropped,
      ...(out.offset !== undefined ? {note: `frame 0 is ${(out.offset * 1000).toFixed(1)} ms from the cut`} : {})});
  }

  const sourcePath = join(src, 'source.json');
  const record = cutSource(existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null, {...c, to: o.to}, o.parent, {audio: sha(readFileSync(audioPath)), stems: stemHashes});
  put(join(dst, 'source.json'), t => writeJson(t, record, '{\n}\n'));
  if (record.file === `${o.parent}.mp3`) {  // the parent's own audio, linked where recordings are looked for
    const link = join(ROOT, 'recordings', record.file); mkdirSync(join(ROOT, 'recordings'), {recursive: true});
    if (!existsSync(link)) symlinkSync(join(src, 'audio.mp3'), link);
  }
  files.push({file: `productions/${o.name}/source.json`, note: record.sourceStartSeconds === undefined ? 'cutOf only' : `${record.file} from ${record.sourceStartSeconds} s`});

  // a cut owns these files and no others: one the parent no longer has is removed, the rest of the folder is left alone
  for (const [folder, names] of [[dst, OWNED.song], [stemDst, OWNED.stems]] as const)
    for (const f of names) {const path = join(folder, f); if (!wrote.has(path) && existsSync(path) && !f.startsWith('spectrogram')) rmSync(path);}

  // the check asked of lines.json: its note times are the parent's minus `from`
  let lineCheck = 'no lines.json';
  if (results['lines.json']) {
    const parent = JSON.parse(readFileSync(join(src, 'lines.json'), 'utf8')), pairs: string[] = [];
    let worst = 0, compared = 0;
    for (const s of Object.keys(parent.stems)) {
      const was = parent.stems[s].filter((x: Json) => x.t - o.from >= -1e-9 && x.t - o.from < c.length), now = results['lines.json'].stems[s];
      if (was.length !== now.length) throw new Error(`lines.json ${s}: ${now.length} notes, ${was.length} expected`);
      was.forEach((x: Json, i: number) => {worst = Math.max(worst, Math.abs(now[i].t - (x.t - o.from))); compared++;});
      if (was.length) pairs.push(`${s} ${was[0].t}→${now[0].t}`);
    }
    lineCheck = `${compared} notes, largest |new − (parent − from)| ${worst.toExponential(1)} s; e.g. ${pairs.join(', ')}`;
  }
  return {length: c.length, files, lineCheck};
}

if (import.meta.main) {
  const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const parent = arg('song'), name = arg('name'), force = process.argv.includes('--force');
  if (!parent || !name || (arg('from') === undefined) !== (arg('to') === undefined)) throw new Error('Usage: node tools/music/cut.ts --song=PARENT --name=NEW [--from=S --to=S] [--force]');
  const {from, to} = arg('from') !== undefined ? {from: Number(arg('from')), to: Number(arg('to'))} : savedCut(readFileSync(join(ROOT, STUDY), 'utf8'), parent);
  const report = cutSong({parent, name, from, to, force});
  console.log(`${parent} ${from}–${to} s → productions/${name}/, ${report.length} s`);
  for (const f of report.files) console.log(`  ${f.file}${f.kept !== undefined ? `: kept ${f.kept}, dropped ${f.dropped}` : ''}${f.note ? `${f.kept !== undefined ? '; ' : ': '}${f.note}` : ''}`);
  console.log(`  lines.json check: ${report.lineCheck}`);
  const python = join(homedir(), '.venvs/line-stems/bin/python');
  if (existsSync(join(ROOT, 'productions', parent, 'spectrogram.json')) && existsSync(python)) {
    execFileSync(python, ['tools/music/spectrogram.py', `--song=${name}`], {cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit']});
    console.log(`  productions/${name}/spectrogram.{json,png}: drawn again from the new audio`);
  } else console.log(`  the spectrogram: run ~/.venvs/line-stems/bin/python tools/music/spectrogram.py --song=${name}`);
}
