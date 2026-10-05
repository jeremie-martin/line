/** What the strength scale means physically: single hits on a flat floor at
 * rising speed into the surface (same construction as
 * tools/measure/survival_envelope.ts), each measured under line.strike.v3 with
 * survival, rendered as plain clips for the night report.
 *
 *   node --import tsx tools/report/scale_clips.ts [--out=generated/report/night] */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync, spawn} from 'node:child_process';
import {observe} from '../measure/observe.ts';
import {strikeMotionFrames, detectStrikes, STRIKE_V3_CONTRACT} from '../measure/strike.ts';
import {ensureMirror} from '../../scripts/produce/render.ts';
import {cutClip} from '../measure/clip_render.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const out = arg('out', 'generated/report/night'), G = .175, rad = (d: number) => d * Math.PI / 180;
const PROBES = [{v: 6, theta: 15, label: 'medium'}, {v: 8, theta: 30, label: 'a typical strong hit tonight'},
  {v: 8, theta: 45, label: 'near the limit at 45°'}, {v: 10, theta: 45, label: 'harder at 45°: the rider crashes'},
  {v: 9, theta: 80, label: 'a near-vertical drop: maximal and survived'}];

function track(v: number, theta: number) {
  const vx = v * Math.cos(rad(theta)), vy = v * Math.sin(rad(theta)), px = 6 * vx, py = 6 * vy + .5 * G * 36 + 12;
  return {startPosition: {x: 0, y: 0}, riders: [{startPosition: {x: 0, y: 0}, startVelocity: {x: vx, y: vy}}], duration: 140, version: '6.2',
    lines: [{id: 1, type: 0, x1: px - 3000, y1: py, x2: px + 3000, y2: py, flipped: false, leftExtended: false, rightExtended: false}]};
}
const dir = join(out, 'scale'); mkdirSync(dir, {recursive: true});
const mirror = await ensureMirror(), rows: any[] = [];
try {
  for (const [n, p] of PROBES.entries()) {
    const t = track(p.v, p.theta), o: any = observe(t, 120, []), first = o.frames.findIndex((f: any) => f.collisions.length);
    const e = detectStrikes(strikeMotionFrames(o), STRIKE_V3_CONTRACT).find(x => x.contactStart >= first);
    const f20 = o.frames[Math.min(o.frames.length - 1, first + 20)], survived = o.terminus.frame >= first + 20 && f20.mounted && f20.intact;
    const trackPath = join(dir, `${n + 1}.track.json`), ride = join(dir, `${n + 1}.ride.mp4`), clip = join(dir, `${n + 1}.mp4`);
    writeFileSync(trackPath, JSON.stringify(t));
    await new Promise<void>((done, fail) => spawn(process.execPath, ['--import', 'tsx', 'scripts/export.ts', `--track=${trackPath}`, '--zoom=12', '--res=1280x720', `--out=${ride}`],
      {env: {...process.env, LR_ENGINE: 'wasm'}, stdio: ['ignore', 'ignore', 'inherit']}).once('exit', c => c === 0 ? done() : fail(new Error(`export exited ${c}`))));
    // The ride has no song; add silence so every clip has an audio track.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', ride, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'copy', '-c:a', 'aac', ride + '.a.mp4']);
    cutClip(ride + '.a.mp4', first, clip);
    rows.push({label: p.label, speed: p.v, incidence: p.theta, normal: +(p.v * Math.sin(rad(p.theta))).toFixed(2), strength: e?.strength ?? 0, survived, src: '/' + clip});
    console.log(`${p.label}: v${p.v} ${p.theta}° → ${(e?.strength ?? 0).toFixed(2)} ${survived ? 'survived' : 'crashed'}`);
  }
} finally {mirror?.kill();}
writeFileSync(join(out, 'scale.json'), JSON.stringify({hitAt: 1, rows}, null, 1));
process.exit(0);
