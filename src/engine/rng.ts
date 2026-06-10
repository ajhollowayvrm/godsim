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

/** Weighted pick: weights must be >= 0; returns index. Deterministic. */
export function weightedIndex(r: RNG, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return 0;
  let roll = r() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

export function weightedPick<T>(r: RNG, xs: readonly T[], weight: (x: T) => number): T {
  return xs[weightedIndex(r, xs.map(weight))];
}

/** Fisher–Yates on a copy. Deterministic given the stream position. */
export function shuffle<T>(r: RNG, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick n distinct elements (order deterministic). */
export function pickN<T>(r: RNG, xs: readonly T[], n: number): T[] {
  return shuffle(r, xs).slice(0, Math.min(n, xs.length));
}
