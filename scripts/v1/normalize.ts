import {
  CALIB,
  FPS,
  PREROLL,
  START_DEFAULTS,
  secToFrame,
} from "../v0/types.ts";
import { makeRng } from "../lib/rng.ts";
import type {
  NormalizedGap,
  NormalizedSpecContext,
  PrerollPolicy,
  ResolvedStart,
  SectionAxes,
  SectionWindow,
  Spec,
} from "./types.ts";
import { clamp, stableHash } from "./deterministic_math.ts";

const AXES = ["air", "speed", "contact_style", "grain"] as const;

export function normalizeSpec(spec: Spec, seed: number): NormalizedSpecContext {
  validateSpec(spec);
  const searchSpec = withResolvedPrerollStart(spec);
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = [...searchSpec.contacts]
    .map((contact) => secToFrame(contact.t))
    .sort((a, b) => a - b);
  const contactFrameSet = new Set(contactFrames);
  const startState = resolveStartState(searchSpec);
  const targetRng = makeRng(seed);
  const gaps = sliceTimeline(contactFrames, durationFrames)
    .map((gap): NormalizedGap => {
      const sectionAxes = effectiveAxes(gap, searchSpec);
      return {
        ...gap,
        contactFrame: gap.endsWithContact ? gap.endFrame : null,
        sectionAxes,
        targets: shouldSampleTargets(sectionAxes)
          ? sampleGapTargets(sectionAxes, CALIB.SIGMA, targetRng)
          : sectionAxes,
      };
    });
  const sectionWindows = searchSpec.sections.map((section, sectionIndex): SectionWindow => ({
    sectionIndex,
    startFrame: secToFrame(section.t0),
    endFrame: secToFrame(section.t1),
    axes: {
      ...(section.air !== undefined ? { air: section.air } : {}),
      ...(section.speed !== undefined ? { speed: section.speed } : {}),
      ...(section.contact_style !== undefined ? { contact_style: section.contact_style } : {}),
      ...(section.grain !== undefined ? { grain: section.grain } : {}),
    },
  }));

  return {
    originalSpec: cloneSpec(spec),
    specHash: stableHash({
      version: "v1-normalized-spec",
      spec: searchSpec,
      durationFrames,
      contactFrames,
      sectionWindows,
      startState,
      prerollPolicy: resolvePrerollPolicy(spec),
    }),
    seed,
    durationFrames,
    contactFrames,
    contactFrameSet,
    gaps,
    sectionWindows,
    startState,
    prerollPolicy: resolvePrerollPolicy(spec),
  };
}

function withResolvedPrerollStart(spec: Spec): Spec {
  if ((spec.preroll ?? 0) <= 0 || spec.start !== undefined) return spec;
  const firstAxes = firstSectionAxes(spec);
  const openingSpeed = firstAxes.speed ?? 0.45;
  const openingAir = firstAxes.air ?? 0.5;
  const openingContact = firstAxes.contact_style ?? 0.5;
  if (openingSpeed <= 0.45 && openingAir <= 0.35) return spec;
  if (openingSpeed < 0.7 && openingAir < 0.7) return spec;

  const targetSpeed = Math.min(
    START_DEFAULTS.VELOCITY_SANITY_CAP,
    Math.max(
      START_DEFAULTS.VELOCITY.x,
      openingSpeed * CALIB.SPEED_CAP * 0.75,
      openingSpeed >= 0.7 && openingAir >= 0.7 && openingContact >= 0.55 ? 8.5 : 0,
    ),
  );
  const angleDeg = openingAir >= 0.7
    ? openingContact >= 0.55 ? -5 : 10
    : openingAir <= 0.35 ? 20 : 5;
  const angle = (angleDeg * Math.PI) / 180;
  return {
    ...spec,
    start: {
      vx: round3(Math.cos(angle) * targetSpeed),
      vy: round3(Math.sin(angle) * targetSpeed),
    },
    preroll: undefined,
  };
}

function firstSectionAxes(spec: Spec): SectionAxes {
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  const activeAtZero = spec.sections.filter((section) => section.t0 <= 0 && section.t1 >= 0);
  const sections = activeAtZero.length > 0
    ? activeAtZero
    : [...spec.sections].sort((a, b) => a.t0 - b.t0).slice(0, 1);
  for (const section of sections) {
    if (section.air !== undefined) axes.air = section.air;
    if (section.speed !== undefined) axes.speed = section.speed;
    if (section.contact_style !== undefined) axes.contact_style = section.contact_style;
    if (section.grain !== undefined) axes.grain = section.grain;
  }
  return axes;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function shouldSampleTargets(sectionAxes: SectionAxes): boolean {
  return (sectionAxes.air ?? 0.5) > 0.4 && (sectionAxes.speed ?? 0.5) > 0.45;
}

export function validateSpec(spec: Spec): void {
  if (!Number.isFinite(spec.duration) || spec.duration <= 0) {
    throw new Error("Spec.duration must be > 0");
  }
  for (const contact of spec.contacts) {
    if (!Number.isFinite(contact.t) || contact.t < 0 || contact.t > spec.duration) {
      throw new Error(`Contact.t (${contact.t}) out of [0, ${spec.duration}]`);
    }
  }
  for (const section of spec.sections) {
    if (
      !Number.isFinite(section.t0)
      || !Number.isFinite(section.t1)
      || section.t0 < 0
      || section.t1 > spec.duration
      || section.t0 >= section.t1
    ) {
      throw new Error(`Section [${section.t0}, ${section.t1}] invalid for duration ${spec.duration}`);
    }
    if (section.air !== undefined && (section.air < 0 || section.air > 0.99)) {
      throw new Error(`Section.air (${section.air}) out of [0, 0.99]`);
    }
    for (const key of ["speed", "contact_style", "grain"] as const) {
      const value = section[key];
      if (value !== undefined && (value < 0 || value > 1)) {
        throw new Error(`Section.${key} (${value}) out of [0, 1]`);
      }
    }
  }
  validateDefaults(spec.defaults);
  validateStartSpec(spec.start);
  validatePreroll(spec.preroll);
}

export function resolveStartState(spec: Spec): ResolvedStart {
  if (spec.start === undefined) {
    return {
      position: { ...START_DEFAULTS.POSITION },
      velocity: { ...START_DEFAULTS.VELOCITY },
    };
  }
  return {
    position: {
      x: spec.start.x ?? START_DEFAULTS.POSITION.x,
      y: spec.start.y ?? START_DEFAULTS.POSITION.y,
    },
    velocity: { x: spec.start.vx, y: spec.start.vy },
  };
}

export function resolvePrerollPolicy(spec: Spec): PrerollPolicy {
  const seconds = spec.preroll ?? 0;
  if (seconds <= 0) return { kind: "none" };
  if (spec.start !== undefined) return { kind: "manual_start_consumes_preroll", seconds };
  return { kind: "deferred_start_search", seconds };
}

export function sliceTimeline(contactFrames: readonly number[], durationFrames: number): NormalizedGap[] {
  const gaps: NormalizedGap[] = [];
  let index = 0;
  let cursor = 0;
  for (const contactFrame of contactFrames) {
    gaps.push({
      index: index++,
      startFrame: cursor,
      endFrame: contactFrame,
      endsWithContact: true,
      targets: {},
      contactFrame,
      sectionAxes: {},
    });
    cursor = contactFrame;
  }
  if (cursor < durationFrames) {
    gaps.push({
      index,
      startFrame: cursor,
      endFrame: durationFrames,
      endsWithContact: false,
      targets: {},
      contactFrame: null,
      sectionAxes: {},
    });
  }
  return gaps;
}

export function effectiveAxes(
  gap: Pick<NormalizedGap, "startFrame" | "endFrame">,
  spec: Spec,
): SectionAxes {
  const sums: Record<keyof SectionAxes, number> = {
    air: 0,
    speed: 0,
    contact_style: 0,
    grain: 0,
  };
  const counts: Record<keyof SectionAxes, number> = {
    air: 0,
    speed: 0,
    contact_style: 0,
    grain: 0,
  };

  for (let frame = gap.startFrame; frame <= gap.endFrame; frame++) {
    const axes = axesAtFrame(frame, spec);
    for (const key of AXES) {
      const value = axes[key];
      if (value === undefined) continue;
      sums[key] += value;
      counts[key]++;
    }
  }

  const out: SectionAxes = {};
  for (const key of AXES) {
    if (counts[key] > 0) out[key] = sums[key] / counts[key];
  }
  return out;
}

export function axesAtFrame(frame: number, spec: Spec): SectionAxes {
  const t = frame / FPS;
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  for (const section of spec.sections) {
    if (section.t0 > t || section.t1 < t) continue;
    if (section.air !== undefined) axes.air = section.air;
    if (section.speed !== undefined) axes.speed = section.speed;
    if (section.contact_style !== undefined) axes.contact_style = section.contact_style;
    if (section.grain !== undefined) axes.grain = section.grain;
  }
  return axes;
}

export function axisCost(target: SectionAxes, achieved: SectionAxes): number {
  let cost = 0;
  for (const key of AXES) {
    const targetValue = target[key];
    const achievedValue = achieved[key];
    if (targetValue !== undefined && achievedValue !== undefined) {
      const delta = targetValue - achievedValue;
      cost += delta * delta;
    }
  }
  return cost;
}

export function sampleGapTargets(
  section: SectionAxes,
  sigma: number,
  rng: () => number,
): SectionAxes {
  const out: SectionAxes = {};
  if (section.air !== undefined) out.air = clamp(gauss(rng, section.air, sigma), 0, 0.99);
  if (section.speed !== undefined) out.speed = clamp(gauss(rng, section.speed, sigma), 0, 1);
  if (section.contact_style !== undefined) {
    out.contact_style = clamp(gauss(rng, section.contact_style, sigma), 0, 1);
  }
  if (section.grain !== undefined) out.grain = clamp(gauss(rng, section.grain, sigma), 0, 1);
  return out;
}

function gauss(rng: () => number, mean: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
}

function validateDefaults(defaults: Spec["defaults"]): void {
  if (defaults === undefined) return;
  if (defaults.air !== undefined && (defaults.air < 0 || defaults.air > 0.99)) {
    throw new Error(`Spec.defaults.air (${defaults.air}) out of [0, 0.99]`);
  }
  for (const key of ["speed", "contact_style", "grain"] as const) {
    const value = defaults[key];
    if (value !== undefined && (value < 0 || value > 1)) {
      throw new Error(`Spec.defaults.${key} (${value}) out of [0, 1]`);
    }
  }
}

function validateStartSpec(start: Spec["start"]): void {
  if (start === undefined) return;
  if (typeof start.vx !== "number" || typeof start.vy !== "number") {
    throw new Error("Spec.start must include numeric vx and vy");
  }
  const cap = START_DEFAULTS.VELOCITY_SANITY_CAP;
  for (const [key, value] of Object.entries(start) as [string, number][]) {
    if (!Number.isFinite(value)) {
      throw new Error(`Spec.start.${key} must be finite (got ${value})`);
    }
    if ((key === "vx" || key === "vy") && Math.abs(value) > cap) {
      throw new Error(`Spec.start.${key} (${value}) exceeds sanity cap ±${cap} px/frame`);
    }
  }
}

function validatePreroll(preroll: Spec["preroll"]): void {
  if (preroll === undefined) return;
  if (!Number.isFinite(preroll) || preroll < 0) {
    throw new Error(`Spec.preroll must be ≥0 (got ${preroll})`);
  }
  if (preroll > PREROLL.MAX_S) {
    throw new Error(`Spec.preroll (${preroll}s) exceeds sanity cap ${PREROLL.MAX_S}s`);
  }
}

function cloneSpec(spec: Spec): Spec {
  return {
    duration: spec.duration,
    contacts: spec.contacts.map((contact) => ({ ...contact })),
    sections: spec.sections.map((section) => ({ ...section })),
    ...(spec.defaults ? { defaults: { ...spec.defaults } } : {}),
    ...(spec.start ? { start: { ...spec.start } } : {}),
    ...(spec.preroll !== undefined ? { preroll: spec.preroll } : {}),
  };
}

export { CALIB, FPS, secToFrame };
