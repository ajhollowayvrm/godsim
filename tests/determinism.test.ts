import { describe, it, expect } from "vitest";
import { boot } from "../src/engine";

function run(seed: number, eras: number) {
  const g = boot(seed);
  for (let i = 0; i < eras; i++) g.advance();
  return g.view();
}

describe("engine — the core invariant", () => {
  it("same seed produces an identical history", () => {
    const a = run(12345, 16);
    const b = run(12345, 16);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("different seeds produce different histories", () => {
    const a = run(1, 16);
    const b = run(2, 16);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe("engine — a run is alive and legible", () => {
  it("writes a non-empty chronicle and leaves survivors", () => {
    const v = run(25, 18);
    expect(v.log.length).toBeGreaterThan(20);
    const souls = v.houses.reduce((s, h) => s + (h.living || 0), 0);
    expect(souls).toBeGreaterThan(0);
  });

  it("generates a procedurally-named relic", () => {
    const v = run(25, 4);
    expect(v.sword?.name).toMatch(/of/);
  });
});
