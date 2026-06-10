/**
 * The Divine Hand: the player-god's powers. The god is INFINITE — nothing here
 * is gated by faith or cost. The only constraint is the Vow the player chose,
 * and the Vow is breakable: breaking it changes how the world's faiths see the
 * god (descriptive), never what the god can do.
 *
 * Every act is journaled {era, op, args} — replaying the journal over the same
 * seed reproduces the run exactly (this is also the rewind mechanism).
 */
import type { RNG } from "./rng";
import { chance, clamp, pick } from "./rng";
import type { Person, VowKind, World } from "./types";
import {
  adjStanding, ageOf, artifactsHeldBy, bumpPhase, bumpRel, deed, departWorld,
  deriveDesire, ev, faithById, houseLiving, houseOf, housesAlive, kill, livingFaiths,
  livingPeople, monarch, pName, premierArtifact, promoteCommoner, regionOf, regionsOf,
  renown,
} from "./world";
import { foundFaith } from "./systems/faith";
import { speakProphecy as prophecyOf } from "./systems/memory";
import { artifactName } from "./names";

export const VOWS: Record<VowKind, { text: string; breaks: string[] }> = {
  "none": { text: "No vow binds the god.", breaks: [] },
  "no-blood": { text: "I shall take no mortal life, nor send death upon the land.", breaks: ["smite", "sendPlague", "blightLand"] },
  "even-hand": { text: "I shall favor no house, no soul, no banner above another.", breaks: ["bless", "favorHouse", "nameChosen", "bestowArtifact", "bestowSword", "inciteWar", "ordainMarriage"] },
  "one-miracle": { text: "I shall work no more than one wonder in any age.", breaks: ["*second-act*"] },
  "silence": { text: "I shall not speak — no whisper, no prophecy, no descent.", breaks: ["whisper", "speakProphecy", "incarnate"] },
  "mercy": { text: "I shall never harm what I have made.", breaks: ["smite", "curse", "blightLand", "sendPlague", "witherFaith"] },
};

const WRATHFUL = new Set(["smite", "curse", "blightLand", "sendPlague", "witherFaith", "inciteWar"]);
const GRACIOUS = new Set(["bless", "blessLand", "sendBounty", "imposePeace", "hallow", "emboldenFaith", "kindleFaith"]);

export function makeDivine(w: World, rng: RNG) {
  /** every act passes through here: journal, vow, creed-imprint */
  function act(op: string, args: unknown[], flavor: string): boolean {
    bumpPhase(w); // divine acts change the world — never let might caches go stale
    w.journal.push({ era: w.era, op, args });
    if (w.deity.lastActEra !== w.era) { w.deity.actsThisEra = 0; }
    w.deity.actsThisEra++; w.deity.lastActEra = w.era;

    const vow = w.deity.vow;
    if (vow && !vow.broken && vow.kind !== "none") {
      const def = VOWS[vow.kind];
      const breaks = def.breaks.includes(op) || (vow.kind === "one-miracle" && w.deity.actsThisEra > 1);
      if (breaks) {
        vow.broken = true; vow.brokenEra = w.era;
        ev(w, "vow", `— THE VOW IS BROKEN — The god swore: "${vow.text}" The god has done otherwise. In every shrine the lamps gutter; the faiths must decide what kind of god they have.`,
          { importance: 3, divine: true });
        for (const f of livingFaiths(w)) {
          f.memoryOfGod = clamp(f.memoryOfGod + 0.25, 0, 1);
          f.creed = f.creed === "devout" ? "doubtful" : f.creed === "doubtful" ? "fearful" : f.creed;
          f.zeal = clamp(f.zeal + 0.1, 0, 1);
        }
      }
    }
    // the faiths watch what the god does and update their creeds
    for (const f of livingFaiths(w)) {
      f.memoryOfGod = clamp(f.memoryOfGod + 0.12, 0, 1);
      if (WRATHFUL.has(op)) f.creed = f.creed === "defiant" ? "defiant" : "fearful";
      else if (GRACIOUS.has(op) && f.creed !== "defiant" && chance(rng, 0.6)) f.creed = "devout";
    }
    w.deity.marks.push({ era: w.era, op, args, flavor, vowBroken: !!w.deity.vow?.broken && w.deity.vow.brokenEra === w.era });
    if (w.deity.marks.length > 60) w.deity.marks.shift();
    return true;
  }

  const D = {
    /* ── the original levers (signatures unchanged) ── */
    nameChosen(personId: string) {
      const p = w.people[personId]; if (!p?.alive) return;
      // the charge is laid against the mightiest power that is NOT the chosen's own blood
      const target = (w.empireHouseId && w.empireHouseId !== p.houseId ? w.empireHouseId : null)
        ?? housesAlive(w).filter((h) => h.id !== p.houseId)
          .sort((a, b) => (b.holdings + (w.crown.houseId === b.id ? 2 : 0)) - (a.holdings + (w.crown.houseId === a.id ? 2 : 0)) || (a.id < b.id ? -1 : 1))[0]?.id ?? null;
      const tHouse = houseOf(w, target);
      w.chosen = {
        personId, outcome: null, targetId: target,
        baselineHoldings: target ? regionsOf(w, target).length : 0,
      };
      p.chosen = true;
      p.prowess = clamp(p.prowess + 0.4, 0, 1); p.guile = clamp(p.guile + 0.3, 0, 1);
      p.drives = { legacy: 0.4, status: 0.35, faith: 0.25 };
      p.desire = "to do what the god has charged";
      act("nameChosen", [personId], `named ${p.name} the chosen`);
      deed(w, p, "was named the god's Chosen", 0.2);
      ev(w, "divine", `— THE DIVINE HAND — The god appears to ${pName(w, p)} and names them the one foretold to bring down ${tHouse ? (w.empireHouseId === target ? "the " + tHouse.name + " Empire" : "the might of House " + tHouse.name) : "the mighty"}.`,
        { importance: 3, actors: [p.id], divine: true, motive: "faith" });
      if (target) prophecyOf(w, rng, "divine", { subjectSpec: { personId }, predicate: { kind: "cast-down-house", targetId: target } });
    },
    bestowSword(personId: string) {
      const a = premierArtifact(w); if (a) D.bestowArtifact(a.id, personId);
    },
    reclaimSword() {
      const a = premierArtifact(w); if (a) D.reclaimArtifact(a.id);
    },
    bless(personId: string) {
      const p = w.people[personId]; if (!p?.alive) return;
      p.prowess = clamp(p.prowess + 0.25, 0, 1); p.acumen = clamp(p.acumen + 0.15, 0, 1);
      p.renownBase = clamp(p.renownBase + 0.1, 0, 1.2);
      if (w.crown.holderId === personId) w.crown.legitimacy = clamp(w.crown.legitimacy + 0.2, 0, 1);
      act("bless", [personId], `blessed ${p.name}`);
      ev(w, "divine", `— THE DIVINE HAND — A blessing of the god settles upon ${pName(w, p)}; candles steady when they pass.`,
        { importance: 2, actors: [p.id], divine: true });
    },

    /* ── souls ── */
    smite(personId: string) {
      const p = w.people[personId]; if (!p?.alive) return;
      act("smite", [personId], `smote ${p.name}`);
      if (p.avatar) return;
      kill(w, p, "struck down by the god");
      w.grace = clamp(w.grace - 0.15, 0, 1.5);
      ev(w, "divine", `— THE DIVINE HAND — ${pName(w, p)} is struck down where they stand; the sky is cloudless. No one says anything for a long time.`,
        { importance: 3, actors: [p.id], divine: true });
    },
    curse(personId: string) {
      const p = w.people[personId]; if (!p?.alive) return;
      p.prowess = clamp(p.prowess - 0.2, 0.05, 1); p.acumen = clamp(p.acumen - 0.15, 0.05, 1);
      p.drives.security = clamp((p.drives.security ?? 0) + 0.3, 0, 1);
      p.wound = p.wound ?? "a mark of heaven's displeasure"; p.desire = deriveDesire(w, p);
      act("curse", [personId], `cursed ${p.name}`);
      ev(w, "divine", `— THE DIVINE HAND — A curse settles on ${pName(w, p)}: bread molds at their table, horses shy, old friends forget their name.`,
        { importance: 2, actors: [p.id], divine: true });
    },
    whisper(personId: string, drive: string) {
      const p = w.people[personId]; if (!p?.alive) return;
      const d = drive as keyof Person["drives"];
      p.drives[d] = clamp((p.drives[d] ?? 0) + 0.45, 0, 1);
      const sum = Object.values(p.drives).reduce((s, v) => s + (v ?? 0), 0) || 1;
      for (const k of Object.keys(p.drives) as (keyof Person["drives"])[]) p.drives[k] = +((p.drives[k] ?? 0) / sum).toFixed(3);
      p.desire = deriveDesire(w, p);
      act("whisper", [personId, drive], `whispered ${drive} into ${p.name}`);
      ev(w, "divine", `— A WHISPER — ${pName(w, p)} wakes from a dream they cannot shake, wanting something they did not want before.`,
        { importance: 1, actors: [p.id], divine: true });
    },
    ordainMarriage(aId: string, bId: string) {
      const a = w.people[aId], b = w.people[bId];
      if (!a?.alive || !b?.alive || a.spouseId || b.spouseId) return;
      a.spouseId = b.id; b.spouseId = a.id;
      bumpRel(w, a.id, b.id, { affection: 0.7, trust: 0.5 }, "joined by heaven");
      bumpRel(w, b.id, a.id, { affection: 0.7, trust: 0.5 }, "joined by heaven");
      adjStanding(w, a.houseId, b.houseId, 0.4);
      act("ordainMarriage", [aId, bId], `joined ${a.name} and ${b.name}`);
      ev(w, "divine", `— THE DIVINE HAND — ${a.name} and ${b.name} meet on a road neither meant to take, and the matter is settled by spring. Houses ${houseOf(w, a.houseId)?.name} and ${houseOf(w, b.houseId)?.name} are bound.`,
        { importance: 2, actors: [a.id, b.id], divine: true, motive: "love" });
    },

    /* ── lands ── */
    blessLand(regionId: string) {
      const r = regionOf(w, regionId); if (!r) return;
      r.prosperity = clamp(r.prosperity + 0.18, 0, 1); r.devastation = clamp(r.devastation - 0.25, 0, 1); r.famine = false;
      act("blessLand", [regionId], `blessed ${r.name}`);
      ev(w, "divine", `— THE DIVINE HAND — Rain comes sweet to ${r.name}; the soil turns black and willing. Old men weep in the furrows.`,
        { importance: 2, regionId, divine: true });
    },
    blightLand(regionId: string) {
      const r = regionOf(w, regionId); if (!r) return;
      r.prosperity = clamp(r.prosperity - 0.22, 0.05, 1); r.devastation = clamp(r.devastation + 0.2, 0, 1); r.famine = true;
      act("blightLand", [regionId], `blighted ${r.name}`);
      w.grace = clamp(w.grace - 0.1, 0, 1.5);
      ev(w, "divine", `— THE DIVINE HAND — The fields of ${r.name} blacken overnight. The priests are asked questions they cannot answer.`,
        { importance: 2, regionId, divine: true });
    },
    sendPlague(regionId: string) {
      const r = regionOf(w, regionId); if (!r) return;
      r.plague = 3;
      act("sendPlague", [regionId], `sent plague upon ${r.name}`);
      w.grace = clamp(w.grace - 0.2, 0, 1.5);
      ev(w, "divine", `— THE DIVINE HAND — A sickness with no name walks into ${r.name} on no feet at all.`,
        { importance: 3, regionId, divine: true });
    },
    sendBounty(regionId: string) {
      const r = regionOf(w, regionId); if (!r) return;
      r.prosperity = clamp(r.prosperity + 0.1, 0, 1); r.famine = false;
      const owner = r.ownerId ? houseOf(w, r.ownerId) : null;
      if (owner) owner.treasury.food = clamp(owner.treasury.food + 3, 0, 8);
      act("sendBounty", [regionId], `sent bounty to ${r.name}`);
      ev(w, "divine", `— THE DIVINE HAND — The nets of ${r.name} come up full and the orchards bow; this year no one goes hungry.`,
        { importance: 1, regionId, divine: true });
    },
    hallow(regionId: string, faithId?: string) {
      const r = regionOf(w, regionId); if (!r) return;
      const f = faithId ? faithById(w, faithId) : livingFaiths(w).sort((a, b) => b.vitality - a.vitality)[0];
      if (!f) return;
      r.sacredTo = f.name; r.faithName = f.name; r.devotion = clamp(r.devotion + 0.35, 0, 1);
      if (!f.sacredRegionIds.includes(r.id)) f.sacredRegionIds.push(r.id);
      f.vitality = clamp(f.vitality + 0.1, 0, 1);
      act("hallow", [regionId, faithId ?? null], `hallowed ${r.name}`);
      ev(w, "divine", `— THE DIVINE HAND — Light stands on ${r.name} like a pillar at noon. ${f.name} names it holy ground before the week is out.`,
        { importance: 2, regionId, divine: true, motive: "faith" });
    },

    /* ── houses ── */
    inciteWar(houseA: string, houseB: string) {
      const a = houseOf(w, houseA), b = houseOf(w, houseB);
      if (!a || !b || a.fallenEra || b.fallenEra) return;
      adjStanding(w, houseA, houseB, -0.7);
      const lord = houseLiving(w, houseA).sort((x, y) => renown(w, y) - renown(w, x) || (x.id < y.id ? -1 : 1))[0];
      act("inciteWar", [houseA, houseB], `set ${a.name} against ${b.name}`);
      const eid = ev(w, "divine", `— A WHISPER — Insults are remembered that were never spoken. House ${a.name} and House ${b.name} each become certain the other means them harm.`,
        { importance: 2, houses: [houseA, houseB], divine: true });
      if (lord) w.intents.wars.push({
        houseId: houseA, targetId: houseB, byId: lord.id,
        aim: { kind: "grudge", label: "over a quarrel kindled by heaven" }, causedBy: [eid],
      });
    },
    imposePeace(houseA: string, houseB: string) {
      let ended = 0;
      for (const x of w.wars) {
        if (x.over) continue;
        if ((x.attackerId === houseA && x.defenderId === houseB) || (x.attackerId === houseB && x.defenderId === houseA)) { x.over = true; ended++; }
      }
      adjStanding(w, houseA, houseB, 0.5);
      const a = houseOf(w, houseA), b = houseOf(w, houseB);
      act("imposePeace", [houseA, houseB], `imposed peace between ${a?.name} and ${b?.name}`);
      ev(w, "divine", `— THE DIVINE HAND — ${ended ? "On the morning of battle, every sword in two armies is found rusted into its sheath" : "A heaviness settles on two angry halls"}. House ${a?.name} and House ${b?.name} make peace, not entirely sure why.`,
        { importance: 2, houses: [houseA, houseB], divine: true });
    },
    favorHouse(houseId: string) {
      const h = houseOf(w, houseId); if (!h || h.fallenEra) return;
      h.prestige = clamp(h.prestige + 0.25, 0, 2);
      h.treasury.wealth = clamp(h.treasury.wealth + 3, -4, 30);
      if (w.crown.houseId === houseId) w.crown.legitimacy = clamp(w.crown.legitimacy + 0.15, 0, 1);
      act("favorHouse", [houseId], `favored House ${h.name}`);
      ev(w, "divine", `— THE DIVINE HAND — Fortune leans toward House ${h.name}: lost ledgers reappear, debts are forgiven, rivals stumble on the stairs.`,
        { importance: 2, houses: [houseId], divine: true });
    },

    /* ── faiths ── */
    kindleFaith(focus?: string) {
      if (livingFaiths(w).length >= 6) return;
      const f0 = focus ?? "god";
      const prophet = livingPeople(w).filter((p) => ageOf(p, w.era) >= 16 && !p.avatar)
        .sort((a, b) => b.zeal - a.zeal || (a.id < b.id ? -1 : 1))[0]
        ?? promoteCommoner(w, rng, housesAlive(w)[0].id, 30);
      prophet.zeal = clamp(prophet.zeal + 0.3, 0, 1);
      const f = foundFaith(w, rng, f0, prophet.id);
      f.creed = "devout"; f.memoryOfGod = 1;
      act("kindleFaith", [focus ?? null], `kindled ${f.name}`);
      deed(w, prophet, `was seized by the god and founded ${f.name}`, 0.2);
      ev(w, "divine", `— THE DIVINE HAND — ${pName(w, prophet)} is taken by a vision in the open street. By winter there are altars: ${f.name} is born knowing exactly whom it serves.`,
        { importance: 3, actors: [prophet.id], divine: true, motive: "faith" });
    },
    sparkSchism(faithId: string) {
      const f = faithById(w, faithId); if (!f || f.dissolvedEra || livingFaiths(w).length >= 6) return;
      const newFocus = f.focus === "relic" ? "reforged" : f.focus === "god" ? "salvation" : "god";
      const child = foundFaith(w, rng, newFocus, null, { parentId: f.id, vitality: 0.4 });
      f.vitality = clamp(f.vitality - 0.2, 0.05, 1);
      act("sparkSchism", [faithId], `split ${f.name}`);
      ev(w, "divine", `— A WHISPER — Two keepers of ${f.name} preach the same text and arrive at war. The breakaway raises ${child.name}; each side is certain heaven is theirs.`,
        { importance: 3, divine: true, motive: "faith" });
    },
    emboldenFaith(faithId: string) {
      const f = faithById(w, faithId); if (!f || f.dissolvedEra) return;
      f.vitality = clamp(f.vitality + 0.2, 0, 1); f.zeal = clamp(f.zeal + 0.1, 0, 1); f.memoryOfGod = clamp(f.memoryOfGod + 0.3, 0, 1);
      act("emboldenFaith", [faithId], `emboldened ${f.name}`);
      ev(w, "divine", `— THE DIVINE HAND — In every shrine of ${f.name} on the same night, the lamps burn blue and do not gutter. Attendance doubles.`,
        { importance: 2, divine: true, motive: "faith" });
    },
    witherFaith(faithId: string) {
      const f = faithById(w, faithId); if (!f || f.dissolvedEra) return;
      f.vitality = clamp(f.vitality - 0.25, 0.05, 1); f.zeal = clamp(f.zeal - 0.1, 0, 1); f.creed = "fearful";
      act("witherFaith", [faithId], `withered ${f.name}`);
      ev(w, "divine", `— THE DIVINE HAND — The prayers of ${f.name} begin coming back like letters to a dead address. Its keepers age a decade in a season.`,
        { importance: 2, divine: true, motive: "faith" });
    },

    /* ── relics ── */
    bestowArtifact(artifactId: string, personId: string) {
      const a = w.artifacts.find((x) => x.id === artifactId); const p = w.people[personId];
      if (!a || !p?.alive || a.state === "destroyed") return;
      a.holderId = p.id; a.state = "held"; a.legend += 1; a.lostInRegionId = null;
      a.custody.push({ holderId: p.id, era: w.era, how: "bestowed by the god" });
      act("bestowArtifact", [artifactId, personId], `set ${a.name} in ${p.name}'s hand`);
      deed(w, p, `received ${a.name} from the god's own hand`, 0.15);
      ev(w, "divine", `— THE DIVINE HAND — The god sets ${a.name} into the hand of ${pName(w, p)}.`,
        { importance: 3, actors: [p.id], divine: true });
    },
    reclaimArtifact(artifactId: string) {
      const a = w.artifacts.find((x) => x.id === artifactId); if (!a || a.state !== "held") return;
      const h = a.holderId ? w.people[a.holderId] : null;
      a.holderId = null; a.state = "lost"; a.lostInRegionId = pick(rng, w.regions).id;
      act("reclaimArtifact", [artifactId], `reclaimed ${a.name}`);
      ev(w, "divine", `— THE DIVINE HAND — The god reclaims ${a.name}${h ? " from " + h.name : ""}; it passes out of the world into legend.`,
        { importance: 2, divine: true });
    },
    forgeArtifact() {
      if (w.artifacts.length >= 9) return;
      const used = new Set(w.artifacts.map((x) => x.name));
      const cult = pick(rng, w.cultures);
      const { name, kind } = artifactName(rng, cult, used);
      const region = pick(rng, w.regions);
      const powers = ["war", "crown", "sight", "plenty", "dread", "grace"] as const;
      w.artifacts.push({
        id: "a" + w.artifacts.length, name, kind, holderId: null, state: "lost",
        lostInRegionId: region.id, legend: 3, will: 0.5 + rng() * 0.4,
        wants: pick(rng, ["a worthy hand", "to be sung of in every hall", "to return to the god who loosed it"]),
        attune: pick(rng, w.houses.map((h) => h.hair)), power: pick(rng, powers), custody: [], cultName: null,
      });
      act("forgeArtifact", [], `forged ${name}`);
      ev(w, "divine", `— THE DIVINE HAND — Shepherds near ${region.name} report a night without stars and a sound like a hammer. Somewhere in those hills, ${name} now waits to be found.`,
        { importance: 3, regionId: region.id, divine: true });
    },

    /* ── heaven ── */
    speakProphecy(personId?: string) {
      const spec = personId ? { personId } : undefined;
      const predicate = personId ? { kind: "take-crown" as const, targetId: w.crown.houseId ?? "" } : undefined;
      prophecyOf(w, rng, "divine", { subjectSpec: spec, predicate });
      act("speakProphecy", [personId ?? null], "spoke a prophecy");
    },
    setVow(kind: VowKind) {
      w.deity.vow = kind === "none" ? null : { kind, text: VOWS[kind].text, broken: false };
      w.journal.push({ era: w.era, op: "setVow", args: [kind] });
      if (kind !== "none")
        ev(w, "vow", `— THE VOW — The god binds itself: "${VOWS[kind].text}" Nothing in heaven or earth enforces this. That is the point.`,
          { importance: 2, divine: true });
    },
    incarnate(houseId?: string, name?: string, backstory?: string) {
      if (w.deity.incarnationId && w.people[w.deity.incarnationId]?.alive) return;
      const h = houseOf(w, houseId ?? "") ?? housesAlive(w)[0]; if (!h) return;
      const p = promoteCommoner(w, rng, h.id, 20);
      if (name) { p.name = name; p.baseName = name; }
      p.avatar = true;
      p.prowess = 0.95; p.guile = 0.85; p.acumen = 0.9; p.zeal = 1;
      p.traits = ["just", "charming", "bold"];
      p.drives = { legacy: 0.4, love: 0.3, knowledge: 0.3 };
      p.wound = null; p.desire = "to walk among what was made, and be known or not known";
      w.deity.incarnationId = p.id;
      w.deity.incarnationBackstory = backstory ?? `A stranger of House ${h.name} with no childhood anyone remembers.`;
      w.deity.humbled = false;
      act("incarnate", [houseId ?? null, name ?? null, backstory ?? null], `descended as ${p.name}`);
      ev(w, "divine", `— THE DESCENT — A stranger arrives at ${h.seat} with road-dust that smells of rain. The chronicle will know ${p.name} of House ${h.name}; heaven, for a while, stands empty.`,
        { importance: 3, actors: [p.id], divine: true });
    },
    ascend() {
      const p = w.deity.incarnationId ? w.people[w.deity.incarnationId] : null;
      if (!p) return;
      departWorld(w, p, "ascended");
      for (const a of artifactsHeldBy(w, p.id)) { a.holderId = null; a.state = "lost"; a.lostInRegionId = pick(rng, w.regions).id; }
      w.deity.incarnationId = null;
      act("ascend", [], "ascended");
      ev(w, "divine", `— THE ASCENT — ${pName(w, p)} walks up a hill that was never that tall before and does not come down. The body is never found because there is no body.`,
        { importance: 3, actors: [p.id], divine: true });
    },
  };
  return D;
}
