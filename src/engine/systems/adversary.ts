/**
 * The adversary (run-start option): a rival deity working the world against
 * you, or a mortal god-slayer climbing toward heaven artifact by artifact.
 * Both are pure engine mechanics — the same deterministic stream as everything
 * else — and both can be beaten by mortals, the Chosen, or you.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { System, World } from "../types";
import {
  adjStanding, artifactsHeldBy, bumpRel, deed, ev, houseOf, housesAlive, kill,
  livingFaiths, livingPeople, pName, promoteCommoner, renown, wound,
} from "../world";
import { foundFaith } from "./faith";

export const adversary: System = {
  name: "adversary",
  run(w, rng) {
    const A = w.adversary;
    if (A.kind === "none" || A.defeated) return;

    /* ── THE RIVAL DEITY: a patient, spiteful intelligence ── */
    if (A.kind === "rival-deity") {
      if (!chance(rng, 0.55)) return;
      const move = pick(rng, ["curse", "cult", "corrupt", "champion", "tempt"] as const);
      switch (move) {
        case "curse": {
          const r = w.regions.slice().sort((a, b) => b.prosperity - a.prosperity || (a.id < b.id ? -1 : 1))[0];
          r.prosperity = clamp(r.prosperity - 0.2, 0.05, 1);
          r.devastation = clamp(r.devastation + 0.12, 0, 1);
          ev(w, "adversary", `A shadow passes over ${r.name}: wells sour, milk curdles, dogs will not stop howling. The old folk blame ${A.name}.`,
            { importance: 2, regionId: r.id, divine: true });
          break;
        }
        case "cult": {
          if (!A.cultName && livingFaiths(w).length < 5) {
            const f = foundFaith(w, rng, "doom", null, { posture: "militant", vitality: 0.35 });
            f.creed = "defiant"; f.zeal = 0.8;
            A.cultName = f.name;
            ev(w, "adversary", `In cellars and drowned chapels a new whisper spreads — ${f.name}, who teach that heaven's throne has a second claimant: ${A.name}.`,
              { importance: 3, divine: true, motive: "faith" });
          }
          break;
        }
        case "corrupt": {
          const f = livingFaiths(w).filter((x) => x.name !== A.cultName).sort((a, b) => b.zeal - a.zeal)[0];
          if (f && chance(rng, 0.6)) {
            f.posture = "militant"; f.creed = "defiant"; f.zeal = clamp(f.zeal + 0.2, 0, 1);
            ev(w, "adversary", `Something speaks to the keepers of ${f.name} in their dreams, and their sermons turn to fire and knives.`,
              { importance: 2, divine: true, motive: "faith" });
          }
          break;
        }
        case "champion": {
          if (!A.championId || !w.people[A.championId]?.alive) {
            const houses = housesAlive(w).sort((a, b) => a.prestige - b.prestige || (a.id < b.id ? -1 : 1));
            if (houses.length) {
              const c = promoteCommoner(w, rng, houses[0].id, 22);
              c.prowess = clamp(c.prowess + 0.45, 0, 1); c.guile = clamp(c.guile + 0.35, 0, 1);
              c.drives = { vengeance: 0.5, status: 0.35, freedom: 0.15 };
              c.traits = ["cruel", "bold", "charming"];
              c.wound = "a voice out of the dark that never stops"; c.desire = "to drown the god's works in ash";
              A.championId = c.id;
              deed(w, c, `rose from nothing, marked by ${A.name}`, 0.2);
              ev(w, "adversary", `${pName(w, c)} rises from nothing — too strong, too quick, too lucky. ${A.name} has found a champion.`,
                { importance: 3, actors: [c.id], divine: true });
            }
          }
          break;
        }
        case "tempt": {
          const c = w.chosen && !w.chosen.outcome ? w.people[w.chosen.personId] : null;
          if (c?.alive) {
            const resolve = (c.drives.faith ?? 0) + (c.drives.legacy ?? 0) + (c.traits.includes("just") ? 0.3 : 0);
            if (rng() > resolve + 0.35) {
              c.chosen = false; w.chosen!.outcome = "turned";
              c.drives = { status: 0.5, vengeance: 0.3, wealth: 0.2 };
              ev(w, "adversary", `${A.name} comes to ${pName(w, c)} with a better offer. The god's chosen sets down the charge and walks the other road.`,
                { importance: 3, actors: [c.id], divine: true });
            } else {
              ev(w, "adversary", `In the night, something makes ${pName(w, c)} three promises. All three are refused; the chosen wakes gray-haired but unbowed.`,
                { importance: 2, actors: [c.id], divine: true });
              c.renownBase = clamp(c.renownBase + 0.1, 0, 1.2);
            }
          }
          break;
        }
      }
      return;
    }

    /* ── THE GOD-SLAYER: a mortal climbing toward heaven ── */
    if (A.kind === "god-slayer") {
      let slayer = A.championId ? w.people[A.championId] : null;

      // the slayer emerges from a hard land
      if (!slayer && w.era >= 3) {
        const bitter = housesAlive(w).slice().sort((a, b) => a.prestige - b.prestige || (a.id < b.id ? -1 : 1))[0];
        if (bitter) {
          const s = promoteCommoner(w, rng, bitter.id, 24);
          s.prowess = 0.92; s.guile = 0.8; s.acumen = 0.6; s.zeal = 0;
          s.drives = { freedom: 0.5, vengeance: 0.35, legacy: 0.15 };
          s.traits = ["bold", "skeptic", "vengeful"];
          s.wound = "a family the heavens did not save"; s.woundVs = null;
          s.desire = "to climb to heaven and put out its lights";
          A.championId = s.id; slayer = s;
          deed(w, s, "swore an oath against heaven itself", 0.25);
          ev(w, "godslayer", `${pName(w, s)} buries the last of a family heaven did not save, looks up once, and begins gathering the relics of the god. A god-slayer walks the land.`,
            { importance: 3, actors: [s.id] });
        }
        return;
      }
      if (!slayer) return;
      if (!slayer.alive) {
        A.defeated = true;
        for (const a of artifactsHeldBy(w, slayer.id)) {
          a.holderId = null; a.state = "lost";
          a.lostInRegionId = pick(rng, w.regions).id;
        }
        ev(w, "godslayer", `${slayer.name} is dead, and the relics scatter from dead hands. The climb to heaven ends in the mud, as such climbs do.`,
          { importance: 3, actors: [slayer.id] });
        return;
      }

      A.power = artifactsHeldBy(w, slayer.id).length;

      // hunt relics: lost ones first, then take them from living hands
      const lost = w.artifacts.filter((a) => a.state === "lost").sort((a, b) => b.legend - a.legend || (a.id < b.id ? -1 : 1));
      const heldByOthers = w.artifacts.filter((a) => a.state === "held" && a.holderId !== slayer.id);
      if (lost.length && chance(rng, 0.55)) {
        const a = lost[0];
        a.holderId = slayer.id; a.state = "held"; a.legend += 1.5; a.lostInRegionId = null;
        a.custody.push({ holderId: slayer.id, era: w.era, how: "taken by the god-slayer" });
        ev(w, "godslayer", `${slayer.name} walks out of the wilds carrying ${a.name}. That is ${A.power + 1} of the god's relics in one fist.`,
          { importance: 3, actors: [slayer.id] });
      } else if (heldByOthers.length && chance(rng, 0.4)) {
        const a = heldByOthers.sort((x, y) => y.legend - x.legend || (x.id < y.id ? -1 : 1))[0];
        const holder = w.people[a.holderId!];
        if (holder.avatar) {
          // the slayer comes for the god made flesh
          ev(w, "godslayer", `${slayer.name} finds the god walking in borrowed skin and calls the challenge.`, { importance: 3, actors: [slayer.id, holder.id] });
          if (slayer.prowess * (0.8 + rng() * 0.4) > holder.prowess) {
            a.holderId = slayer.id; a.custody.push({ holderId: slayer.id, era: w.era, how: "torn from the avatar" });
            w.deity.humbled = true;
            ev(w, "godslayer", `The avatar is beaten to its knees and stripped of ${a.name}. The god is not killed — gods are not killed — but every faith in the land felt that blow.`,
              { importance: 3, actors: [slayer.id, holder.id], divine: true });
            for (const f of livingFaiths(w)) { f.creed = chance(rng, 0.5) ? "doubtful" : "fearful"; f.memoryOfGod = clamp(f.memoryOfGod + 0.2, 0, 1); }
          } else {
            kill(w, slayer, `cut down by the god incarnate`);
            ev(w, "godslayer", `The challenge is answered. ${slayer.name} learns, briefly, the difference between a god and a story about one.`,
              { importance: 3, actors: [slayer.id, holder.id], divine: true });
          }
        } else if (slayer.prowess + slayer.guile * 0.5 > renown(w, holder) * (0.9 + rng() * 0.4)) {
          a.holderId = slayer.id; a.custody.push({ holderId: slayer.id, era: w.era, how: "taken by the god-slayer" });
          if (chance(rng, 0.5)) kill(w, holder, `slain by the god-slayer ${slayer.name}`);
          ev(w, "godslayer", `${slayer.name} comes for ${a.name} and takes it${holder.alive ? "" : ` over ${holder.name}'s body`}.`,
            { importance: 3, actors: [slayer.id, holder.id] });
          if (!holder.alive) {
            const h = houseOf(w, holder.houseId);
            if (h) { for (const kid of livingPeople(w)) if (kid.parents.includes(holder.id)) wound(w, kid, `the relic-theft and murder of ${holder.name}`, null); }
          }
        }
      }

      // desecration: holy ground burned to starve heaven of worship
      if (chance(rng, 0.3)) {
        const holy = w.regions.find((r) => r.sacredTo && livingFaiths(w).some((f) => f.name === r.sacredTo));
        if (holy) {
          const f = livingFaiths(w).find((x) => x.name === holy.sacredTo)!;
          f.vitality = clamp(f.vitality - 0.18, 0.05, 1);
          f.creed = "fearful";
          holy.sacredTo = null; holy.devotion = clamp(holy.devotion - 0.3, 0, 1);
          ev(w, "godslayer", `${slayer.name} burns the shrine at ${holy.name} and salts the ground. ${f.name} reels; its keepers preach to smaller crowds, more quietly.`,
            { importance: 2, regionId: holy.id, actors: [slayer.id], motive: "freedom" });
        }
      }

      // the Sundering: with three relics, the slayer strikes at heaven itself
      if (A.power >= 3) {
        ev(w, "godslayer", `On a moonless night ${slayer.name} raises three relics and SUNDERS the sky's voice from the world. Across the land, every prayer comes back unanswered.`,
          { importance: 3, actors: [slayer.id], divine: true });
        for (const f of livingFaiths(w)) { f.memoryOfGod = 0.05; f.creed = "defiant"; f.zeal = clamp(f.zeal + 0.2, 0, 1); }
        w.grace = 0;
        A.power = 0; A.defeated = true;
        for (const a of artifactsHeldBy(w, slayer.id)) { a.state = "destroyed"; a.holderId = null; }
        slayer.renownBase = clamp(slayer.renownBase + 0.5, 0, 1.2);
        deed(w, slayer, "sundered heaven's voice from the world", 0.5);
        ev(w, "godslayer", `The relics are ash in ${slayer.name}'s hands. What was done cannot easily be undone — though the relics, men say, can be reforged.`,
          { importance: 3, actors: [slayer.id] });
        return;
      }

      // mortals push back: the realm's best may hunt the slayer
      const hunter = livingPeople(w).filter((p) => p.id !== slayer.id && !p.avatar && (p.chosen || renown(w, p) > 1.1))
        .sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1))[0];
      if (hunter && A.power >= 1 && chance(rng, 0.3)) {
        ev(w, "godslayer", `${pName(w, hunter)} rides out to end the god-slayer's climb.`, { importance: 2, actors: [hunter.id, slayer.id] });
        if (hunter.prowess * (0.85 + rng() * 0.3) > slayer.prowess * (1 + A.power * 0.12)) {
          kill(w, slayer, `slain in single combat by ${hunter.name}`);
          deed(w, hunter, `slew the god-slayer ${slayer.name}`, 0.3);
          bumpRel(w, hunter.id, slayer.id, { rivalry: 0 });
        } else {
          if (chance(rng, 0.5)) kill(w, hunter, `slain by the god-slayer ${slayer.name}`);
          ev(w, "godslayer", `${hunter.name} ${w.people[hunter.id].alive ? "is beaten bloody and sent home as a message" : "does not come home"}. The climb continues.`,
            { importance: 2, actors: [hunter.id, slayer.id] });
        }
      }
    }
  },
};
