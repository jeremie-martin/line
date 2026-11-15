// Historical follower through today's picture. The exact vendored step is bundled by prepare.
import step from '/generated/hit-effects/follower.js';
import {legacyZoomAt} from './hit-motion-zoom.mjs';
import {W, H, createFraming} from '../../scripts/video/camera.js';
const BODY = new Set(['BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT']);
export function framingFor(mode, replay, scene) {
  if (mode === 'current') return createFraming;
  return motion => {
    const centres = mode !== 'old-ten' ? replay.frames.map(f => {
      const p = f.points.filter(p => BODY.has(p.name));
      return {x: p.reduce((s, p) => s + p.pos.x, 0) / p.length, y: p.reduce((s, p) => s + p.pos.y, 0) / p.length};
    }) : motion.centres;
    let c = centres[0];
    const cams = centres.map((p, f) => {
      const z = mode === 'old-authored' ? legacyZoomAt(scene.authoredCamera, scene.authoredContacts, f / 40) : 6.2;
      c = step(c, p, {zoom: z, width: W, height: H});
      const r = motion.centres[f];
      return {x: r.x, y: r.y, z, ax: W / 2 + (r.x - c.x) * z, ay: H * 0.36 + (r.y - c.y) * z};
    });
    return (time, at) => {
      const f = Math.max(0, Math.min(at, cams.length - 1)), i = Math.floor(f), j = Math.min(i + 1, cams.length - 1), u = f - i;
      return {...Object.fromEntries(['x', 'y', 'z', 'ax', 'ay'].map(k => [k, cams[i][k] + (cams[j][k] - cams[i][k]) * u])), over: 0, ending: false};
    };
  };
}
