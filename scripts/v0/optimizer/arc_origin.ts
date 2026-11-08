/** Report only: which candidate source each evaluated control descends from.
 * A label is the root source (the first proposal) followed by the refinement
 * stages that derived it, consecutive repeats collapsed, e.g.
 * `memory>coordinate>response`. Off unless a research tool enables it; the
 * compiler never reads a label, so enabling it cannot move a ride. */
export const arcOrigins = {enabled: false, labels: new WeakMap<object, string>(), roots: new WeakMap<object, object>()};

/** Label a proposal with its root source. */
export function tagOrigin<T extends object>(control: T, source: string): T {
  if (arcOrigins.enabled) {arcOrigins.labels.set(control, source); arcOrigins.roots.set(control, {...control});}
  return control;
}

/** Label a proposal unless an earlier step already named its source more precisely. */
export function tagOriginIfNew<T extends object>(control: T, source: string): T {
  if (arcOrigins.enabled && !arcOrigins.labels.has(control)) tagOrigin(control, source);
  return control;
}

/** Label a control derived from `parent` by refinement `stage`. */
export function deriveOrigin<T extends object>(control: T, parent: object, stage: string): T {
  if (arcOrigins.enabled) {
    const from = arcOrigins.labels.get(parent) ?? 'untagged';
    arcOrigins.labels.set(control, from.endsWith('>' + stage) ? from : `${from}>${stage}`);
    arcOrigins.roots.set(control, arcOrigins.roots.get(parent) ?? {...parent});
  }
  return control;
}

/** Carry a label onto a copy of the same control (normalization, memo reuse). */
export function carryOrigin<T extends object>(copy: T, original: object): T {
  if (arcOrigins.enabled && copy !== original && !arcOrigins.labels.has(copy)) {
    arcOrigins.labels.set(copy, arcOrigins.labels.get(original) ?? 'untagged');
    const root = arcOrigins.roots.get(original);
    if (root) arcOrigins.roots.set(copy, root);
  }
  return copy;
}

export const originOf = (control: object | undefined) => control ? arcOrigins.labels.get(control) : undefined;
/** A copy of the proposal the control descends from, as first proposed. */
export const rootOf = (control: object | undefined) => control ? arcOrigins.roots.get(control) : undefined;
