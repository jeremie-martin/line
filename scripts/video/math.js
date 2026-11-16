// The two small functions every part of the renderer shares.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** 0 to 1 with a smooth start and end, for x from 0 to 1 (held outside). */
export const smoothstep = x => {x = clamp(x, 0, 1); return x * x * (3 - 2 * x);};
