// Candidate response: absolute realized strength, never a song percentile or a request.
export const PUNCH_DEFAULT = Object.freeze({threshold: .55, reference: .85, peak: .13, cap: .35, attack: .025, decay: .1});
export function punchSettings(overrides = {}) {
  const p = {...PUNCH_DEFAULT, ...overrides};
  if (!Object.values(p).every(Number.isFinite) || p.threshold < 0 || p.threshold >= p.reference || p.peak < 0 || p.cap < p.peak || p.attack < 0 || p.decay <= 0)
    throw new Error('Invalid measured-punch response');
  return p;
}
/** Smooth threshold to reference, linear growth above reference, explicit safety cap. */
export function punchAmplitude(strength, p = PUNCH_DEFAULT) {
  if (strength <= p.threshold) return 0;
  const x = (strength - p.threshold) / (p.reference - p.threshold);
  return Math.min(p.cap, p.peak * (x <= 1 ? x * x * (3 - 2 * x) : x));
}
/** Offline render: the 25 ms rise leads into the measured peak, then releases over 100 ms.
 * Max overlap, no accumulation. Timing is independent of strength and of other hits. */
export function realizedPunchAt(hits, time, p = PUNCH_DEFAULT) {
  let value = 0;
  for (const hit of hits) {
    const age = time - hit.time;
    if (age < -p.attack || age > p.decay * 5) continue;
    const u = p.attack ? Math.max(0, Math.min(1, (age + p.attack) / p.attack)) : 1;
    const envelope = age < 0 ? u * u * (3 - 2 * u) : Math.exp(-age / p.decay);
    value = Math.max(value, punchAmplitude(hit.strength, p) * envelope);
  }
  return 1 + value;
}
const prepared = new WeakMap();
/** Same matched measured events as the production hit model; scene inputs are immutable. */
export function realizedHits(scene) {
  if (!prepared.has(scene)) prepared.set(scene, (scene.account?.matches ?? []).map(m => {
    const event = scene.account.events[m.event];
    return {time: event.peak / 40, strength: event.strength};
  }));
  return prepared.get(scene);
}
