/**
 * Economy: regional output, house treasuries, and material shocks. Prosperity
 * and scarcity computed here drive ambition, migration, revolt and war aims in
 * the systems that follow. Wars cost, and are fought over something.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { System, World } from "../types";
import { cultureOf, ev, housesAlive, regionOf, regionsOf } from "../world";

export function foodProduction(w: World, r: { output: { food?: number }; prosperity: number; devastation: number; improvements: number; cultureKey: string; famine: boolean }): number {
  const tech = cultureOf(w, r.cultureKey).tech;
  return (r.output.food ?? 0)
    * (0.6 + r.prosperity * 0.8)
    * (1 - r.devastation * 0.7)
    * (1 + (tech.agriculture ? 0.35 : 0))
    * (1 + r.improvements * 0.1);
}

export const economy: System = {
  name: "economy",
  run(w, rng) {
    /* weather: a drought year strikes one quarter of the sky */
    const drought = chance(rng, 0.12) ? pick(rng, w.cultures).key : null;
    const bumper = !drought && chance(rng, 0.1) ? pick(rng, w.cultures).key : null;

    let famines = 0; const famineHouses = new Set<string>();
    for (const r of w.regions) {
      const weather = r.cultureKey === drought ? 0.5 : r.cultureKey === bumper ? 1.35 : 1;
      const food = foodProduction(w, r) * weather;
      const need = r.population / 10;
      const owner = w.houses.find((h) => h.id === r.ownerId);
      let starving = food < need * 0.7;
      if (starving && owner && owner.treasury.food >= 1) { owner.treasury.food -= 1; starving = false; }
      if (!starving && owner && food > need * 1.3) owner.treasury.food = clamp(owner.treasury.food + 0.5, 0, 8);
      const wasFamine = r.famine;
      r.famine = starving;
      if (starving) { famines++; if (owner) famineHouses.add(owner.id); }
      if (starving && !wasFamine && r.population >= 5) {
        ev(w, "famine", `Famine grips ${r.name}${owner ? ` and the granaries of House ${owner.name} run empty` : ""}.`,
          { importance: 2, regionId: r.id, houses: owner ? [owner.id] : [] });
      }

      /* prosperity drifts with material conditions */
      let d = 0.025;
      if (r.famine) d -= 0.11;
      if (r.plague > 0) d -= 0.12;
      if (food > need * 1.4) d += 0.03;
      if (r.cultureKey === bumper) d += 0.03;
      r.prosperity = clamp(r.prosperity + d + (rng() - 0.5) * 0.03, 0.05, 1);
      r.devastation = clamp(r.devastation - 0.06, 0, 1);
    }
    if (drought && famines >= 3)
      ev(w, "drought", `A rainless year scorches the ${drought} lands; the harvest fails across ${famines} regions.`, { importance: 2 });
    if (bumper)
      ev(w, "harvest", `The ${bumper} lands bring in a harvest out of song — barns full, tables heavy.`, { importance: 1 });

    /* plague: spread, burn down, or break out */
    const infected = w.regions.filter((r) => r.plague > 0);
    for (const r of infected) {
      for (const nid of r.neighbors) {
        const n = regionOf(w, nid)!;
        const physic = cultureOf(w, n.cultureKey).tech.physic ? 0.5 : 1;
        if (n.plague === 0 && chance(rng, 0.22 * physic)) n.plague = 2;
      }
      r.plague--;
    }
    const totalPop = w.regions.reduce((s, r) => s + r.population, 0);
    if (infected.length === 0 && chance(rng, 0.015 + (totalPop > 430 ? 0.045 : 0))) {
      const port = w.regions.filter((r) => r.terrain === "coast" || r.population > 12);
      const r0 = port.length ? pick(rng, port) : pick(rng, w.regions);
      r0.plague = 3;
      ev(w, "plague", `A grey sickness comes ashore at ${r0.name}. Doors are marked; the roads empty.`, { importance: 3, regionId: r0.id });
    } else if (infected.length >= 5 && chance(rng, 0.5)) {
      ev(w, "plague", `The grey sickness is everywhere now; bells toll from ${infected.length} regions.`, { importance: 3 });
    }

    /* house treasuries: income, upkeep, manpower regrowth */
    for (const h of housesAlive(w)) {
      let wealth = 0, lore = 0;
      for (const r of regionsOf(w, h.id)) {
        const tech = cultureOf(w, r.cultureKey).tech;
        let trade = 1;
        if (r.terrain === "coast" && tech.seafaring) trade += 0.6;
        if (r.neighbors.some((nid) => regionOf(w, nid)!.cultureKey !== r.cultureKey)) trade += 0.2; // cross-culture trade routes
        wealth += (r.output.wealth ?? 0) * (0.5 + r.prosperity) * trade * (1 - r.devastation * 0.5);
        lore += (r.output.lore ?? 0) * r.prosperity;
      }
      const atWar = w.wars.some((x) => !x.over && (x.attackerId === h.id || x.defenderId === h.id));
      h.treasury.wealth = clamp(h.treasury.wealth + wealth / 3 - 0.3 - (atWar ? 1.2 : 0), -4, 30);
      h.treasury.manpower = clamp(h.treasury.manpower + (atWar ? -0.5 : 0.6), 0, 8);
      if (h.treasury.wealth < -2 && atWar) h.warWeary = clamp(h.warWeary + 0.25, 0, 1);
      h.holdings = regionsOf(w, h.id).length;
    }
  },
};
