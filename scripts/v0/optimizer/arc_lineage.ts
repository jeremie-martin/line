/** Physical prefix identity of search engines.
 * Every engine the compiler builds is linked to the geometry groups that
 * produced it. Searches with an identical physical prefix can then share
 * memoized evaluations and contact observers; nothing here simulates. */
import { createHash } from 'node:crypto';
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { TrackLine } from '../types.ts';
import { createArcEngine } from './arc_engine.ts';
import { contactObserver, extendContactObserver } from './contact_interval.ts';

export type Prefix = {parent?: Prefix; lines?: TrackLine[]; key?: string};
type StartState = {position: {x: number; y: number}; velocity: {x: number; y: number}};

const sectionOf = (line: TrackLine) => Math.floor((line.id - 1000) / 10000);

/** Lineage is recorded for every engine; contact observers are only kept
 * when the plan contains scattered fragment sections. */
export function createArcLineage(start: StartState, hasFragments: boolean) {
  const prefixes = new WeakMap<Engine, Prefix>();
  const rootPrefix: Prefix = {key: 'root'};
  const memoContexts = new Map<string, Map<string, any>>();

  const prefixKey = (node: Prefix): string => node.key ??= createHash('sha256')
    .update(prefixKey(node.parent!) + '\n' + JSON.stringify(node.lines, (_key, value) => Object.is(value, -0) ? '-0' : value))
    .digest('hex');

  const add = (parent: Engine, geometry: TrackLine[]) => {
    const child = parent.addLine(geometry), prefix = prefixes.get(parent);
    if (prefix) prefixes.set(child, {parent: prefix, lines: geometry});
    return child;
  };

  const detach = (source: Engine) => {
    const child = source.detach(), prefix = prefixes.get(source);
    if (prefix) prefixes.set(child, prefix);
    return child;
  };

  const rebuild = (geometry: TrackLine[]) => {
    const result = createArcEngine(start, geometry);
    let prefix = rootPrefix;
    const groups: TrackLine[][] = [];
    for (const line of geometry) {
      const last = groups.at(-1);
      if (!last || sectionOf(last[0]) !== sectionOf(line)) groups.push([line]);
      else last.push(line);
    }
    for (const lines of groups) prefix = {parent: prefix, lines};
    prefixes.set(result, prefix);
    return result;
  };

  // Share immutable observed prefixes across intervals and search branches.
  // No whole source ride or repeated suffix is needed to build scattered contacts.
  const observers = new WeakMap<Prefix, any>();
  if (hasFragments) observers.set(rootPrefix, contactObserver(start));
  const observerFor = (engine: Engine) => {
    const prefix = prefixes.get(engine);
    if (!prefix) throw new Error('contact construction requires physical prefix lineage');
    const missing: Prefix[] = [];
    let current = prefix;
    while (!observers.has(current)) {
      missing.push(current);
      if (!current.parent) throw new Error('missing contact observer root');
      current = current.parent;
    }
    let observer = observers.get(current);
    for (const p of missing.reverse()) {
      observer = extendContactObserver(observer, p.lines!);
      observers.set(p, observer);
    }
    return observer;
  };

  return {prefixes, memoContexts, prefixKey, add, detach, rebuild, observers, observerFor};
}

export type ArcLineage = ReturnType<typeof createArcLineage>;
