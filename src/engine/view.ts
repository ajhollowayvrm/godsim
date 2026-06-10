/**
 * World -> EngineView. Pure derivation; everything serializable; the legacy
 * fields keep their exact shape and the deep model is exposed alongside them.
 */
import type { EngineView, PersonView, World } from "./types";
import {
  ageOf, artifactsHeldBy, faithById, houseLiving, houseOf, livingPeople,
  premierArtifact, regionsOf, relsFor, renown, vassalsOf,
} from "./world";

export function buildView(w: World): EngineView {
  const m = w.people[w.crown.holderId ?? ""];
  const sf = faithById(w, w.crown.stateFaithId);
  const relic = premierArtifact(w);
  const relicBearer = relic?.holderId ? w.people[relic.holderId] : null;
  const chosenP = w.chosen ? w.people[w.chosen.personId] : null;

  const log = w.chronicle.map((e) => `Era ${e.era} (${e.year} AE) — ${e.text}`);

  return {
    era: w.era, year: 1000 + w.era * 25,
    log,
    houses: w.houses.map((h) => ({
      id: h.id, name: h.name, seat: h.seat, culture: h.culture,
      living: houseLiving(w, h.id).length,
      lord: w.people[w.offices["lord_" + h.id]?.holderId ?? ""]?.name ?? null,
      holdings: regionsOf(w, h.id).length,
      overlord: h.overlordId ? houseOf(w, h.overlordId)?.name ?? null : null,
      // deep extensions
      color: h.color, prestige: +h.prestige.toFixed(2), loyalty: +h.loyalty.toFixed(2),
      wealth: +h.treasury.wealth.toFixed(1), food: +h.treasury.food.toFixed(1),
      grudges: h.grudges.map((g) => ({ vs: houseOf(w, g.vs)?.name ?? g.vs, vsId: g.vs, weight: +g.weight.toFixed(2), reason: g.reason })),
      fallen: h.fallenEra !== null, hair: h.hair, seatRegionId: h.seatRegionId,
      warWeary: +h.warWeary.toFixed(2),
    })),
    faiths: w.faiths.filter((f) => !f.dissolvedEra).map((f) => ({
      name: f.name, focus: f.focus, posture: f.posture,
      vitality: +f.vitality.toFixed(3), mem: +f.memoryOfGod.toFixed(3),
      // deep extensions
      id: f.id, zeal: +f.zeal.toFixed(2), doctrines: f.doctrines.slice(), creed: f.creed,
      patron: f.patronHouseId ? houseOf(w, f.patronHouseId)?.name ?? null : null,
      sacred: f.sacredRegionIds.map((rid) => w.regions.find((r) => r.id === rid)?.name ?? rid),
      founder: f.founderId ? w.people[f.founderId]?.name ?? null : null,
      parent: f.parentId ? w.faiths.find((x) => x.id === f.parentId)?.name ?? null : null,
      regions: w.regions.filter((r) => r.faithName === f.name).length,
    })),
    crown: w.crown.houseId ? {
      house: houseOf(w, w.crown.houseId)?.name ?? "—",
      monarch: m?.name ?? null,
      legitimacy: +w.crown.legitimacy.toFixed(3),
      stateFaith: sf?.name ?? null,
      monarchId: m?.id ?? null, houseId: w.crown.houseId, since: w.crown.since,
    } : null,
    sword: relic ? {
      name: relic.name,
      holder: relicBearer ? `${relicBearer.name} of House ${houseOf(w, relicBearer.houseId)?.name ?? "—"}` : null,
      state: relic.state, legend: Math.round(relic.legend), attune: relic.attune,
    } : null,
    empire: w.empireHouseId ? houseOf(w, w.empireHouseId)?.name ?? null : null,
    chosen: w.chosen ? {
      name: chosenP?.name, house: chosenP ? houseOf(w, chosenP.houseId)?.name : undefined,
      alive: chosenP?.alive ?? false, outcome: w.chosen.outcome ?? undefined,
      personId: w.chosen.personId,
    } : null,
    grace: +w.grace.toFixed(3),

    /* ───────────── the deep world, exposed ───────────── */
    mood: w.mood.label,
    regions: w.regions.map((r) => ({
      id: r.id, name: r.name, terrain: r.terrain, col: r.col, row: r.row,
      neighbors: r.neighbors.slice(),
      owner: r.ownerId, ownerName: r.ownerId ? houseOf(w, r.ownerId)?.name ?? null : null,
      ownerColor: r.ownerId ? houseOf(w, r.ownerId)?.color ?? null : null,
      population: +r.population.toFixed(1), prosperity: +r.prosperity.toFixed(3),
      devastation: +r.devastation.toFixed(2), culture: r.cultureKey,
      faith: r.faithName, devotion: +r.devotion.toFixed(2), sacredTo: r.sacredTo,
      plague: r.plague, famine: r.famine, improvements: r.improvements,
      atWar: w.wars.some((x) => !x.over && (x.aim.regionId === r.id
        || (r.ownerId && (x.attackerId === r.ownerId || x.defenderId === r.ownerId)))),
    })),
    artifacts: w.artifacts.map((a) => ({
      id: a.id, name: a.name, kind: a.kind, state: a.state,
      holder: a.holderId ? w.people[a.holderId]?.name ?? null : null,
      holderId: a.holderId,
      holderHouse: a.holderId ? houseOf(w, w.people[a.holderId]?.houseId ?? "")?.name ?? null : null,
      legend: +a.legend.toFixed(1), will: +a.will.toFixed(2), wants: a.wants,
      attune: a.attune, power: a.power,
      lostIn: a.lostInRegionId ? w.regions.find((r) => r.id === a.lostInRegionId)?.name ?? null : null,
      custody: a.custody.slice(-6).map((c) => ({ holder: w.people[c.holderId]?.name ?? c.holderId, era: c.era, how: c.how })),
    })),
    wars: w.wars.filter((x) => !x.over).map((x) => ({
      id: x.id,
      attacker: houseOf(w, x.attackerId)?.name ?? x.attackerId, attackerId: x.attackerId,
      defender: houseOf(w, x.defenderId)?.name ?? x.defenderId, defenderId: x.defenderId,
      aim: x.aim.label, kind: x.aim.kind, since: x.startEra, score: x.score,
    })),
    prophecies: w.prophecies.slice(-8).map((p) => ({
      text: p.text, origin: p.origin, status: p.status, era: p.utteredEra,
      subject: p.subjectId ? w.people[p.subjectId]?.name ?? null : null,
    })),
    cultures: w.cultures.map((c) => ({
      key: c.key,
      values: Object.fromEntries(Object.entries(c.values).map(([k, v]) => [k, +(v ?? 0).toFixed(2)])),
      customs: c.customs.slice(), tech: Object.keys(c.tech).filter((k) => c.tech[k]),
      succession: c.succession,
      regions: w.regions.filter((r) => r.cultureKey === c.key).length,
    })),
    deity: {
      vow: w.deity.vow ? { kind: w.deity.vow.kind, text: w.deity.vow.text, broken: w.deity.vow.broken, brokenEra: w.deity.vow.brokenEra } : null,
      incarnation: w.deity.incarnationId && w.people[w.deity.incarnationId]?.alive ? {
        personId: w.deity.incarnationId,
        name: w.people[w.deity.incarnationId].name,
        house: houseOf(w, w.people[w.deity.incarnationId].houseId)?.name ?? null,
        backstory: w.deity.incarnationBackstory ?? null,
        humbled: !!w.deity.humbled,
      } : null,
      adversary: w.adversary.kind,
      adversaryName: w.adversary.kind !== "none" ? w.adversary.name : null,
      adversaryDefeated: w.adversary.defeated,
      adversaryPower: w.adversary.power,
      adversaryChampion: w.adversary.championId ? w.people[w.adversary.championId]?.name ?? null : null,
      acts: w.deity.marks.length,
    },
    events: w.chronicle.map((e) => ({
      id: e.id, era: e.era, year: e.year, kind: e.kind, text: e.text,
      actors: e.actors, houses: e.houses, motive: e.motive, causedBy: e.causedBy,
      importance: e.importance, regionId: e.regionId, divine: e.divine,
    })),
    stats: {
      population: +w.regions.reduce((s, r) => s + r.population, 0).toFixed(0),
      wealth: +w.houses.filter((h) => !h.fallenEra).reduce((s, h) => s + h.treasury.wealth, 0).toFixed(0),
      activeWars: w.wars.filter((x) => !x.over).length,
      plaguedRegions: w.regions.filter((r) => r.plague > 0).length,
      famineRegions: w.regions.filter((r) => r.famine).length,
      techsKnown: w.cultures.reduce((s, c) => s + Object.values(c.tech).filter(Boolean).length, 0),
      tracked: livingPeople(w).length,
    },
  };
}

export function listLivingView(w: World): PersonView[] {
  return livingPeople(w).map((p) => {
    const held = artifactsHeldBy(w, p.id);
    return {
      id: p.id, name: p.name, house: houseOf(w, p.houseId)?.name ?? "—", houseId: p.houseId,
      age: ageOf(p, w.era), renown: +renown(w, p).toFixed(2),
      chosen: !!p.chosen, holdsSword: held.some((a) => a.id === premierArtifact(w)?.id),
      // deep extensions
      artifacts: held.map((a) => a.name),
      traits: p.traits.slice(), desire: p.desire, wound: p.wound,
      drives: Object.fromEntries(Object.entries(p.drives).map(([k, v]) => [k, +(v ?? 0).toFixed(2)])),
      prowess: +p.prowess.toFixed(2), guile: +p.guile.toFixed(2), acumen: +p.acumen.toFixed(2), zeal: +p.zeal.toFixed(2),
      faith: p.faithName ?? null, hair: p.hair, avatar: !!p.avatar,
      isLord: w.offices["lord_" + p.houseId]?.holderId === p.id,
      isMonarch: w.crown.holderId === p.id,
      spouse: p.spouseId ? w.people[p.spouseId]?.name ?? null : null,
      lastAction: p.lastAction ?? null,
      deeds: p.deeds.slice(),
    };
  }).sort((a, b) => b.renown - a.renown || (a.id < b.id ? -1 : 1));
}

export function inspectPerson(w: World, pid: string) {
  const p = w.people[pid]; if (!p) return null;
  return {
    id: p.id, name: p.name, alive: p.alive, deathCause: p.deathCause ?? null,
    house: houseOf(w, p.houseId)?.name ?? null, age: ageOf(p, w.era),
    traits: p.traits, drives: p.drives, wound: p.wound, desire: p.desire,
    deeds: p.deeds.slice(),
    parents: p.parents.map((id) => w.people[id]?.name ?? id),
    spouse: p.spouseId ? w.people[p.spouseId]?.name ?? null : null,
    children: Object.values(w.people).filter((c) => c.parents.includes(p.id)).map((c) => ({ name: c.name, alive: c.alive })),
    bonds: relsFor(w, pid).map((r) => ({
      with: w.people[r.from === pid ? r.to : r.from]?.name ?? "—",
      out: r.from === pid,
      affection: +r.affection.toFixed(2), trust: +r.trust.toFixed(2), rivalry: +r.rivalry.toFixed(2),
      why: r.why ?? null,
    })),
  };
}
