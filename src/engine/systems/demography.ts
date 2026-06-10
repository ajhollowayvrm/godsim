/**
 * Demography: the masses grow, starve, sicken and move along the map; the
 * tracked cast is born and dies. Migration carries culture and faith.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { System, World } from "../types";
import {
  ageOf, cultureOf, ev, houseLiving, housesAlive, kill, livingPeople, newPerson,
  premierArtifact, regionOf, regionsOf,
} from "../world";
import { foodProduction } from "./economy";

const CAP_PER_HOUSE = 10;

export const demography: System = {
  name: "demography",
  run(w, rng) {
    /* the masses: growth, plague, famine, migration */
    for (const r of w.regions) {
      const tech = cultureOf(w, r.cultureKey).tech;
      const capacity = (r.output.food ?? 0.5) * 8 * (1 + (tech.agriculture ? 0.5 : 0)) + 4;
      const food = foodProduction(w, r);
      const need = r.population / 10;
      let growth = 0.07 * (food >= need ? 1 : 0.3) * (1 - r.population / Math.max(capacity, 1)) * (1 - r.devastation * 0.5);
      if (r.plague > 0) { r.population *= tech.physic ? 0.9 : 0.82; growth = 0; }
      if (r.famine) { r.population *= 0.94; growth = 0; }
      r.population = Math.max(1, Math.round(r.population * (1 + growth) * 10) / 10);
    }
    // migration: misery walks toward better land (fixed region order)
    for (const r of w.regions) {
      if (!(r.famine || r.plague > 0 || r.prosperity < 0.25)) continue;
      const options = r.neighbors
        .map((id) => regionOf(w, id)!)
        .filter((n) => n.plague === 0 && !n.famine && n.prosperity > r.prosperity + 0.15)
        .sort((a, b) => b.prosperity - a.prosperity || (a.id < b.id ? -1 : 1));
      if (!options.length) continue;
      const dest = options[0];
      const movers = Math.round(r.population * 0.08 * 10) / 10;
      if (movers < 0.3) continue;
      r.population -= movers; dest.population += movers;
      // people carry their gods and their tongues
      if (r.faithName && r.faithName !== dest.faithName) dest.devotion = clamp(dest.devotion - 0.08, 0, 1);
      if (r.cultureKey !== dest.cultureKey && chance(rng, 0.12)) dest.cultureKey = r.cultureKey;
      if (movers >= 2)
        ev(w, "migration", `Columns of the hungry leave ${r.name} for ${dest.name}.`, { importance: 1, regionId: r.id });
    }

    /* the tracked cast: births */
    const relic = premierArtifact(w);
    for (const h of housesAlive(w)) {
      const members = houseLiving(w, h.id);
      if (members.length >= CAP_PER_HOUSE) continue;
      const fertile = members.filter((p) => { const a = ageOf(p, w.era); return a >= 18 && a <= 50; });
      if (!fertile.length) continue;
      const seat = regionOf(w, h.seatRegionId);
      const hardTimes = seat ? (seat.famine || seat.plague > 0) : false;
      const nBirths = (chance(rng, hardTimes ? 0.65 : 0.9) ? 1 : 0) + (fertile.length >= 2 && chance(rng, hardTimes ? 0.3 : 0.55) ? 1 : 0);
      for (let b = 0; b < nBirths; b++) {
        const parent = pick(rng, fertile);
        const sigHair = chance(rng, 0.7) ? h.hair : pick(rng, pick(rng, w.cultures).hair);
        const ps = (parent.spouseId && w.people[parent.spouseId]?.alive) ? [parent.id, parent.spouseId] : [parent.id];
        const child = newPerson(w, rng, h.id, w.era, ps, sigHair);
        if (relic && child.hair === relic.attune && relic.state === "lost" && chance(rng, 0.35))
          ev(w, "omen", `A child of House ${h.name} is born ${relic.attune}-haired — the old folk whisper of ${relic.name}.`,
            { importance: 1, actors: [child.id], houses: [h.id] });
      }
    }

    /* deaths: age, plague, famine — tempered by grace */
    const mercy = clamp(w.grace, 0, 0.6);
    for (const p of livingPeople(w)) {
      if (p.avatar) continue;
      const a = ageOf(p, w.era);
      let base = a < 55 ? 0.04 : a < 75 ? 0.2 : a < 90 ? 0.55 : 0.95;
      const h = w.houses.find((x) => x.id === p.houseId);
      const lands = h ? regionsOf(w, h.id) : [];
      const tech = h ? cultureOf(w, h.culture).tech : {};
      if (lands.some((r) => r.plague > 0)) base += (tech as Record<string, number>).physic ? 0.08 : 0.16;
      if (lands.some((r) => r.famine)) base += 0.07;
      if (chance(rng, base * (1 - mercy) * (p.chosen ? 0.3 : 1))) {
        const cause = a >= 60 ? "old age" : lands.some((r) => r.plague > 0) && chance(rng, 0.6) ? "the grey sickness" : "a sudden fever";
        kill(w, p, cause);
        if (w.crown.holderId === p.id || (p.renownBase ?? 0) > 0.25)
          ev(w, "death", `${p.name} of House ${h?.name ?? "—"} dies of ${cause}.`, { importance: 2, actors: [p.id] });
      }
    }
    w.grace = clamp(w.grace * 0.6, 0, 1.5); // mercy fades unless renewed
  },
};
