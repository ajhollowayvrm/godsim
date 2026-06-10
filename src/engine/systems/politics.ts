/**
 * Politics: marriages bind houses; seats pass by law or by knife; plots ripen;
 * legitimacy is earned and squandered; factions gather against weak thrones;
 * fallen houses are replaced by rising ones. The Crown sits atop it all.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick } from "../rng";
import type { Person, System, World } from "../types";
import {
  addGrudge, adjStanding, adultsOf, ageOf, bumpRel, deed, ev, grudgeAgainst, houseCulture,
  houseLiving, houseLord, houseOf, housesAlive, kill, livingPeople, monarch, newPerson,
  pName, pickHeirs, promoteCommoner, realmMight, regionsOf, renown, standing, vassalsOf, wound,
} from "../world";
import { houseName } from "../names";

function nextLord(w: World, hid: string, prevLordId: string | null): Person | null {
  const cult = houseCulture(w, houseOf(w, hid)!);
  const candidates = houseLiving(w, hid).filter((p) => !p.exiledFrom);
  if (!candidates.length) return null;
  if (cult.succession === "primogeniture" && prevLordId) {
    const children = candidates.filter((p) => p.parents.includes(prevLordId))
      .sort((a, b) => a.bornEra - b.bornEra || (a.id < b.id ? -1 : 1));
    if (children.length) return children[0];
  }
  return candidates.slice().sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1))[0];
}

export const politics: System = {
  name: "politics",
  run(w, rng) {
    /* ── marriages: proposals become bonds between houses ── */
    const weddedPairs = new Set<string>();
    for (const prop of w.intents.proposals) {
      const a = w.people[prop.aId], b = w.people[prop.bId];
      if (!a?.alive || !b?.alive || a.spouseId || b.spouseId) continue;
      if (standing(w, a.houseId, b.houseId) < -0.3) continue;
      const pairKey = [a.houseId, b.houseId].sort().join("|");
      if (weddedPairs.has(pairKey)) continue; // one wedding binds two houses per age
      weddedPairs.add(pairKey);
      a.spouseId = b.id; b.spouseId = a.id;
      adjStanding(w, a.houseId, b.houseId, 0.35);
      bumpRel(w, a.id, b.id, { affection: 0.5, trust: 0.4 }, "wed");
      bumpRel(w, b.id, a.id, { affection: 0.5, trust: 0.4 }, "wed");
      const big = houseLord(w, a.houseId)?.id === a.id || houseLord(w, b.houseId)?.id === b.id;
      ev(w, "marriage", `A marriage binds House ${houseOf(w, a.houseId)!.name} and House ${houseOf(w, b.houseId)!.name} — ${a.name} weds ${b.name}.`,
        { importance: big ? 2 : 1, actors: [a.id, b.id], houses: [a.houseId, b.houseId], motive: "love" });
    }

    /* ── house lordships: succession by law, or extinction ── */
    for (const h of housesAlive(w)) {
      const seat = w.offices["lord_" + h.id];
      const holder = w.people[seat.holderId ?? ""];
      if (holder?.alive) continue;
      const heir = nextLord(w, h.id, seat.holderId);
      if (heir) {
        const cult = houseCulture(w, h);
        seat.holderId = heir.id;
        const how = cult.succession === "elective" ? "is raised by the elders to" : holder ? "inherits" : "claims";
        ev(w, "succession", `${heir.name} of House ${h.name} ${how} the seat of ${h.seat}.`,
          { importance: 1, actors: [heir.id], houses: [h.id] });
        // a passed-over rival of the blood remembers
        const passed = houseLiving(w, h.id).filter((p) => p.id !== heir.id && renown(w, p) > renown(w, heir) * 0.95)
          .sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1))[0];
        if (passed && chance(rng, 0.5)) {
          bumpRel(w, passed.id, heir.id, { rivalry: 0.45, affection: -0.25 }, "passed over for the seat");
        }
      } else seat.holderId = null;
    }

    /* ── extinction and the rise of new blood ── */
    for (const h of w.houses) {
      if (h.fallenEra || houseLiving(w, h.id).length) continue;
      h.fallenEra = w.era;
      const lands = regionsOf(w, h.id);
      ev(w, "extinction", `House ${h.name} fails — no heir remains to hold ${h.seat}. The line passes into legend.`,
        { importance: 3, houses: [h.id] });
      const rich = lands.filter((r) => r.prosperity > 0.5);
      if (rich.length && w.houses.length < 16 && chance(rng, 0.65)) {
        // the stewards rise: a new house from the masses
        const seatR = rich.sort((a, b) => b.prosperity - a.prosperity || (a.id < b.id ? -1 : 1))[0];
        const cult = w.cultures.find((c) => c.key === seatR.cultureKey)!;
        const used = new Set(w.houses.map((x) => x.name));
        const nh = {
          ...h,
          id: "h" + w.houses.length, name: houseName(rng, cult, used),
          seatRegionId: seatR.id, seat: seatR.name, culture: cult.key, hair: pick(rng, cult.hair),
          holdings: 0, overlordId: null, loyalty: 1,
          treasury: { food: 1, wealth: 2, manpower: 1 },
          prestige: 0.1, grudges: [], foundedEra: w.era, fallenEra: null,
          color: ["#c9a24b", "#b24432", "#7fb0c9", "#7d9a5a", "#a06fb0", "#c97f4b", "#5a8d9a", "#b04f6f", "#8a8d4a", "#6f7db0", "#9a6a4a", "#4ba07f", "#b09a3a", "#7a5ab0", "#b0683a", "#3a8ab0"][w.houses.length % 16],
          warWeary: 0,
        };
        w.houses.push(nh);
        for (const r of lands) r.ownerId = nh.id;
        nh.holdings = lands.length;
        const founder = promoteCommoner(w, rng, nh.id, 35);
        const kin = promoteCommoner(w, rng, nh.id, 28);
        bumpRel(w, founder.id, kin.id, { affection: 0.4, trust: 0.4 }, "kin");
        w.offices["lord_" + nh.id] = { id: "lord_" + nh.id, title: `Lord of ${nh.seat}`, scope: "domain", houseId: nh.id, holderId: founder.id, hereditary: true };
        deed(w, founder, `raised House ${nh.name} from the stewardship of ${seatR.name}`, 0.15);
        ev(w, "founding", `From the stewards of ${seatR.name}, a new line rises: ${founder.name} is acclaimed first lord of House ${nh.name}.`,
          { importance: 3, actors: [founder.id], houses: [nh.id], motive: "status" });
      } else {
        for (const r of lands) {
          const neighbors = r.neighbors.map((id) => w.regions.find((x) => x.id === id)!)
            .map((n) => n.ownerId).filter((o): o is string => !!o && o !== h.id && !houseOf(w, o)!.fallenEra);
          r.ownerId = neighbors.length ? neighbors.sort()[0] : null;
        }
      }
      for (const v of vassalsOf(w, h.id)) { v.overlordId = null; v.loyalty = 1; }
    }

    /* ── peasant revolt: misery has a breaking point ── */
    for (const r of w.regions) {
      if (r.ownerId && r.famine && r.prosperity < 0.25 && chance(rng, 0.3)) {
        const owner = houseOf(w, r.ownerId)!;
        r.devastation = clamp(r.devastation + 0.15, 0, 1);
        owner.treasury.wealth = clamp(owner.treasury.wealth - 1, -4, 30);
        ev(w, "revolt", `The starving of ${r.name} rise with scythe and torch against House ${owner.name}.`,
          { importance: 2, regionId: r.id, houses: [owner.id], motive: "security" });
        if (w.crown.houseId === owner.id) w.crown.legitimacy = clamp(w.crown.legitimacy - 0.07, 0, 1);
      }
    }

    /* ── the Crown ── */
    if (!w.crown.houseId) {
      if (w.era >= 2) {
        const lords = housesAlive(w).map((h) => houseLord(w, h.id)).filter((p): p is Person => !!p)
          .sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1));
        if (lords.length) {
          const k = lords[0];
          Object.assign(w.crown, { houseId: k.houseId, holderId: k.id, legitimacy: 0.55, since: w.era });
          deed(w, k, "was crowned first sovereign of the realm", 0.2);
          ev(w, "coronation", `House ${houseOf(w, k.houseId)!.name} ascends: ${k.name} is crowned first sovereign of the realm.`,
            { importance: 3, actors: [k.id], houses: [k.houseId], motive: "status" });
        }
      }
    } else {
      let m = monarch(w);
      if (!m?.alive) {
        const claimants = livingPeople(w).filter((p) => p.claims.includes(w.crown.houseId!) && !p.exiledFrom)
          .sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1));
        const heir = claimants[0];
        if (!heir) {
          Object.assign(w.crown, { houseId: null, holderId: null, stateFaithId: null });
          ev(w, "interregnum", `The Crown falls vacant — no claimant remains. The realm enters interregnum.`, { importance: 3 });
        } else {
          const death = m ? "" : " long-empty";
          w.crown.holderId = heir.id; w.crown.houseId = heir.houseId; w.crown.since = w.era;
          if (ageOf(heir, w.era) < 16) {
            const regent = adultsOf(w, heir.houseId).sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1))[0];
            w.crown.legitimacy = clamp(w.crown.legitimacy - 0.12, 0, 1);
            ev(w, "succession", `${heir.name} of House ${houseOf(w, heir.houseId)!.name} inherits the${death} Crown a child; ${regent ? regent.name + " rules as regent" : "the realm wavers without a regent"}.`,
              { importance: 2, actors: [heir.id, ...(regent ? [regent.id] : [])], houses: [heir.houseId] });
          } else {
            w.crown.legitimacy = 0.55;
            ev(w, "succession", `${heir.name} of House ${houseOf(w, heir.houseId)!.name} inherits the Crown.`,
              { importance: 2, actors: [heir.id], houses: [heir.houseId] });
          }
          const rival = claimants.find((c) => c.houseId !== heir.houseId && renown(w, c) > renown(w, heir) * 0.8);
          if (rival) {
            w.crown.legitimacy = clamp(w.crown.legitimacy - 0.15, 0, 1);
            bumpRel(w, rival.id, heir.id, { rivalry: 0.5, affection: -0.3 }, "disputed succession");
            ev(w, "dispute", `${pName(w, rival)} disputes the succession — the realm holds its breath.`,
              { importance: 2, actors: [rival.id, heir.id], motive: "status" });
          }
          m = heir;
        }
      }

      if (m) {
        /* legitimacy breathes with the material world */
        const royal = regionsOf(w, m.houseId);
        let drift = (0.5 - w.crown.legitimacy) * 0.1;
        if (royal.length) {
          const avgProsp = royal.reduce((s, r) => s + r.prosperity, 0) / royal.length;
          drift += (avgProsp - 0.45) * 0.08;
          if (royal.some((r) => r.famine)) drift -= 0.05;
        }
        if (w.crown.stateFaithId && w.faiths.find((f) => f.id === w.crown.stateFaithId && !f.dissolvedEra)) drift += 0.04;
        w.crown.legitimacy = clamp(w.crown.legitimacy + drift, 0, 1);

        /* factions gather against a weak throne */
        if (w.crown.legitimacy < 0.38) {
          const malcontents = housesAlive(w).filter((h) =>
            h.id !== w.crown.houseId &&
            (standing(w, h.id, w.crown.houseId!) < -0.1 || grudgeAgainst(w, h.id, w.crown.houseId!) > 0.4));
          const leader = malcontents.sort((a, b) => realmMight(w, b.id) - realmMight(w, a.id) || (a.id < b.id ? -1 : 1))[0];
          if (leader && realmMight(w, leader.id) > realmMight(w, w.crown.houseId!) * 0.85 && chance(rng, 0.5)) {
            const claimant = houseLord(w, leader.id);
            if (claimant) {
              w.intents.wars.push({
                houseId: leader.id, targetId: w.crown.houseId!, byId: claimant.id,
                aim: { kind: "throne", claimantId: claimant.id, label: "to take the Crown itself" },
              });
            }
          }
        }
      }
    }

    /* ── plots ripen in the dark ── */
    for (const plot of w.plots.slice()) {
      const plotter = w.people[plot.plotterId], target = w.people[plot.targetId];
      if (!plotter?.alive || !target?.alive) { w.plots.splice(w.plots.indexOf(plot), 1); continue; }
      if (plotter.lastAction !== "scheme") plot.progress = clamp(plot.progress - 0.1, 0, 1);
      if (plot.progress < 0.7) continue;
      // the knife is out
      const isMonarch = w.crown.holderId === target.id;
      let protection = renown(w, target) * 0.5
        + (isMonarch ? w.crown.legitimacy * 0.4 : 0.15)
        + (target.traits.includes("paranoid") ? 0.25 : 0)
        + (w.artifacts.some((a) => a.holderId === target.id && a.power === "dread" && a.state === "held") ? 0.3 : 0);
      const attack = plotter.guile + (plotter.drives.vengeance ?? 0) * 0.3;
      w.plots.splice(w.plots.indexOf(plot), 1);
      if (attack > protection * (0.8 + rng() * 0.5)) {
        if (plot.kind === "coup" && isMonarch) {
          ev(w, "coup", `${pName(w, plotter)} marshals the court and forces ${target.name} to abdicate — a crown changes heads without a sword drawn.`,
            { importance: 3, actors: [plotter.id, target.id], motive: plot.motive, houses: [plotter.houseId, target.houseId] });
          w.crown.holderId = plotter.id; w.crown.houseId = plotter.houseId; w.crown.legitimacy = 0.35; w.crown.since = w.era;
          deed(w, plotter, `took the Crown by coup from ${target.name}`, 0.15);
          addGrudge(w, target.houseId, plotter.houseId, 0.7, `the stolen Crown of ${target.name}`);
        } else {
          kill(w, target, `poison, whispered to be the work of ${plotter.name} by h${plotter.houseId.slice(1)}`);
          const eid = ev(w, "murder", `${pName(w, target)} is found dead — poison in the cup — and every eye turns to ${pName(w, plotter)}.`,
            { importance: 3, actors: [plotter.id, target.id], motive: plot.motive, houses: [plotter.houseId, target.houseId] });
          deed(w, plotter, `was whispered to have poisoned ${target.name}`, 0.05);
          addGrudge(w, target.houseId, plotter.houseId, 0.8, `the murder of ${target.name}`);
          if (isMonarch && (plotter.claims.includes(w.crown.houseId!) || (plotter.drives.status ?? 0) > 0.5)) {
            w.crown.holderId = plotter.id; w.crown.houseId = plotter.houseId; w.crown.legitimacy = 0.3; w.crown.since = w.era;
            ev(w, "usurpation", `In the confusion ${plotter.name} seizes the Crown — a throne taken by stealth, not by right.`,
              { importance: 3, actors: [plotter.id], causedBy: [eid], motive: "status" });
          }
        }
      } else {
        ev(w, "exposure", `A plot against ${pName(w, target)} is uncovered; ${pName(w, plotter)} is ${chance(rng, 0.5) ? "executed before the gates" : "cast into exile"}.`,
          { importance: 2, actors: [plotter.id, target.id], motive: plot.motive });
        if (chance(rng, 0.5)) kill(w, plotter, `executed for treason by h${target.houseId.slice(1)}`);
        else { plotter.exiledFrom = plotter.houseId; }
        addGrudge(w, plotter.houseId, target.houseId, 0.4, `the disgrace of ${plotter.name}`);
        if (isMonarch) w.crown.legitimacy = clamp(w.crown.legitimacy + 0.05, 0, 1);
      }
    }

    /* ── the High Captaincy: renown holds it, ambition takes it ── */
    const cap = w.offices["captain"];
    const field = livingPeople(w).filter((p) => ageOf(p, w.era) >= 20 && !p.avatar)
      .sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1));
    if (field.length) {
      const top = field[0]; const holder = w.people[cap.holderId ?? ""];
      if (!holder?.alive) {
        cap.holderId = top.id;
        ev(w, "office", `${pName(w, top)} is acclaimed High Captain of the Realm.`, { importance: 1, actors: [top.id] });
      } else if (top.id !== holder.id && renown(w, top) > renown(w, holder) * 1.15 && (top.drives.status ?? 0) > 0.3 && chance(rng, 0.6)) {
        cap.holderId = top.id;
        bumpRel(w, holder.id, top.id, { rivalry: 0.4, affection: -0.3 }, "cast down from the captaincy");
        ev(w, "office", `${pName(w, top)} casts down ${holder.name} and takes the High Captaincy.`, { importance: 1, actors: [top.id, holder.id], motive: "status" });
      }
    }

    /* ── empire bookkeeping ── */
    const prev = w.empireHouseId;
    const imperial = housesAlive(w).find((h) => vassalsOf(w, h.id).length >= 2 || (regionsOf(w, h.id).length >= 8 && w.crown.houseId === h.id));
    w.empireHouseId = imperial?.id ?? null;
    if (w.empireHouseId && w.empireHouseId !== prev)
      ev(w, "empire", `House ${houseOf(w, w.empireHouseId)!.name} now bestrides the land — men begin to speak of the ${houseOf(w, w.empireHouseId)!.name} Empire.`,
        { importance: 3, houses: [w.empireHouseId] });
  },
};
