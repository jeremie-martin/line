// node generated/concept-lab/seam-videos.mjs SONG…  : for each song, the last 8 s and the first 8 s of its video, as parts to join
// (generated/videos/loop-2/<song>-<version>-{end,start}.mp4 and the sound across the cut as <song>-<version>.wav).
// Versions: 'step' is production; 'cut' ends the song as cut (no loop point), for songs that have one.
import {execFileSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {readVerifiedJson, verifiedVideoCell} from '../../scripts/produce/video_input.ts';
import {buildScene, spectrum} from '../../scripts/video/scene.ts';
import {loopRecording} from '../../scripts/video/loop_audio.ts';
import {writeVideo} from '../../scripts/video/write.ts';
import {resolveLook} from '../../scripts/video/look.js';
import {chooseLook, chooseZoom} from '../../scripts/video/choose.js';
const out = 'generated/videos/loop-2', HALF = 8;
for (const song of process.argv.slice(2)) {
  const study = resolve('generated/lab-rides/rides', song), manifest = readVerifiedJson(join(study, 'manifest.json')), id = manifest.cells[0].id;
  const {c, record} = verifiedVideoCell(study, manifest, id), made = loopRecording(song);
  for (const version of made.trim ? ['step', 'cut'] : ['step']) {
    const scene = buildScene(c.id, record);
    if (version === 'cut') {
      const plain = loopRecording(song, undefined, false, false);
      scene.audio = plain.audio; scene.span = [0, plain.length]; scene.spectrum = spectrum(resolve(plain.audio), true);
    }
    scene.zoom = chooseZoom(id, scene.zooms);
    const look = resolveLook(null, chooseLook(id, {hasDrop: !!scene.drop}).look), end = scene.span[1], name = join(out, `${song}-${version}`);
    await writeVideo({scene, look, out: resolve(`${name}-end.mp4`), from: end - HALF, to: end, log: () => {}});
    await writeVideo({scene, look, out: resolve(`${name}-start.mp4`), from: 0, to: HALF, log: () => {}});
    // the sound across the cut, sample for sample: the recording's last HALF seconds up to the video's end, then its first
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', scene.audio, '-filter_complex', `[0:a]atrim=start=${end - HALF}:end=${end},asetpts=PTS-STARTPTS[a];[0:a]atrim=end=${HALF},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1,asplit[x][y];[x][y]concat=n=2:v=0:a=1`, `${name}.wav`]);
    console.log(song, version, `ends at ${end.toFixed(3)} s`, made.trim ? `(loop point ${made.trim.toFixed(2)} s early, match ${made.match?.toFixed(2)})` : `(${made.loop})`);
  }
}
