/** Physical prefix identity of search engines.
 * Every engine the compiler builds is linked to the geometry groups that
 * produced it. Searches with an identical physical prefix can then share
 * memoized evaluations; nothing here simulates. */
import { createHash } from 'node:crypto';
import type { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import type { TrackLine } from '../types.ts';
import { createArcEngine } from './arc_engine.ts';

export type Prefix = {parent?: Prefix; lines?: TrackLine[]; key?: string};
type StartState = {position: {x: number; y: number}; velocity: {x: number; y: number}};

const sectionOf = (line: TrackLine) => Math.floor((line.id - 1000) / 10000);

/** Lineage is recorded for every engine without duplicating its simulation. */
export function createArcLineage(start: StartState) {
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

  return {prefixes, memoContexts, prefixKey, add, detach, rebuild};
}

export type ArcLineage = ReturnType<typeof createArcLineage>;
