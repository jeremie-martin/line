import {realizedHits, realizedPunchAt, PUNCH_DEFAULT} from './hit-motion-realized.mjs';
// Recovered from pre-one-canvas scripts/lib/video_options.ts (281f6390^).
// Original production: authored log2 zoom, cubic easing, ×1.8; top 30% authored
// contacts punch 6.5–13%, one-frame anticipation, four-frame exponential recovery.
const clamp = x => Math.max(0, Math.min(1, x));
const cubic = x => (x = clamp(x), x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export function legacyZoomAt(camera, contacts = [], time, includePunch = true) {
  const keys = camera?.zoom?.keyframes;
  if (!keys?.length) return 6.2; // no historical lane for this song
  const f = time * 40;
  let i = 0; while (i < keys.length - 2 && f > Math.round(keys[i + 1].t * 40)) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], fa = Math.round(a.t * 40), fb = Math.round(b.t * 40);
  const u = fb === fa ? 0 : cubic((f - fa) / (fb - fa));
  const base = 1.8 * 2 ** (Math.log2(a.zoom) + (Math.log2(b.zoom) - Math.log2(a.zoom)) * u);
  return base * (includePunch ? legacyPunchAt(camera, contacts, time) : 1);
}

/** The short authored-beat pulse, independent of the slow zoom lane. */
export function legacyPunchAt(camera, contacts = [], time) {
  const f = time * 40;
  const impacts = contacts.map(c => c.impact ?? 0).filter(v => v > 0).sort((a, b) => a - b);
  if (!impacts.length) return 1;
  const bp = {threshold: 0, amp: .13, floor: .5, decay: 4, attack: 1, dir: 'in', ...camera?.beatPunch};
  const gate = bp.threshold > 0 ? bp.threshold : impacts[Math.min(impacts.length - 1, Math.floor(.7 * impacts.length))], max = impacts.at(-1);
  let punch = 0;
  for (const c of contacts) {
    if (!(c.impact >= gate)) continue;
    const age = f - Math.round(c.t * 40); if (age < -Math.ceil(bp.attack) || age > Math.ceil(bp.decay * 5)) continue;
    const amplitude = bp.amp * (bp.floor + (1 - bp.floor) * clamp((c.impact - gate) / Math.max(1e-6, max - gate)));
    const shape = age < 0 ? (bp.attack > 0 ? cubic((age + bp.attack) / bp.attack) : 0) : age === 0 ? 1 : bp.decay > 0 ? Math.exp(-age / bp.decay) : 0;
    punch = Math.max(punch, amplitude * shape);
  }
  return Math.max(.05, 1 + (bp.dir === 'out' ? -1 : 1) * punch);
}

/** Actual camera samples: the renderer interpolates 40 Hz frames, including the pulse.
 * Separating the lane and multiplier leaves the old combined path unchanged. */
export function cameraZoomAt(mode, scene, frame, settings = PUNCH_DEFAULT) {
  const sample = f => {
    if (mode.startsWith('measured-')) return {base: 6.2, zoom: 6.2 * realizedPunchAt(realizedHits(scene), f / 40, settings)};
    const authored = mode === 'old-authored' || mode === 'old-zoom';
    const enabled = ['old-authored', 'old-punch', 'old-punch-locked'].includes(mode);
    const base = authored ? legacyZoomAt(scene.authoredCamera, scene.authoredContacts, f / 40, false) : 6.2;
    // Combined historical mode still falls back to fixed zoom if there is no lane.
    const zoom = mode === 'old-authored' ? legacyZoomAt(scene.authoredCamera, scene.authoredContacts, f / 40)
      : base * (enabled ? legacyPunchAt(scene.authoredCamera, scene.authoredContacts, f / 40) : 1);
    return {base, zoom};
  };
  const f = Math.max(0, frame), i = Math.floor(f), a = sample(i), b = sample(i + 1), u = f - i;
  const base = a.base + (b.base - a.base) * u, zoom = a.zoom + (b.zoom - a.zoom) * u;
  return {base, zoom, punch: 100 * (zoom / base - 1)};
}
