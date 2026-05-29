import { hashParts } from "./deterministic_math.ts";

export type RandomPurpose =
  | "candidate"
  | "scheduler"
  | "polish"
  | "test";

export type CounterRngInput = {
  seed: number;
  purpose: RandomPurpose | string;
  prefixHash: string;
  gapIndex: number;
  ordinal: number;
  dimension: number;
};

export function randomFloat(input: CounterRngInput): number {
  const hash = hashParts(
    input.seed,
    input.purpose,
    input.prefixHash,
    input.gapIndex,
    input.ordinal,
    input.dimension,
  );
  const bits = Number.parseInt(hash.slice(0, 13), 16);
  return bits / 0x10000000000000;
}

export function randomRange(input: CounterRngInput, min: number, max: number): number {
  return min + (max - min) * randomFloat(input);
}

export function randomInt(input: CounterRngInput, minInclusive: number, maxInclusive: number): number {
  const lo = Math.ceil(minInclusive);
  const hi = Math.floor(maxInclusive);
  if (hi < lo) throw new Error(`randomInt invalid range ${minInclusive}..${maxInclusive}`);
  return lo + Math.floor(randomFloat(input) * (hi - lo + 1));
}
