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

  it("replay preserves an authored incarnation backstory", () => {
    const g = boot(43) as ReturnType<typeof boot> & Record<string, CallableFunction>;
    g.advance();
    g.incarnate(undefined, "Veyron", "A stranger who remembers the world being made.");
    g.advance(); g.advance();
    const a = g.view() as unknown as { deity: { incarnation: { backstory: string } } };
    const replayed = rebuild(43, {}, (g as never as { journal: () => [] }).journal(), 3);
    const b = replayed.view() as unknown as typeof a;
    expect(b.deity.incarnation.backstory).toEqual("A stranger who remembers the world being made.");
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });

  it("divine inciteWar survives to the next era's war phase", () => {
    const g = boot(44) as ReturnType<typeof boot> & Record<string, CallableFunction>;
    g.advance(); g.advance();
    const v = g.view() as { houses: { id: string; living: number }[] };
    const alive = v.houses.filter((h) => h.living > 0);
    g.inciteWar(alive[0].id, alive[1].id);
    g.advance();
    const events = (g.view() as unknown as { events: { kind: string; houses?: string[] }[] }).events;
    const declared = events.some((e) => e.kind === "war" && e.houses?.includes(alive[0].id) && e.houses?.includes(alive[1].id));
    expect(declared).toBe(true);
  });

  it("negative and fractional seeds boot cleanly with adversaries", () => {
    for (const s of [-3, 2.5]) {
      const g = boot(s, { adversary: "rival-deity" });
      for (let i = 0; i < 6; i++) g.advance();
      const v = g.view() as unknown as { deity: { adversaryName: string | null }; log: string[] };
      expect(typeof v.deity.adversaryName).toBe("string");
      expect(v.log.some((l) => l.includes("undefined"))).toBe(false);
    }
  });
});
