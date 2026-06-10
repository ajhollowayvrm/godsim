/**
 * Culture: values drift toward what has been working, borrow across borders,
 * and can diverge; innovations emerge where lore and prosperity pool, then
 * diffuse along trade and conquest — reshaping what is possible.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { Drive, System } from "../types";
import { ev, housesAlive, livingPeople, regionOf, regionsOf } from "../world";

export const TECHS: { key: string; name: string; line: string }[] = [
  { key: "agriculture", name: "the three-field art", line: "the fields yield half again; the granaries grow fat" },
  { key: "metallurgy", name: "true steel", line: "smiths fold iron into steel; old swords become heirlooms overnight" },
  { key: "writing", name: "letters", line: "what is written cannot be unsaid — law, doctrine and grudge alike now outlive their keepers" },
  { key: "masonry", name: "dressed-stone masonry", line: "walls rise that laugh at rams; sieges grow long and bitter" },
  { key: "seafaring", name: "deep-water sailing", line: "the coasts knit together with trade; far ports become near neighbors" },
  { key: "physic", name: "the physician's art", line: "the sick are bled less and saved more; the grey sickness loses some of its dominion" },
  { key: "astronomy", name: "star-reckoning", line: "the heavens are mapped and named; seers read fates in the turning wheel" },
];

const DRIFT_DRIVES: Drive[] = ["security", "status", "wealth", "faith", "love", "vengeance", "legacy", "knowledge", "freedom"];

/** "the Riverland folk" but "the Marshfolk" — never "folk folk" */
const folkOf = (key: string) => (key.toLowerCase().endsWith("folk") ? `the ${key}` : `the ${key} folk`);

export const culture: System = {
  name: "culture",
  run(w, rng) {
    /* values drift toward what is succeeding (fixed culture order) */
    for (const c of w.cultures) {
      const myRegions = w.regions.filter((r) => r.cultureKey === c.key);
      if (!myRegions.length) continue;
      const myHouses = housesAlive(w).filter((h) => h.culture === c.key);
      const atWar = myHouses.filter((h) => w.wars.some((x) => !x.over && (x.attackerId === h.id || x.defenderId === h.id))).length;
      const avgProsp = myRegions.reduce((s, r) => s + r.prosperity, 0) / myRegions.length;
      const pious = myRegions.filter((r) => r.faithName && r.devotion > 0.5).length / myRegions.length;
      const bump = (d: Drive, v: number) => { c.values[d] = clamp((c.values[d] ?? 0) + v, 0, 0.6); };
      if (atWar >= 2) { bump("vengeance", 0.02); bump("security", 0.015); bump("love", -0.01); }
      if (avgProsp > 0.6) { bump("wealth", 0.015); bump("knowledge", 0.015); bump("vengeance", -0.01); }
      if (avgProsp < 0.3) { bump("security", 0.02); }
      if (pious > 0.6) bump("faith", 0.02);
    }

    /* borrowing: neighbors trade ways as well as wares */
    for (const r of w.regions) {
      for (const nid of r.neighbors) {
        if (nid < r.id) continue; // each pair once
        const n = regionOf(w, nid)!;
        if (n.cultureKey === r.cultureKey) continue;
        const a = w.cultures.find((c) => c.key === r.cultureKey)!;
        const b = w.cultures.find((c) => c.key === n.cultureKey)!;
        for (const d of DRIFT_DRIVES) {
          const av = a.values[d] ?? 0, bv = b.values[d] ?? 0;
          a.values[d] = clamp(av + (bv - av) * 0.01, 0, 0.6);
          b.values[d] = clamp(bv + (av - bv) * 0.01, 0, 0.6);
        }
      }
    }

    /* innovation: lore and prosperity pool into discovery */
    for (const c of w.cultures) {
      const myRegions = w.regions.filter((r) => r.cultureKey === c.key);
      if (!myRegions.length) continue;
      const lore = myRegions.reduce((s, r) => s + (r.output.lore ?? 0) * r.prosperity, 0);
      const scholars = livingPeople(w).filter((p) => p.traits.includes("scholarly") &&
        housesAlive(w).some((h) => h.id === p.houseId && h.culture === c.key)).length;
      const unknown = TECHS.filter((t) => !c.tech[t.key]);
      if (!unknown.length) continue;
      const p = clamp(0.03 + lore * 0.025 + scholars * 0.02, 0, 0.28);
      if (chance(rng, p)) {
        const t = unknown[0]; // discoveries come in the order a people can reach them
        c.tech[t.key] = 1;
        const folk = folkOf(c.key);
        ev(w, "innovation", `${folk[0].toUpperCase() + folk.slice(1)} master ${t.name}: ${t.line}.`, { importance: 2, motive: "knowledge" });
      }
    }

    /* diffusion: knowledge leaks along borders and conquest */
    for (const r of w.regions) {
      const a = w.cultures.find((c) => c.key === r.cultureKey)!;
      for (const nid of r.neighbors) {
        const n = regionOf(w, nid)!;
        if (n.cultureKey === r.cultureKey) continue;
        const b = w.cultures.find((c) => c.key === n.cultureKey)!;
        for (const t of TECHS) {
          if (a.tech[t.key] && !b.tech[t.key] && chance(rng, 0.04)) {
            b.tech[t.key] = 1;
            ev(w, "innovation", `Knowledge of ${t.name} crosses the border into the ${b.key} lands by way of ${n.name}.`,
              { importance: 1, regionId: n.id, motive: "knowledge" });
          }
        }
      }
    }

    /* seafaring stitches distant coasts together (trade contact) */
    const sailors = w.cultures.filter((c) => c.tech.seafaring);
    if (sailors.length) {
      const coasts = w.regions.filter((r) => r.terrain === "coast");
      for (const r of coasts) {
        if (!sailors.some((c) => c.key === r.cultureKey)) continue;
        if (chance(rng, 0.1)) r.prosperity = clamp(r.prosperity + 0.03, 0, 1);
      }
    }

    /* divergence: a people split by war and distance becomes two peoples */
    if (w.cultures.length < 7 && chance(rng, 0.03)) {
      const c = pick(rng, w.cultures);
      const myRegions = w.regions.filter((r) => r.cultureKey === c.key);
      const myHouses = housesAlive(w).filter((h) => h.culture === c.key);
      const civilStrife = w.wars.some((x) => !x.over &&
        myHouses.some((h) => h.id === x.attackerId) && myHouses.some((h) => h.id === x.defenderId));
      if (myRegions.length >= 8 && civilStrife) {
        const half = myRegions.slice(Math.ceil(myRegions.length / 2));
        const variant = {
          ...c,
          key: "Old " + c.key,
          namePre: c.namePre.slice(), nameSuf: c.nameSuf.slice(), hair: c.hair.slice(),
          seatAdj: c.seatAdj.slice(), seatGeo: c.seatGeo.slice(), houseRoots: c.houseRoots.slice(),
          values: { ...c.values }, customs: [...c.customs, "the old ways kept against the new"],
          tech: { ...c.tech }, parentKey: c.key,
        };
        if (!w.cultures.some((x) => x.key === variant.key)) {
          w.cultures.push(variant);
          for (const r of half) r.cultureKey = variant.key;
          ev(w, "divergence", `Sundered by war and distance, half of ${folkOf(c.key)} turn inward and become ${folkOf(variant.key)} — one tongue, two peoples.`,
            { importance: 3, motive: "freedom" });
        }
      }
    }
  },
};
