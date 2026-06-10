/**
 * Memory: the world remembers. Grudges decay slowly (slower once written down),
 * prophecies bind the future and bend the present (paranoid kings make their own
 * dooms), the Chosen's saga plays out, and the age itself takes on a mood.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { Person, Prophecy, System, World } from "../types";
import {
  ageOf, bumpRel, cultureOf, ev, houseLiving, houseOf, housesAlive, kill, livingFaiths,
  livingPeople, monarch, pName, realmMight, regionsOf, renown, standing, adjStanding, wound,
} from "../world";

export function speakProphecy(
  w: World, rng: RNG, origin: Prophecy["origin"],
  opts: { subjectSpec?: Prophecy["subjectSpec"]; predicate?: Prophecy["predicate"]; causedBy?: string[] } = {},
): Prophecy | null {
  // default doom: the mightiest power in the land will be cast down
  const target = w.empireHouseId ?? w.crown.houseId
    ?? housesAlive(w).sort((a, b) => realmMight(w, b.id) - realmMight(w, a.id) || (a.id < b.id ? -1 : 1))[0]?.id;
  if (!target && !opts.predicate) return null;
  const predicate = opts.predicate ?? { kind: "cast-down-house" as const, targetId: target! };
  const hair = opts.subjectSpec?.hair ?? pick(rng, w.houses.map((h) => h.hair));
  const subjectSpec = opts.subjectSpec ?? { hair };
  const targetName =
    predicate.kind === "doom-of-faith" ? w.faiths.find((f) => f.id === predicate.targetId)?.name
    : predicate.kind === "find-artifact" ? w.artifacts.find((a) => a.id === predicate.targetId)?.name
    : "House " + (houseOf(w, predicate.targetId)?.name ?? "—");
  const who = subjectSpec.personId ? w.people[subjectSpec.personId]?.name
    : subjectSpec.houseId ? `a child of House ${houseOf(w, subjectSpec.houseId)?.name}`
    : `a ${subjectSpec.hair}-haired child not yet grown`;
  const verb = predicate.kind === "take-crown" ? "wear the crown"
    : predicate.kind === "find-artifact" ? `raise up ${targetName}`
    : predicate.kind === "doom-of-faith" ? `see ${targetName} fall silent`
    : `cast down ${targetName}`;
  const p: Prophecy = {
    id: "y" + (w.seq.prophecy = (w.seq.prophecy || 0) + 1),
    text: `${who} shall ${verb}`,
    origin, utteredEra: w.era, subjectSpec, predicate, status: "open",
    subjectId: subjectSpec.personId ?? null,
  };
  w.prophecies.push(p);
  const voice = origin === "seer" ? "A seer speaks under the turning stars" : origin === "artifact" ? "The relic dreams aloud through its bearer" : origin === "adversary" ? "A voice out of the dark makes its promise" : "The god speaks, and the world hears";
  ev(w, "prophecy", `${voice}: "${p.text}." The words travel faster than any rider.`,
    { importance: 3, causedBy: opts.causedBy, motive: "faith", divine: origin === "divine" });
  return p;
}

function matchesSubject(w: World, p: Person, spec: Prophecy["subjectSpec"]): boolean {
  if (spec.personId) return p.id === spec.personId;
  if (spec.houseId && p.houseId !== spec.houseId) return false;
  if (spec.hair && p.hair !== spec.hair) return false;
  return true;
}

export const memory: System = {
  name: "memory",
  run(w, rng) {
    /* grudges fade — unless written down */
    for (const h of w.houses) {
      const writing = cultureOf(w, h.culture).tech.writing;
      for (const g of h.grudges) g.weight *= writing ? 0.97 : 0.92;
      h.grudges = h.grudges.filter((g) => g.weight > 0.1);
    }

    /* seers and far-seeing relics utter new prophecies */
    if (w.prophecies.filter((p) => p.status === "open").length < 2) {
      const stargazers = w.cultures.some((c) => c.tech.astronomy);
      const sightRelic = w.artifacts.find((a) => a.state === "held" && a.power === "sight" && w.people[a.holderId ?? ""]?.alive);
      if (sightRelic && chance(rng, 0.18)) speakProphecy(w, rng, "artifact");
      else if (stargazers && chance(rng, 0.1)) speakProphecy(w, rng, "seer");
    }

    /* prophecies seek their subjects, bend the present, and resolve */
    for (const p of w.prophecies) {
      if (p.status !== "open") continue;

      if (!p.subjectId) {
        const candidates = livingPeople(w).filter((x) => ageOf(x, w.era) <= 30 && matchesSubject(w, x, p.subjectSpec))
          .sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1));
        if (candidates.length && chance(rng, 0.5)) {
          p.subjectId = candidates[0].id;
          const s = candidates[0];
          s.renownBase = clamp(s.renownBase + 0.1, 0, 1.2);
          ev(w, "prophecy", `Eyes turn to ${pName(w, s)} — ${s.hair}-haired, and the right age. The foretold one, some say.`,
            { importance: 2, actors: [s.id], motive: "faith" });
        }
      }

      /* the paranoid king hunts the foretold child — and makes his own enemy */
      const m = monarch(w);
      if (m && p.predicate.kind === "cast-down-house" && p.predicate.targetId === m.houseId
        && (m.traits.includes("paranoid") || m.traits.includes("cruel")) && chance(rng, 0.4)) {
        const subject = p.subjectId ? w.people[p.subjectId] : null;
        if (subject?.alive && subject.houseId !== m.houseId) {
          if (chance(rng, 0.35)) {
            kill(w, subject, `hunted down on the king's order by ${m.houseId}`);
            p.status = "averted"; p.resolvedEra = w.era;
            ev(w, "persecution", `${m.name} sends riders by night: ${pName(w, subject)}, the foretold one, is cut down. The prophecy is strangled in its cradle — men say such blood does not wash out.`,
              { importance: 3, actors: [m.id, subject.id], motive: "security" });
            w.crown.legitimacy = clamp(w.crown.legitimacy - 0.12, 0, 1);
            const sh = houseOf(w, subject.houseId);
            if (sh) { adjStanding(w, sh.id, m.houseId, -0.5); }
          } else {
            ev(w, "persecution", `${m.name}'s riders hunt ${pName(w, subject)}, the foretold one — and miss. Every door in the realm now opens to the fugitive.`,
              { importance: 2, actors: [m.id, subject.id], motive: "security" });
            wound(w, subject, `being hunted by ${m.name} for a prophecy`, m.houseId);
            subject.renownBase = clamp(subject.renownBase + 0.15, 0, 1.2);
            bumpRel(w, subject.id, m.id, { affection: -0.6, rivalry: 0.5 }, "hunted for a prophecy");
          }
        }
      }

      /* mechanical resolution */
      const subject = p.subjectId ? w.people[p.subjectId] : null;
      switch (p.predicate.kind) {
        case "cast-down-house": {
          const t = houseOf(w, p.predicate.targetId);
          const fallen = !t || t.fallenEra !== null || (w.crown.houseId !== t.id && w.empireHouseId !== t.id && regionsOf(w, t.id).length <= 1);
          if (fallen) {
            p.status = subject?.alive ? "fulfilled" : "twisted"; p.resolvedEra = w.era;
            ev(w, "prophecy", p.status === "fulfilled"
              ? `It is done as it was spoken: House ${t?.name ?? "—"} is brought low, and ${subject!.name} lives to see it.`
              : `House ${t?.name ?? "—"} falls — but not by the hand foretold. The prophecy is fulfilled crookedly, and seers argue what that means.`,
              { importance: 3, actors: subject ? [subject.id] : [], motive: "faith" });
          }
          break;
        }
        case "take-crown":
          if (subject && w.crown.holderId === subject.id) {
            p.status = "fulfilled"; p.resolvedEra = w.era;
            ev(w, "prophecy", `The words come true: ${subject.name} wears the crown, as it was spoken.`, { importance: 3, actors: [subject.id] });
          }
          break;
        case "find-artifact": {
          const a = w.artifacts.find((x) => x.id === p.predicate.targetId);
          if (subject && a?.holderId === subject.id) {
            p.status = "fulfilled"; p.resolvedEra = w.era;
            ev(w, "prophecy", `${subject.name} raises ${a.name}, as the stars promised.`, { importance: 3, actors: [subject.id] });
          }
          break;
        }
        case "doom-of-faith": {
          const f = w.faiths.find((x) => x.id === p.predicate.targetId);
          if (f?.dissolvedEra) {
            p.status = "fulfilled"; p.resolvedEra = w.era;
            ev(w, "prophecy", `${f.name} falls silent, as was foretold.`, { importance: 2 });
          }
          break;
        }
      }
      if (p.status === "open" && subject && !subject.alive) { p.status = "averted"; p.resolvedEra = w.era; }
      if (p.status === "open" && w.era - p.utteredEra > 8) { p.status = "averted"; p.resolvedEra = w.era; }
    }

    /* the Chosen's saga: rally, war, fulfilment or ruin */
    if (w.chosen && !w.chosen.outcome) {
      const c = w.people[w.chosen.personId];
      if (!c?.alive) {
        w.chosen.outcome = "broken";
        ev(w, "chosen", `${c?.name ?? "The chosen"}, the god's chosen, is dead — the charge unfulfilled, the prophecy broken.`, { importance: 3 });
      } else if (ageOf(c, w.era) >= 16 && w.empireHouseId && w.empireHouseId !== c.houseId) {
        const emp = houseOf(w, w.empireHouseId)!;
        // the oppressed flock to the banner
        for (const h of housesAlive(w)) {
          if (h.id === c.houseId || h.id === emp.id) continue;
          if (h.overlordId === emp.id && chance(rng, 0.45)) {
            h.overlordId = null; h.loyalty = 1;
            adjStanding(w, h.id, c.houseId, 0.4);
            ev(w, "chosen", `House ${h.name} forsakes the ${emp.name} Empire and declares for ${c.name}.`, { importance: 2, houses: [h.id, emp.id], actors: [c.id] });
          }
        }
        const alreadyAtWar = w.wars.some((x) => !x.over && x.attackerId === c.houseId && x.defenderId === emp.id);
        if (!alreadyAtWar && chance(rng, 0.7)) {
          w.intents.wars.push({
            houseId: c.houseId, targetId: emp.id, byId: c.id,
            aim: { kind: "coalition", claimantId: c.id, label: `to throw down the ${emp.name} Empire, as the god foretold` },
          });
        }
      } else if (!w.empireHouseId && ageOf(c, w.era) >= 16) {
        // the empire is already gone — the charge stands fulfilled
        w.chosen.outcome = "fulfilled";
        ev(w, "chosen", `The empire the god named is no more. ${pName(w, c)} has done — or outlived — what was foretold.`, { importance: 3, actors: [c.id] });
      }
    }

    /* the age takes a mood — thresholds with hysteresis, not drift */
    const battlesThisEra = w.chronicle.filter((e) => e.era === w.era && (e.kind === "war" || e.kind === "battle" || e.kind === "crusade")).length;
    const avgProsp = w.regions.reduce((s, r) => s + r.prosperity, 0) / w.regions.length;
    const plagued = w.regions.filter((r) => r.plague > 0).length;
    const starving = w.regions.filter((r) => r.famine).length;
    const hotFaith = livingFaiths(w).sort((a, b) => b.zeal - a.zeal)[0];
    let label = w.mood.label;
    if (plagued >= 4 || (avgProsp < 0.33 && starving >= 3)) label = "a Dark Age";
    else if (battlesThisEra >= 5) label = "an Age of Blood";
    else if (avgProsp > 0.6 && battlesThisEra === 0 && plagued === 0 && starving === 0) label = "a Golden Age";
    else if (hotFaith && hotFaith.zeal > 0.75 && hotFaith.vitality > 0.6) label = "an Age of Faith";
    else if (battlesThisEra === 0 && w.era - w.mood.since >= 3 && (w.mood.label === "an Age of Blood" || w.mood.label === "a Dark Age")) label = "a Quiet Age";
    else if (battlesThisEra >= 1 && w.mood.label === "a Golden Age") label = "an Age of Iron";
    if (label !== w.mood.label && w.era - w.mood.since >= 2) {
      const lines: Record<string, string> = {
        "a Golden Age": "The roads are safe, the barns are full, and even the old men admit the times are good. A Golden Age begins.",
        "a Dark Age": "Plague, hunger and fear close over the land like water over a stone. A Dark Age begins.",
        "an Age of Blood": "Every horizon smokes. The chroniclers dip their pens and name it an Age of Blood.",
        "an Age of Faith": "Bells and banners answer one another from every hill: an Age of Faith.",
        "a Quiet Age": "The wars gutter out. What follows is not yet peace, but it is quiet.",
        "an Age of Iron": "The good years end the way they always do — with banners on the road. An Age of Iron begins.",
      };
      w.mood = { label, since: w.era };
      ev(w, "age", lines[label] ?? `The age turns: men begin to call it ${label}.`, { importance: 3 });
    }
  },
};
