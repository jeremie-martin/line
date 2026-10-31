/** The geometry families: the wardrobe of support shapes that the seeded
 * planner can request. A family is one row here; planning, section styles,
 * the built geometry and the review page read this table.
 *
 * - `label`: the family's name on the review page.
 * - `style`: the profile settings its sections are built with
 *   (constructionStyle). The learned construction archives key on the
 *   resulting style, so changing a value leaves the family without its
 *   archived demonstrations.
 * - `heading`: a shaped family's tangent schedule. The family's id is then
 *   its motion profile.
 * - `minFrames`: the shortest section (frames between two landings) the
 *   family can realize. The planner gives a shorter section plain arcs with
 *   the same guidance. Measured (docs/research/compiler-stepback-20261031.md):
 *   with every section of one shaped family, 0.20 s quick pairs (8 frames)
 *   failed for all four shapes (fold on its first one) while 9 frames passed
 *   150 of 150 for each; guided plain arcs passed every 8-frame section.
 *
 * Plain `arcs` and `scattered` fragments have neither; the planner, search
 * and layout checks treat those two by name. Row order is the default
 * repertoire and the planner's draw order, so a new or reordered row changes
 * seeded plans: adding a family is a behavioural change (ARCHITECTURE.md,
 * "Geometry families", lists what then fails on purpose).
 *
 * Outside this table: fold's own search controls (foldBend, foldTiming,
 * foldBias), the realization checks shared with the frozen judge (a fold
 * needs its corners, any other shaped family two turn reversals), and the
 * future-value model's construction features, frozen with its training. */

const rad = (degrees: number) => degrees * Math.PI / 180;
const smooth = (x: number) => {x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};

/** Heading (radians) at shaped phase `w` in [0, 1], from the smooth curve's
 * heading `base`. The existing shapes scale their bend as 24° × `strength`. */
export type FamilyHeading = (base: number, w: number, strength: number, rippleCycles: number,
  endpoints?: {start: number; exit: number; foldAngle?: number}) => number;
export type GeometryFamily = {label: string;
  style?: {profileStart?: number; profileStrength?: number; rippleCycles?: number; faces?: number; foldAngle?: number};
  heading?: FamilyHeading; minFrames?: number};

export const GEOMETRY_FAMILIES = {
  arcs: {label: 'Arcs'},
  fold: {label: 'Folds', minFrames: 9, style: {profileStart: 0, profileStrength: 1, faces: 3, foldAngle: 30},
    heading: (base, w, strength, _rippleCycles, endpoints) => {
      if(!endpoints)throw new Error('fold requires its entry and exit headings');
      const target=w<1/3?endpoints.start:w<2/3?(endpoints.start+endpoints.exit)/2+rad(endpoints.foldAngle??50):endpoints.exit;
      return strength===1?target:base+strength*(target-base);
    }},
  serpentine: {label: 'S sweeps', minFrames: 9, style: {profileStart: 0, profileStrength: .8},
    heading: (base, w, strength) => base+rad(24*strength*1.6)*Math.sin(2*Math.PI*w)*Math.sin(Math.PI*w)},
  scallops: {label: 'Ripples', minFrames: 9, style: {profileStart: 0, profileStrength: 1, rippleCycles: 1},
    heading: (base, w, strength, rippleCycles) => base+rad(24*strength)*Math.sin(2*rippleCycles*Math.PI*w)},
  terraces: {label: 'Terraces', minFrames: 9, style: {profileStart: 0, profileStrength: .8},
    heading: (base, w, strength) => {
      const p=(w*2)%1;
      const step=smooth((p-.35)/.12)-smooth((p-.65)/.12);
      return base+rad(24*strength*1.5)*(step-.3)*Math.sin(Math.PI*w);
    }},
  scattered: {label: 'Scattered'},
} satisfies Record<string, GeometryFamily>;
export type Construction = keyof typeof GEOMETRY_FAMILIES;
