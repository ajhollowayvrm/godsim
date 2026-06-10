/**
 * Deterministic PRNG. THE core invariant: identical seed -> identical history.
 * Never use Math.random() or Date in the engine — only this stream.
 */
export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed | 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chance = (r: RNG, p: number) => r() < p;
export const pick = <T,>(r: RNG, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const rangeInt = (r: RNG, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
export const jitter = (r: RNG, mag = 0.1) => (r() * 2 - 1) * mag;
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
