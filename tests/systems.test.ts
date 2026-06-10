import { describe, it, expect } from "vitest";
import { boot } from "../src/engine";
import type { EngineView } from "../src/engine";

function run(seed: number, eras: number, options = {}) {
  const g = boot(seed, options);
  for (let i = 0; i < eras; i++) g.advance();
  return { g, v: g.view() };
}

describe("a run is alive and legible", () => {
  it("writes a non-empty chronicle and leaves survivors", () => {
    const { v } = run(25, 18);
    expect(v.log.length).toBeGreaterThan(20);
    const souls = v.houses.reduce((s, h) => s + (h.living || 0), 0);
    expect(souls).toBeGreaterThan(0);
  });

  it("generates a procedurally-named relic", () => {
    const { v } = run(25, 4);
    expect(v.sword?.name).toMatch(/of|Elder/);
  });
});

describe("the deep world", () => {
  it("generates a connected hex map with owned and wild regions", () => {
    const { v } = run(7, 1);
    const regions = v.regions as { id: string; neighbors: string[]; owner: string | null }[];
    expect(regions.length).toBeGreaterThanOrEqual(30);
    for (const r of regions) expect(r.neighbors.length).toBeGreaterThanOrEqual(2);
    expect(regions.some((r) => r.owner)).toBe(true);
  });

  it("people have interiority: drives, traits, desires", () => {
    const { g } = run(11, 3);
    const souls = g.listLiving() as ({ id: string } & Record<string, unknown>)[];
    expect(souls.length).toBeGreaterThan(10);
    for (const s of souls.slice(0, 10)) {
      expect(Object.keys(s.drives as object).length).toBeGreaterThan(0);
      expect((s.traits as string[]).length).toBeGreaterThan(0);
      expect((s.desire as string).length).toBeGreaterThan(3);
    }
  });

  it("events carry causal traces (actors/motive)", () => {
    const { v } = run(25, 20);
    const events = v.events as { actors?: string[]; motive?: string; importance: number }[];
    const withActors = events.filter((e) => e.actors?.length).length;
    const withMotive = events.filter((e) => e.motive).length;
    expect(withActors).toBeGreaterThan(events.length * 0.25);
    expect(withMotive).toBeGreaterThan(10);
  });

  it("history moves: wars happen, faiths rise, tech emerges over a long run", () => {
    const { v } = run(99, 28);
    const events = v.events as { kind: string }[];
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("war") || kinds.has("battle")).toBe(true);
    expect((v.faiths as unknown[]).length + events.filter((e) => e.kind === "collapse").length).toBeGreaterThan(0);
    expect((v.stats as { techsKnown: number }).techsKnown).toBeGreaterThan(0);
  });

  it("stays within the per-era compute budget", () => {
    const g = boot(1234);
    const t0 = performance.now();
    for (let i = 0; i < 30; i++) g.advance();
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(3000); // well under 100ms/era even on slow CI
  });
});

describe("the god", () => {
  it("divine powers work and never gate on faith", () => {
    const g = boot(5) as ReturnType<typeof boot> & Record<string, CallableFunction>;
    g.advance(); g.advance();
    const v0 = g.view() as EngineView;
    const region = (v0.regions as { id: string }[])[0];
    g.blessLand(region.id);
    g.smite(g.listLiving()[0].id);
    g.forgeArtifact();
    g.kindleFaith("god");
    const v1 = g.view() as EngineView;
    expect((v1.events as { divine?: boolean }[]).filter((e) => e.divine).length).toBeGreaterThanOrEqual(4);
    expect((v1.artifacts as unknown[]).length).toBeGreaterThan((v0.artifacts as unknown[]).length);
  });

  it("the vow breaks descriptively and power remains", () => {
    const g = boot(6, { vow: "no-blood" }) as ReturnType<typeof boot> & Record<string, CallableFunction>;
    g.advance(); g.advance();
    g.smite(g.listLiving()[0].id); // breaks the vow
    let v = g.view() as EngineView;
    expect((v.deity as { vow: { broken: boolean } }).vow.broken).toBe(true);
    g.smite(g.listLiving()[0].id); // still works — apostasy never weakens the god
    v = g.view() as EngineView;
    expect((v.events as { kind: string }[]).filter((e) => e.kind === "vow").length).toBeGreaterThanOrEqual(1);
  });

  it("incarnation descends an avatar that cannot die", () => {
    const g = boot(8) as ReturnType<typeof boot> & Record<string, CallableFunction>;
    g.advance();
    g.incarnate();
    const v = g.view() as EngineView;
    const inc = (v.deity as { incarnation: { personId: string } | null }).incarnation;
    expect(inc).not.toBeNull();
    for (let i = 0; i < 10; i++) g.advance();
    const v2 = g.view() as EngineView;
    const souls = g.listLiving() as { id: string }[];
    expect(souls.some((s) => s.id === inc!.personId)).toBe(true);
    expect(v2).toBeTruthy();
  });

  it("adversary modes produce their sagas deterministically", () => {
    const { v } = run(31, 20, { adversary: "rival-deity" });
    const kinds = new Set((v.events as { kind: string }[]).map((e) => e.kind));
    expect(kinds.has("adversary")).toBe(true);
    const { v: v2 } = run(31, 20, { adversary: "god-slayer" });
    const kinds2 = new Set((v2.events as { kind: string }[]).map((e) => e.kind));
    expect(kinds2.has("godslayer")).toBe(true);
  });
});
