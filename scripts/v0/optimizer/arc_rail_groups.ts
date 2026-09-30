import type {TrackLine} from '../types.ts';

/** Emitter contract: one main chain and at most one opposing guide per support.
 * Shared with gallery inspection; fragments and contoured experiments do not use it. */
export function arcRailGroups(lines:TrackLine[]):Map<number,TrackLine[][]> {
  const groups = new Map<number, TrackLine[][]>();
  for (const line of lines) {
    if (line.type !== 0) throw new Error('guidance reduction requires normal lines');
    const id = Math.floor((line.id - 1000) / 10000), chains = groups.get(id) ?? [[]];
    const previous = chains.at(-1)!.at(-1);
    if (previous && (previous.x2 !== line.x1 || previous.y2 !== line.y1)) chains.push([]);
    chains.at(-1)!.push(line); groups.set(id, chains);
  }
  for(const chains of groups.values())if(chains.length>2)throw new Error('guidance must contain at most two connected curves');
  return groups;
}

