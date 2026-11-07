// node clip.mjs OUTDIR pal...  : 2 s of moving footage per palette, fork then bars, encoded at 3 Mbps 4:2:0; keeps source PNG + decoded frame
import {chromium} from 'playwright';
import {spawn, execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const [out, ...pals] = process.argv.slice(2);
const b = await chromium.launch({args: ['--mute-audio']});
const p = await b.newPage({viewport: {width: 1080, height: 1920}});
for (const pal of pals) for (const [form, m] of [['fork', 'music:red'], ['bars', 'music:redbars,bandY:mid']]) {
  await p.goto(`http://127.0.0.1:8770/generated/concept-lab/agents/round4-ideas/mock/?shot=1&song=los&c=ride&t=12&m=place:tamed,hit:strong,redBy:loud,${m}&pal=${pal}`);
  await p.waitForFunction(() => window.__ready === true, null, {timeout: 90000});
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-b:v', '3M', '-maxrate', '4.5M', '-bufsize', '6M', '-preset', 'medium', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', `${out}/${pal}-${form}.mp4`], {stdio: ['pipe', 'inherit', 'inherit']});
  const done = new Promise(r => ff.on('close', r));
  const N = 120, K = [40, 80, 110];
  for (let i = 0; i < N; i++) {const u = await p.evaluate(t => window.__renderAt(t), 12 + i / 60), buf = Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'); if (K.includes(i)) writeFileSync(`${out}/${pal}-${form}-${i}-src.png`, buf); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));}
  ff.stdin.end(); await done;
  for (const k of K) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/${pal}-${form}.mp4`, '-vf', `select=eq(n\\,${k}),scale=in_color_matrix=bt709:in_range=tv,format=rgb24`, '-frames:v', '1', `${out}/${pal}-${form}-${k}-dec.png`]);
}
await b.close();
