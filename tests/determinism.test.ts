import { describe, it, expect } from "vitest";
import { boot, rebuild } from "../src/engine";

function run(seed: number, eras: number, options = {}) {
  const g = boot(seed, options);
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

  it("same seed with an adversary is also deterministic", () => {
    const a = run(777, 14, { adversary: "god-slayer" });
    const b = run(777, 14, { adversary: "god-slayer" });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("engine — divine journal replay (rewind)", () => {
  it("replaying the journal reproduces the run exactly", () => {
    const g = boot(42) as ReturnType<typeof boot> & Record<string, CallableFunction>;
    g.advance(); g.advance();
    const souls = g.listLiving();
    g.bless(souls[0].id);
    g.advance();
    g.nameChosen(g.listLiving()[3].id);
    g.advance(); g.advance();
    const a = g.view();

    const replayed = rebuild(42, {}, (g as never as { journal: () => [] }).journal(), 5);
    expect(JSON.stringify(replayed.view())).toEqual(JSON.stringify(a));
  });
});
