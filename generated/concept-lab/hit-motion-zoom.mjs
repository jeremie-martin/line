// Recovered from pre-one-canvas scripts/lib/video_options.ts (281f6390^).
// Original production: authored log2 zoom, cubic easing, ×1.8; top 30% authored
// contacts punch 6.5–13%, one-frame anticipation, four-frame exponential recovery.
const clamp = x => Math.max(0, Math.min(1, x));
const cubic = x => (x = clamp(x), x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export function legacyZoomAt(camera, contacts = [], time) {
  const keys = camera?.zoom?.keyframes;
  if (!keys?.length) return 6.2; // no historical lane for this song
  const f = time * 40;
  let i = 0; while (i < keys.length - 2 && f > Math.round(keys[i + 1].t * 40)) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], fa = Math.round(a.t * 40), fb = Math.round(b.t * 40);
  const u = fb === fa ? 0 : cubic((f - fa) / (fb - fa));
  const base = 1.8 * 2 ** (Math.log2(a.zoom) + (Math.log2(b.zoom) - Math.log2(a.zoom)) * u);
  const impacts = contacts.map(c => c.impact ?? 0).filter(v => v > 0).sort((a, b) => a - b);
  if (!impacts.length) return base;
  const bp = {threshold: 0, amp: .13, floor: .5, decay: 4, attack: 1, dir: 'in', ...camera.beatPunch};
  const gate = bp.threshold > 0 ? bp.threshold : impacts[Math.min(impacts.length - 1, Math.floor(.7 * impacts.length))], max = impacts.at(-1);
  let punch = 0;
  for (const c of contacts) {
    if (!(c.impact >= gate)) continue;
    const age = f - Math.round(c.t * 40); if (age < -Math.ceil(bp.attack) || age > Math.ceil(bp.decay * 5)) continue;
    const amplitude = bp.amp * (bp.floor + (1 - bp.floor) * clamp((c.impact - gate) / Math.max(1e-6, max - gate)));
    const shape = age < 0 ? (bp.attack > 0 ? cubic((age + bp.attack) / bp.attack) : 0) : age === 0 ? 1 : bp.decay > 0 ? Math.exp(-age / bp.decay) : 0;
    punch = Math.max(punch, amplitude * shape);
  }
  return base * Math.max(.05, 1 + (bp.dir === 'out' ? -1 : 1) * punch);
}
