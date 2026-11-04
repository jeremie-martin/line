/** Committed rides plus deterministic physical edge cases. No compiler runs or
 * production audio are needed to check the physics kernel. */
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {makeRng} from '../../scripts/lib/rng.ts';

type Point = {x: number; y: number};
type Line = {id: number; type: number; x1: number; y1: number; x2: number; y2: number;
  flipped?: boolean; leftExtended?: boolean; rightExtended?: boolean; extended?: number};
export type PhysicsTrack = {startPosition: Point; riders: {startVelocity: Point}[]; duration: number; lines: Line[]};
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

export function savedEngineTracks() {
  const directory = new URL('./tracks/', import.meta.url);
  return readdirSync(directory).filter(name => name.endsWith('.json.gz')).sort().map(name => {
    const bytes = gunzipSync(readFileSync(new URL(name, directory)));
    return {name, inputSha256: sha256(bytes), track: JSON.parse(bytes.toString()) as PhysicsTrack};
  });
}

export function engineCorpus() {
  const cases = savedEngineTracks();
  for (let seed = 1; seed <= 32; seed++) {
    const rng = makeRng(seed), pick = (n: number) => Math.floor(rng() * n);
    const direction = seed % 2 ? 1 : -1, origin = seed % 4 * 14 - 28;
    const lines: Line[] = [{id: 1, type: seed % 3, x1: origin - direction * 80, y1: 10,
      x2: origin + direction * 300, y2: 10, leftExtended: true, rightExtended: true}];
    for (let i = 0; i < 24; i++) {
      const x = origin + pick(15) * 14 - 98, y = pick(100) - 30;
      lines.push({id: i + 2, type: pick(3), x1: x, y1: y,
        x2: x + (i % 7 === 0 ? 0 : direction * (1 + pick(80))), y2: y + (i % 7 === 0 ? 0 : pick(40) - 20),
        flipped: !!pick(2), leftExtended: !!pick(2), rightExtended: !!pick(2)});
    }
    const track: PhysicsTrack = {startPosition: {x: origin, y: -15}, riders: [{startVelocity: {x: direction * (seed % 9), y: seed % 3 - 1}}],
      duration: 240, lines};
    cases.push({name: `stress-${seed}`, inputSha256: sha256(JSON.stringify(track)), track});
  }
  return cases;
}
