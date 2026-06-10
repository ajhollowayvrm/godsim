/**
 * World construction helpers and shared queries. Every mutation here is pure
 * code on the World object; systems compose these. All iteration orders are
 * deterministic (insertion order / sorted by id).
 */
import type { RNG } from "./rng";
import { chance, clamp, jitter, pick, pickN } from "./rng";
import { givenName, roman } from "./names";
import type {
  ChronicleEvent, Culture, Drive, House, Person, Region, Relationship, Trait, World,
} from "./types";

export const ERA_YEARS = 25;
export const yearOf = (era: number) => 1000 + era * ERA_YEARS;
export const ageOf = (p: Person, era: number) => (era - p.bornEra) * ERA_YEARS;

/* ── chronicle ── */

export interface EvOpts {
  actors?: string[]; houses?: string[]; motive?: string; causedBy?: string[];
  importance?: 1 | 2 | 3; regionId?: string | null; divine?: boolean;
}
export function ev(w: World, kind: string, text: string, o: EvOpts = {}): string {
  const id = "e" + (w.seq.event = (w.seq.event || 0) + 1);
  const e: ChronicleEvent = {
    id, era: w.era, year: yearOf(w.era), kind, text,
    importance: o.importance ?? 2,
  };
  if (o.actors?.length) e.actors = o.actors;
  if (o.houses?.length) e.houses = o.houses;
  if (o.motive) e.motive = o.motive;
  if (o.causedBy?.length) e.causedBy = o.causedBy;
  if (o.regionId) e.regionId = o.regionId;
  if (o.divine) e.divine = true;
  w.chronicle.push(e);
  return id;
}

/* ── caches (pure derivations of world state; deterministic) ── */

const livingCache = new WeakMap<World, Person[]>();
const regionMapCache = new WeakMap<World, Map<string, import("./types").Region>>();
const mightCache = new WeakMap<World, { stamp: number; m: Record<string, number> }>();
const stamps = new WeakMap<World, number>();

/** invalidate per-phase caches; called by the pipeline between systems */
export function bumpPhase(w: World) {
  stamps.set(w, (stamps.get(w) ?? 0) + 1);
}

function livingList(w: World): Person[] {
  let list = livingCache.get(w);
  if (!list) {
    list = Object.values(w.people).filter((p) => p.alive);
    livingCache.set(w, list);
  }
  return list;
}
function noteBirth(w: World, p: Person) { livingCache.get(w)?.push(p); }
function noteDeath(w: World, p: Person) {
  const list = livingCache.get(w);
  if (list) { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); }
}

/* ── queries ── */

export const houseOf = (w: World, id: string | null) => w.houses.find((h) => h.id === id) ?? null;
export function regionOf(w: World, id: string | null) {
  if (!id) return null;
  let m = regionMapCache.get(w);
  if (!m || m.size !== w.regions.length) {
    m = new Map(w.regions.map((r) => [r.id, r]));
    regionMapCache.set(w, m);
  }
  return m.get(id) ?? null;
}
export const cultureOf = (w: World, key: string): Culture => w.cultures.find((c) => c.key === key) ?? w.cultures[0];
export const houseCulture = (w: World, h: House): Culture => cultureOf(w, h.culture);
export const livingPeople = (w: World) => livingList(w).slice();
export const houseLiving = (w: World, hid: string) => livingList(w).filter((p) => p.houseId === hid);
export const adultsOf = (w: World, hid: string) => houseLiving(w, hid).filter((p) => ageOf(p, w.era) >= 18);
export const livingNow = (w: World) => livingList(w); // read-only view: do NOT mutate or kill while iterating
export const regionsOf = (w: World, hid: string) => w.regions.filter((r) => r.ownerId === hid);
export const livingFaiths = (w: World) => w.faiths.filter((f) => !f.dissolvedEra);
export const faithById = (w: World, id: string | null) => w.faiths.find((f) => f.id === id) ?? null;
export const houseAlive = (w: World, hid: string) => !!houseOf(w, hid) && houseLiving(w, hid).length > 0;
export const houseLord = (w: World, hid: string) => w.people[w.offices["lord_" + hid]?.holderId ?? ""] ?? null;
export const isLord = (w: World, p: Person) => w.offices["lord_" + p.houseId]?.holderId === p.id;
export const monarch = (w: World) => (w.crown.holderId ? w.people[w.crown.holderId] ?? null : null);
export const pName = (w: World, p: Person) => `${p.name} of House ${houseOf(w, p.houseId)?.name ?? "no house"}`;
export const vassalsOf = (w: World, hid: string) => w.houses.filter((h) => h.overlordId === hid && houseAlive(w, h.id));
export const housesAlive = (w: World) => w.houses.filter((h) => houseAlive(w, h.id));

export function premierArtifact(w: World) {
  const order = w.artifacts.filter((a) => a.state !== "destroyed");
  return order.sort((a, b) => b.legend - a.legend || (a.id < b.id ? -1 : 1))[0] ?? w.artifacts[0] ?? null;
}
export const holdsAnyArtifact = (w: World, pid: string) => w.artifacts.some((a) => a.holderId === pid && a.state === "held");
export const artifactsHeldBy = (w: World, pid: string) => w.artifacts.filter((a) => a.holderId === pid && a.state === "held");

export function renown(w: World, p: Person): number {
  let r = p.prowess * 0.4 + p.guile * 0.15 + p.acumen * 0.15
    + Math.min(ageOf(p, w.era) / 80, 1) * 0.1 + (p.renownBase || 0);
  for (const a of artifactsHeldBy(w, p.id)) r += 0.35 + a.legend * 0.01;
  if (p.chosen) r += 0.6;
  if (p.avatar) r += 0.8;
  if (isLord(w, p)) r += 0.1;
  if (w.crown.holderId === p.id) r += 0.25;
  return r;
}

/* ── house standing (diplomatic) & grudges (memory) ── */

const skey = (a: string, b: string) => (a < b ? a + "|" + b : b + "|" + a);
export const standing = (w: World, a: string, b: string) => w.standing[skey(a, b)] ?? 0;
export const setStanding = (w: World, a: string, b: string, v: number) => { w.standing[skey(a, b)] = clamp(v, -1, 1); };
export const adjStanding = (w: World, a: string, b: string, d: number) => setStanding(w, a, b, standing(w, a, b) + d);
export const alliesOf = (w: World, hid: string) =>
  housesAlive(w).filter((h) => h.id !== hid && standing(w, h.id, hid) > 0.35).map((h) => h.id);
export const setTruce = (w: World, a: string, b: string, untilEra: number) => { w.truces[skey(a, b)] = untilEra; };
export const inTruce = (w: World, a: string, b: string) => (w.truces[skey(a, b)] ?? -1) >= w.era;

export function addGrudge(w: World, hid: string, vs: string, weight: number, reason: string) {
  const h = houseOf(w, hid); if (!h) return;
  const g = h.grudges.find((x) => x.vs === vs && x.reason === reason);
  if (g) g.weight = clamp(g.weight + weight, 0, 2);
  else {
    h.grudges.push({ vs, weight: clamp(weight, 0, 2), reason, era: w.era });
    if (h.grudges.length > 6) h.grudges.sort((a, b) => b.weight - a.weight).splice(6);
  }
}
export const grudgeAgainst = (w: World, hid: string, vs: string) =>
  (houseOf(w, hid)?.grudges ?? []).filter((g) => g.vs === vs).reduce((s, g) => s + g.weight, 0);

/* ── relationships (person ↔ person) ── */

export function relOf(w: World, a: string, b: string): Relationship | null {
  return w.rels.find((r) => r.from === a && r.to === b) ?? null;
}
export function bumpRel(w: World, a: string, b: string, d: Partial<Pick<Relationship, "affection" | "trust" | "rivalry" | "debt">>, why?: string) {
  if (a === b || !w.people[a] || !w.people[b]) return;
  let r = relOf(w, a, b);
  if (!r) {
    r = { from: a, to: b, affection: 0, trust: 0, rivalry: 0, debt: 0 };
    w.rels.push(r);
  }
  if (d.affection) r.affection = clamp(r.affection + d.affection, -1, 1);
  if (d.trust) r.trust = clamp(r.trust + d.trust, -1, 1);
  if (d.rivalry) r.rivalry = clamp(r.rivalry + d.rivalry, 0, 1);
  if (d.debt) r.debt = clamp(r.debt + d.debt, -1, 1);
  if (why) r.why = why;
}
export const relsFor = (w: World, pid: string) =>
  w.rels.filter((r) => (r.from === pid || r.to === pid) && w.people[r.from]?.alive && w.people[r.to]?.alive);

/** keep the graph bounded: drop dead-edge and feeble edges periodically */
export function pruneRels(w: World) {
  w.rels = w.rels.filter((r) =>
    w.people[r.from]?.alive && w.people[r.to]?.alive &&
    (Math.abs(r.affection) + Math.abs(r.trust) + r.rivalry + Math.abs(r.debt)) > 0.15);
  if (w.rels.length > 900) {
    w.rels.sort((a, b) =>
      (Math.abs(b.affection) + Math.abs(b.trust) + b.rivalry) - (Math.abs(a.affection) + Math.abs(a.trust) + a.rivalry));
    w.rels.length = 900;
  }
}

/* ── people: creation, interiority, LOD ── */

const TRAITS: Trait[] = ["ambitious", "content", "cruel", "just", "pious", "skeptic", "cautious", "bold", "greedy", "generous", "vengeful", "forgiving", "scholarly", "brutish", "charming", "paranoid"];
const OPPOSED: [Trait, Trait][] = [["ambitious", "content"], ["cruel", "just"], ["pious", "skeptic"], ["cautious", "bold"], ["greedy", "generous"], ["vengeful", "forgiving"], ["scholarly", "brutish"], ["charming", "paranoid"]];
const DRIVES: Drive[] = ["security", "status", "wealth", "faith", "love", "vengeance", "legacy", "knowledge", "freedom"];

function rollTraits(rng: RNG, parents: Person[]): Trait[] {
  const out: Trait[] = [];
  for (const par of parents) for (const t of par.traits) if (chance(rng, 0.25) && !out.includes(t)) out.push(t);
  while (out.length < 2) { const t = pick(rng, TRAITS); if (!out.includes(t)) out.push(t); }
  // resolve contradictions deterministically: keep the first of an opposed pair
  for (const [a, b] of OPPOSED) if (out.includes(a) && out.includes(b)) out.splice(out.indexOf(b), 1);
  return out.slice(0, 3);
}

function rollDrives(rng: RNG, culture: Culture, parents: Person[], traits: Trait[]): Partial<Record<Drive, number>> {
  const w: Partial<Record<Drive, number>> = {};
  const add = (d: Drive, v: number) => { w[d] = (w[d] ?? 0) + v; };
  for (const d of DRIVES) add(d, (culture.values[d] ?? 0) * 0.5 + rng() * 0.4);
  for (const par of parents) for (const d of DRIVES) add(d, (par.drives[d] ?? 0) * 0.25);
  if (traits.includes("ambitious")) add("status", 0.5);
  if (traits.includes("greedy")) add("wealth", 0.5);
  if (traits.includes("pious")) add("faith", 0.5);
  if (traits.includes("vengeful")) add("vengeance", 0.35);
  if (traits.includes("scholarly")) add("knowledge", 0.5);
  if (traits.includes("cautious")) add("security", 0.35);
  if (traits.includes("charming")) add("love", 0.3);
  if (traits.includes("content")) add("security", 0.3);
  // keep the 3 strongest, normalized
  const top = DRIVES.map((d) => [d, w[d] ?? 0] as const).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const sum = top.reduce((s, [, v]) => s + v, 0) || 1;
  const out: Partial<Record<Drive, number>> = {};
  for (const [d, v] of top) out[d] = +(v / sum).toFixed(3);
  return out;
}

export function topDrive(p: Person): Drive {
  let best: Drive = "status", bv = -1;
  for (const [d, v] of Object.entries(p.drives)) if ((v ?? 0) > bv) { bv = v ?? 0; best = d as Drive; }
  return best;
}

export function deriveDesire(w: World, p: Person): string {
  const h = houseOf(w, p.houseId);
  switch (topDrive(p)) {
    case "security": return `to keep House ${h?.name ?? "—"} safe from its enemies`;
    case "status": return p.claims.length > 1 ? "to press the claims of the blood" : "to sit a higher seat than birth allowed";
    case "wealth": return `to fill the vaults of ${h?.seat ?? "the hall"}`;
    case "faith": return p.faithName ? `to exalt ${p.faithName}` : "to hear the voice behind the sky";
    case "love": return "to wed for love, not for alliance";
    case "vengeance": return p.wound ? `to repay ${houseOf(w, p.woundVs ?? "")?.name ? "House " + houseOf(w, p.woundVs ?? "")!.name : "the guilty"} for ${p.wound}` : "to repay every slight in kind";
    case "legacy": return "to leave a name that outlives the stone";
    case "knowledge": return "to read the world's hidden workings";
    case "freedom": return "to kneel to no overlord";
  }
}

export function newPerson(
  w: World, rng: RNG, houseId: string, bornEra: number,
  parents: string[] = [], inheritHair: string | null = null,
): Person {
  const id = "p" + (w.seq.person = (w.seq.person || 0) + 1);
  const house = houseOf(w, houseId)!;
  const culture = houseCulture(w, house);
  const parentPeople = parents.map((pid) => w.people[pid]).filter(Boolean);

  // a child often honors a departed forebear of the house — recorded as a namesake
  let baseName: string, namedAfter: string | null = null;
  const ancestors = parents.length
    ? Object.values(w.people).filter((p) => p.houseId === houseId && !p.alive && (p.renownBase ?? 0) > 0.05)
    : [];
  if (ancestors.length && chance(rng, 0.4)) {
    const hon = pick(rng, ancestors); baseName = hon.baseName || hon.name; namedAfter = hon.id;
  } else baseName = givenName(rng, culture);
  const ord = Object.values(w.people).filter((p) => p.houseId === houseId && (p.baseName || p.name) === baseName).length + 1;

  const avg = (k: "prowess" | "guile" | "acumen" | "zeal", def: number) =>
    parentPeople.length ? parentPeople.reduce((s, p) => s + p[k], 0) / parentPeople.length : def;
  const traits = rollTraits(rng, parentPeople);
  const p: Person = {
    id, baseName, namedAfter, name: baseName + (ord > 1 ? " " + roman(ord) : ""),
    houseId, bornEra, diedEra: null, alive: true, parents,
    spouseId: null, claims: [houseId],
    hair: inheritHair ?? house.hair,
    prowess: clamp(avg("prowess", 0.5) + jitter(rng, 0.2), 0.05, 1),
    guile: clamp(avg("guile", 0.5) + jitter(rng, 0.2), 0.05, 1),
    acumen: clamp(avg("acumen", 0.5) + jitter(rng, 0.2), 0.05, 1),
    zeal: clamp(avg("zeal", 0.4) + jitter(rng, 0.25), 0, 1),
    drives: {}, wound: null, woundVs: null, desire: "", traits,
    faithName: parentPeople[0]?.faithName ?? null,
    renownBase: 0, deeds: [], lod: "tracked",
  };
  p.drives = rollDrives(rng, culture, parentPeople, traits);
  p.desire = deriveDesire(w, p);
  for (const par of parentPeople) for (const c of par.claims) if (!p.claims.includes(c)) p.claims.push(c);
  w.people[id] = p;
  noteBirth(w, p);
  // kinship edges
  for (const par of parentPeople) {
    bumpRel(w, par.id, p.id, { affection: 0.5, trust: 0.4 }, "kin");
    bumpRel(w, p.id, par.id, { affection: 0.5, trust: 0.4 }, "kin");
  }
  return p;
}

/** Promote a person from the unnamed masses into the tracked cast. */
export function promoteCommoner(w: World, rng: RNG, houseId: string, age: number): Person {
  const bornEra = Math.max(0, w.era - Math.max(1, Math.round(age / ERA_YEARS)));
  const p = newPerson(w, rng, houseId, bornEra);
  p.lod = "tracked";
  return p;
}

export function wound(w: World, p: Person, text: string, vsHouse: string | null) {
  if (p.wound) return; // the first wound is the formative one
  p.wound = text; p.woundVs = vsHouse;
  p.drives.vengeance = clamp((p.drives.vengeance ?? 0) + 0.35, 0, 1);
  p.desire = deriveDesire(w, p);
}

export function kill(w: World, p: Person, cause: string) {
  if (!p.alive) return;
  if (p.avatar) {
    // the god incarnate cannot die — only be humbled
    w.deity.humbled = true;
    p.prowess = clamp(p.prowess - 0.15, 0.3, 1);
    p.renownBase = clamp((p.renownBase ?? 0) - 0.1, 0, 1.2);
    ev(w, "divine", `${p.name} takes what should be a death-blow (${cause}) and stands back up. The witnesses do not cheer; they back away. The god walks on, humbled but unkillable.`,
      { importance: 3, actors: [p.id], divine: true });
    return;
  }
  p.alive = false; p.diedEra = w.era; p.deathCause = cause;
  noteDeath(w, p);
  if ((renown(w, p) ?? 0) > 0.9) {
    const h = houseOf(w, p.houseId);
    if (h) h.prestige = clamp(h.prestige + 0.08, 0, 2);
  }
  // children of the slain carry the wound
  if (/slain|murder|executed|battle|crusade|poison/.test(cause)) {
    for (const c of livingPeople(w)) {
      if (c.parents.includes(p.id) && ageOf(c, w.era) < 30) {
        const vs = cause.match(/by (h\d+)/)?.[1] ?? null;
        wound(w, c, `the death of ${p.name} (${cause.replace(/ by h\d+/, "")})`, vs);
      }
    }
  }
}

/** leave the mortal world by a path that is not death (ascension) */
export function departWorld(w: World, p: Person, cause: string) {
  if (!p.alive) return;
  p.alive = false; p.diedEra = w.era; p.deathCause = cause;
  noteDeath(w, p);
}

export function deed(w: World, p: Person, text: string, fame = 0.05) {
  p.deeds.push(`E${w.era}: ${text}`);
  if (p.deeds.length > 8) p.deeds.shift();
  p.renownBase = clamp((p.renownBase ?? 0) + fame, 0, 1.2);
}

/* ── might ── */

export function houseLevy(w: World, hid: string): number {
  const h = houseOf(w, hid); if (!h || !houseAlive(w, hid)) return 0;
  let m = 0;
  for (const r of regionsOf(w, hid))
    m += (r.output.manpower ?? 1) * (0.5 + r.prosperity) * (1 - r.devastation * 0.7) * (r.population / 10);
  for (const p of adultsOf(w, hid)) m += p.prowess * 0.4;
  const cult = houseCulture(w, h);
  if (cult.tech.metallurgy) m *= 1.2;
  if (cult.tech.masonry) m *= 1.05;
  if (w.artifacts.some((a) => a.state === "held" && a.power === "war" && w.people[a.holderId ?? ""]?.houseId === hid)) m *= 1.25;
  m += Math.min(h.treasury.manpower, 4) * 0.5;
  return m;
}

export function realmMight(w: World, hid: string): number {
  const stamp = stamps.get(w) ?? 0;
  let c = mightCache.get(w);
  if (!c || c.stamp !== stamp) { c = { stamp, m: {} }; mightCache.set(w, c); }
  if (c.m[hid] !== undefined) return c.m[hid];
  const v = houseLevy(w, hid)
    + alliesOf(w, hid).reduce((s, a) => s + houseLevy(w, a) * 0.45, 0)
    + vassalsOf(w, hid).reduce((s, v2) => s + houseLevy(w, v2.id) * 0.5, 0);
  c.m[hid] = v;
  return v;
}

/* ── misc ── */

export function strongestHouses(w: World): House[] {
  return housesAlive(w).slice().sort((a, b) => realmMight(w, b.id) - realmMight(w, a.id) || (a.id < b.id ? -1 : 1));
}

export function regionCultureSpread(w: World, rng: RNG, from: Region, to: Region, strength: number) {
  if (from.cultureKey !== to.cultureKey && chance(rng, strength)) to.cultureKey = from.cultureKey;
}

export function clearIntents(w: World) {
  w.intents = { wars: [], proposals: [], quests: [], conversions: [], prophets: [], builds: [], endowments: [] };
}

export function pickHeirs(w: World, hid: string): Person[] {
  return houseLiving(w, hid).slice().sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1));
}
