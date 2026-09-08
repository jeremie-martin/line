import { FPS, type Spec } from '../types.ts';

/** Validate timeline numbers before frame-by-frame validation or backend routing.
 * Keep contacts and their authored impact together when ordering the timeline.
 * Already ordered specifications retain their original object identity. */
export function normalizeCompilerTimeline(spec: Spec): Spec {
  const frames = Math.round(spec.duration * FPS);
  if (!Number.isFinite(spec.duration) || spec.duration <= 0 ||
      !Number.isSafeInteger(frames) || frames > Number.MAX_SAFE_INTEGER - 20) {
    throw new Error('Spec.duration must be finite, positive and representable in frames');
  }
  for (const contact of spec.contacts) {
    if (!Number.isFinite(contact.t)) throw new Error('Contact.t must be finite');
  }
  if (spec.contacts.every((c, i) => i === 0 || spec.contacts[i - 1].t <= c.t)) return spec;
  return {...spec, contacts: spec.contacts.slice().sort((a, b) => a.t - b.t)};
}

export function validateCompilerTelemetry(level: string | undefined): void {
  if (level !== undefined && !['off', 'summary', 'trace'].includes(level)) {
    throw new Error('budgetTelemetry must be off|summary|trace');
  }
}
