/**
 * Artifacts: relics are persistent protagonists. They pass hand to hand, compel
 * their bearers, are lost and quested after, gather cults, and can be reforged.
 * Their legend has a life of its own — held or lost.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { Artifact, System, World } from "../types";
import {
  ageOf, artifactsHeldBy, bumpRel, deed, ev, houseLiving, houseOf, livingFaiths,
  livingPeople, monarch, pName, regionsOf, renown,
} from "../world";
import { foundFaith } from "./faith";

function loseArtifact(w: World, a: Artifact, regionId: string | null, why: string) {
  a.holderId = null; a.state = "lost";
  a.lostInRegionId = regionId ?? a.lostInRegionId ?? w.regions[0].id;
  ev(w, "relic", `${a.name} ${why} — lost to the world, its legend left to swell in the telling.`, { importance: 2, regionId: a.lostInRegionId });
}

export const artifacts: System = {
  name: "artifacts",
  run(w, rng) {
    for (const a of w.artifacts) {
      if (a.state === "destroyed" || a.state === "sealed") continue;

      /* the bearer dies: the relic seeks kin, or slips away */
      const bearer = a.holderId ? w.people[a.holderId] : null;
      if (a.state === "held" && (!bearer || !bearer.alive)) {
        const houseId = bearer?.houseId ?? null;
        const kin = houseId ? houseLiving(w, houseId).filter((p) => ageOf(p, w.era) >= 16)
          .sort((x, y) => (y.hair === a.attune ? 1 : 0) - (x.hair === a.attune ? 1 : 0) || renown(w, y) - renown(w, x) || (x.id < y.id ? -1 : 1)) : [];
        if (kin.length && chance(rng, 0.8)) {
          const heir = kin[0];
          a.holderId = heir.id; a.legend += 1;
          a.custody.push({ holderId: heir.id, era: w.era, how: "inherited" });
          const knew = heir.hair === a.attune ? ` — and they say the relic knew its own, the bearer being ${a.attune}-haired` : "";
          ev(w, "relic", `${pName(w, heir)} takes up ${a.name}${knew}.`, { importance: 2, actors: [heir.id] });
        } else {
          const seat = houseId ? houseOf(w, houseId)?.seatRegionId ?? null : null;
          loseArtifact(w, a, seat, "passes out of mortal hands, its bearer dead, its house spent");
        }
      }

      if (a.state === "lost") {
        a.legend += 0.4;
        /* the relic's will reaches out for a worthy hand */
        if (chance(rng, a.will * 0.25)) {
          const region = w.regions.find((r) => r.id === a.lostInRegionId);
          const local = livingPeople(w).filter((p) => ageOf(p, w.era) >= 18 && region?.ownerId === p.houseId)
            .sort((x, y) => renown(w, y) - renown(w, x) || (x.id < y.id ? -1 : 1));
          if (local.length) {
            const found = local[0];
            a.holderId = found.id; a.state = "held"; a.legend += 1; a.lostInRegionId = null;
            a.custody.push({ holderId: found.id, era: w.era, how: "found" });
            deed(w, found, `drew ${a.name} from where it lay`, 0.12);
            ev(w, "relic", `${pName(w, found)} draws ${a.name} from where it lay in ${region?.name ?? "the wilds"}.`,
              { importance: 2, actors: [found.id], regionId: region?.id });
          }
        } else if (chance(rng, 0.12)) {
          ev(w, "rumor", `Pretenders quarrel over where ${a.name} is said to lie; none return the wiser.`, { importance: 1 });
        }
      }

      /* passive powers shape the world around a held relic */
      if (a.state === "held" && bearer?.alive) {
        const house = houseOf(w, bearer.houseId);
        switch (a.power) {
          case "plenty":
            if (house) for (const r of regionsOf(w, house.id)) r.prosperity = clamp(r.prosperity + 0.015, 0, 1);
            break;
          case "grace":
            w.grace = clamp(w.grace + 0.06, 0, 1.5);
            break;
          case "crown":
            if (w.crown.holderId === bearer.id) { w.crown.legitimacy = clamp(w.crown.legitimacy + 0.04, 0, 1); a.legend += 0.4; }
            break;
          case "dread":
            for (const r of w.rels) if (r.to === bearer.id && r.affection > -0.5 && chance(rng, 0.1)) r.affection = clamp(r.affection - 0.05, -1, 1);
            break;
          default: break;
        }
        /* a willful relic bends its bearer's wants */
        if (a.will > 0.5 && chance(rng, 0.25)) {
          const d = a.wants.includes("ruin") ? "vengeance" : a.wants.includes("sung") ? "status" : a.wants.includes("god") ? "faith" : "legacy";
          bearer.drives[d as keyof typeof bearer.drives] = clamp((bearer.drives[d as keyof typeof bearer.drives] ?? 0) + 0.08, 0, 1);
        }
      }
    }

    /* quests: seekers ride for the lost relics */
    for (const q of w.intents.quests) {
      const p = w.people[q.personId];
      const a = w.artifacts.find((x) => x.id === q.artifactId);
      if (!p?.alive || !a || a.state !== "lost") continue;
      const region = w.regions.find((r) => r.id === a.lostInRegionId);
      const hard = region ? (region.terrain === "mountain" || region.terrain === "marsh" ? 0.25 : 0.1) : 0.15;
      const worthy = a.wants === "a worthy hand" ? renown(w, p) * 0.2 : 0;
      const affinity = p.hair === a.attune ? 0.2 : 0;
      if (chance(rng, clamp(0.25 + p.prowess * 0.25 + affinity + worthy - hard, 0.05, 0.85))) {
        a.holderId = p.id; a.state = "held"; a.legend += 2; a.lostInRegionId = null;
        a.custody.push({ holderId: p.id, era: w.era, how: "won by quest" });
        deed(w, p, `quested into ${region?.name ?? "the wilds"} and returned bearing ${a.name}`, 0.18);
        ev(w, "quest", `${pName(w, p)} rides into ${region?.name ?? "the wilds"} and returns bearing ${a.name}${p.hair === a.attune ? " — the relic singing in a hand it knows" : ""}.`,
          { importance: 3, actors: [p.id], regionId: region?.id, motive: "legacy" });
      } else if (chance(rng, 0.12)) {
        ev(w, "quest", `${pName(w, p)} seeks ${a.name} in ${region?.name ?? "the wilds"} and comes home empty-handed, older and stranger.`,
          { importance: 1, actors: [p.id], motive: "legacy" });
      }
    }

    /* legends gather worship: a great relic breeds a cult */
    for (const a of w.artifacts) {
      if (a.state === "destroyed") continue;
      if (a.legend > 14 && livingFaiths(w).length < 5 && !w.faiths.some((f) => f.focus === "relic" && f.name.includes(a.name.replace(/^the /, "").split(" of ")[0])) && chance(rng, 0.2)) {
        const devotee = livingPeople(w).filter((p) => p.zeal > 0.6).sort((x, y) => y.zeal - x.zeal || (x.id < y.id ? -1 : 1))[0] ?? null;
        const f = foundFaith(w, rng, "relic", devotee?.id ?? null, { homeRegionId: a.lostInRegionId });
        ev(w, "founding-faith", `The legend of ${a.name} outgrows the halls that tell it: ${f.name} forms to worship the relic itself.`,
          { importance: 3, motive: "faith" });
      }
    }

    /* a hoard draws covetous eyes */
    for (const p of livingPeople(w)) {
      const held = artifactsHeldBy(w, p.id);
      if (held.length >= 2 && chance(rng, 0.3)) {
        const rivals = livingPeople(w).filter((x) => x.id !== p.id && (x.drives.status ?? 0) > 0.4 && x.guile > 0.5)
          .sort((x, y) => y.guile - x.guile || (x.id < y.id ? -1 : 1));
        if (rivals.length) {
          bumpRel(w, rivals[0].id, p.id, { rivalry: 0.3 }, `covets the hoard of relics`);
          ev(w, "rumor", `${pName(w, p)} holds ${held.map((x) => x.name).join(" and ")} — and covetous eyes follow them through every hall.`,
            { importance: 1, actors: [p.id, rivals[0].id] });
        }
      }
    }

    /* the broken can be made new: reforging */
    for (const a of w.artifacts) {
      if (a.state !== "destroyed") continue;
      const smithHouse = w.houses.find((h) => !h.fallenEra && houseLiving(w, h.id).some((p) => p.acumen > 0.7)
        && w.cultures.find((c) => c.key === h.culture)?.tech.metallurgy
        && regionsOf(w, h.id).some((r) => (r.output.ore ?? 0) > 1));
      if (smithHouse && chance(rng, 0.15)) {
        const smith = houseLiving(w, smithHouse.id).filter((p) => p.acumen > 0.7).sort((x, y) => y.acumen - x.acumen || (x.id < y.id ? -1 : 1))[0];
        a.state = "held"; a.holderId = smith.id;
        a.name = a.name + " Reforged"; a.legend = Math.max(3, a.legend * 0.5);
        a.wants = pick(rng, ["a worthy hand", "to be sung of in every hall", "ruin upon the proud"]);
        a.custody.push({ holderId: smith.id, era: w.era, how: "reforged" });
        deed(w, smith, `reforged ${a.name}`, 0.15);
        ev(w, "relic", `In the forges of House ${smithHouse.name}, ${smith.name} reforges the shattered relic: ${a.name} wakes again, changed.`,
          { importance: 3, actors: [smith.id], houses: [smithHouse.id] });
      }
    }

    /* a monarch crowned with the crown-relic is a sight remembered */
    const m = monarch(w);
    if (m) {
      const crownRelic = artifactsHeldBy(w, m.id).find((x) => x.power === "crown");
      if (crownRelic && chance(rng, 0.15))
        ev(w, "omen", `${m.name} sits in judgment with ${crownRelic.name} at hand; even enemies lower their voices.`, { importance: 1, actors: [m.id] });
    }
  },
};
