// node generated/concept-lab/prepare-loops.mjs
// For the opening-and-ending page: every prepared lab ride again, so its scene plays the looping recording and its band is
// computed from it, and each song's recording blended over other lengths, to compare by ear (generated/lab-rides/loops.json).
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {buildScene} from '../../scripts/video/scene.ts';
import {loopRecording} from '../../scripts/video/loop_audio.ts';
const out = 'generated/lab-rides', loops = {};
for (const name of readdirSync(out).filter(n => n.endsWith('.json') && !['loops.json', 'closing-songs.json'].includes(n))) {
  const old = JSON.parse(readFileSync(join(out, name))); if (!old.provenance?.production || !old.song) continue;
  const scene = buildScene(old.song, JSON.parse(readFileSync(old.provenance.production)));
  writeFileSync(join(out, name), JSON.stringify({...scene, provenance: old.provenance}));
  const lengths = {}; let loop;
  for (const seconds of [0.25, 1, 2]) {const made = loopRecording(old.song, seconds); lengths[seconds] = made.audio; loop = made.loop;}
  const mirrored = {};
  if (loop === 'fade') for (const seconds of [0.25, 0.5, 1]) mirrored[seconds] = loopRecording(old.song, seconds, true).audio;
  loops[old.song] = {loop, lengths, mirrored};
  console.log(old.song, loop);
}
writeFileSync(join(out, 'loops.json'), JSON.stringify(loops));
