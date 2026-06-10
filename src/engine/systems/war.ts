/**
 * War: every war has an AIM born from somebody's want — land, grain, grudge,
 * freedom, the throne, the favor of heaven. Campaigns are fought over the map
 * (border fronts), cost treasure and blood, and end in conquest, vassalage,
 * white peace or ruin. Losers remember.
 */
import type { RNG } from "../rng";
import { chance, clamp } from "../rng";
import type { House, Person, System, War, World } from "../types";
import {
  addGrudge, adjStanding, adultsOf, alliesOf, deed, ev, faithById, houseAlive, houseLevy,
  houseOf, housesAlive, inTruce, kill, livingPeople, pName, realmMight, regionOf,
  regionsOf, renown, setTruce, standing, vassalsOf,
} from "../world";

function commander(w: World, hid: string): Person | null {
  return adultsOf(w, hid).slice().sort((a, b) => renown(w, b) - renown(w, a) || (a.id < b.id ? -1 : 1))[0] ?? null;
}

function frontRegion(w: World, att: string, def: string, preferred?: string | null) {
  if (preferred) {
    const r = regionOf(w, preferred);
    if (r && r.ownerId === def) return r;
  }
  return regionsOf(w, def)
    .filter((r) => r.neighbors.some((nid) => regionOf(w, nid)!.ownerId === att))
    .sort((a, b) => b.prosperity - a.prosperity || (a.id < b.id ? -1 : 1))[0]
    ?? regionsOf(w, def).sort((a, b) => (a.id < b.id ? -1 : 1))[0] ?? null;
}

function transferRegion(w: World, r: { id: string; ownerId: string | null; devastation: number; name: string }, to: string) {
  const from = r.ownerId;
  r.ownerId = to;
  const fh = from ? houseOf(w, from) : null, th = houseOf(w, to);
  if (fh) fh.holdings = regionsOf(w, fh.id).length;
  if (th) th.holdings = regionsOf(w, th.id).length;
}

export const war: System = {
  name: "war",
  run(w, rng) {
    /* vassal loyalty breathes; weariness heals in peace */
    for (const h of housesAlive(w)) {
      const atWar = w.wars.some((x) => !x.over && (x.attackerId === h.id || x.defenderId === h.id));
      if (!atWar) h.warWeary = clamp(h.warWeary - 0.15, 0, 1);
      if (h.overlordId) {
        const drift = standing(w, h.id, h.overlordId) > 0.3 ? 0.04 : -0.07;
        h.loyalty = clamp(h.loyalty + drift, 0, 1);
      }
    }

    /* fear of the hegemon: coalitions gather against an empire */
    if (w.empireHouseId && houseAlive(w, w.empireHouseId)) {
      const emp = houseOf(w, w.empireHouseId)!;
      const big = regionsOf(w, emp.id).length >= 8 || vassalsOf(w, emp.id).length >= 3;
      const alreadyFighting = w.wars.some((x) => !x.over && x.defenderId === emp.id);
      if (big && !alreadyFighting && chance(rng, 0.25)) {
        const free = housesAlive(w).filter((h) => h.id !== emp.id && h.overlordId !== emp.id && standing(w, h.id, emp.id) < 0.2);
        const leader = free.sort((a, b) => realmMight(w, b.id) - realmMight(w, a.id) || (a.id < b.id ? -1 : 1))[0];
        if (leader && realmMight(w, leader.id) > realmMight(w, emp.id) * 0.45) {
          for (const o of free) if (o.id !== leader.id) adjStanding(w, leader.id, o.id, 0.3);
          const cmd = commander(w, leader.id);
          w.intents.wars.push({
            houseId: leader.id, targetId: emp.id, byId: cmd?.id ?? "",
            aim: { kind: "coalition", label: `to break the ${emp.name} Empire before it swallows all` },
          });
        }
      }
    }

    /* declarations: intents become wars */
    for (const intent of w.intents.wars) {
      const att = houseOf(w, intent.houseId), def = houseOf(w, intent.targetId);
      if (!att || !def || !houseAlive(w, att.id) || !houseAlive(w, def.id)) continue;
      if (w.wars.some((x) => !x.over && ((x.attackerId === att.id && x.defenderId === def.id) || (x.attackerId === def.id && x.defenderId === att.id)))) continue;
      // truces hold, except for risings and wars for the throne
      if (inTruce(w, att.id, def.id) && !["independence", "throne", "coalition"].includes(intent.aim.kind)) continue;
      const war: War = {
        id: "w" + (w.seq.war = (w.seq.war || 0) + 1),
        attackerId: att.id, defenderId: def.id,
        attackerAllies: alliesOf(w, att.id), defenderAllies: alliesOf(w, def.id),
        aim: intent.aim, startEra: w.era, exhaustionA: 0, exhaustionD: 0, score: 0, over: false,
        causedBy: intent.causedBy,
      };
      w.wars.push(war);
      const by = w.people[intent.byId];
      const verb = intent.aim.kind === "independence" ? "rises against" : intent.aim.kind === "coalition" ? "leads a great coalition against" : "wages war upon";
      ev(w, "war", `House ${att.name} ${verb} House ${def.name} — ${intent.aim.label}.`,
        { importance: 3, houses: [att.id, def.id], actors: by ? [by.id] : [], motive: intent.aim.kind, causedBy: intent.causedBy });
      adjStanding(w, att.id, def.id, -0.5);
    }
    w.intents.wars.length = 0; // consumed — intents pushed by later phases survive to next era

    /* campaigns: each living war fights a season */
    for (const x of w.wars) {
      if (x.over) continue;
      const att = houseOf(w, x.attackerId)!, def = houseOf(w, x.defenderId)!;
      if (!houseAlive(w, att.id) || !houseAlive(w, def.id)) { x.over = true; continue; }

      const front = frontRegion(w, att.id, def.id, x.aim.regionId);
      const cmdA = commander(w, att.id), cmdD = commander(w, def.id);
      let sA = realmMight(w, att.id) * (0.85 + rng() * 0.3) * (1 - att.warWeary * 0.3);
      let sD = realmMight(w, def.id) * (0.85 + rng() * 0.3) * (1 - def.warWeary * 0.3) * 1.15; // home ground
      if (front && front.improvements > 0) sD *= 1 + front.improvements * 0.07;          // walls hold
      // a vassal's overlord owes the sword (except against itself)
      const suzerain = def.overlordId && def.overlordId !== att.id ? houseOf(w, def.overlordId) : null;
      if (suzerain && !suzerain.fallenEra && x.aim.kind !== "independence") sD += houseLevy(w, suzerain.id) * 0.4;
      if (w.crown.houseId === att.id) sA *= 1 + w.crown.legitimacy * 0.15;
      if (w.crown.houseId === def.id) sD *= 1 + w.crown.legitimacy * 0.15;
      if (cmdA) sA *= 1 + cmdA.prowess * 0.25;
      if (cmdD) sD *= 1 + cmdD.prowess * 0.25;

      const attackerWins = sA > sD;
      const decisive = Math.max(sA, sD) > Math.min(sA, sD) * 1.5;
      x.score += (attackerWins ? 1 : -1) * (decisive ? 2 : 1);
      x.exhaustionA += 0.3; x.exhaustionD += 0.3;
      att.warWeary = clamp(att.warWeary + 0.15, 0, 1);
      def.warWeary = clamp(def.warWeary + 0.15, 0, 1);
      att.treasury.manpower = clamp(att.treasury.manpower - 1, 0, 8);
      def.treasury.manpower = clamp(def.treasury.manpower - 1, 0, 8);

      if (front) {
        front.devastation = clamp(front.devastation + 0.25, 0, 1);
        front.population = Math.max(1, Math.round(front.population * 0.92 * 10) / 10);
        const winner = attackerWins ? att : def, loser = attackerWins ? def : att;
        const loserCmd = attackerWins ? cmdD : cmdA, winCmd = attackerWins ? cmdA : cmdD;
        const relic = winCmd ? w.artifacts.find((a) => a.holderId === winCmd.id && a.power === "war" && a.state === "held") : null;
        ev(w, "battle", `At ${front.name}, the host of House ${winner.name}${winCmd ? ` under ${winCmd.name}` : ""} breaks House ${loser.name}'s line${relic ? `, ${relic.name} red to the hilt` : ""}; the land is put to the torch.`,
          { importance: 2, regionId: front.id, houses: [att.id, def.id], actors: [winCmd?.id ?? "", loserCmd?.id ?? ""].filter(Boolean) });
        if (relic) { relic.legend += 1.5; }
        if (winCmd) deed(w, winCmd, `carried the field at ${front.name}`, 0.08);
        if (loserCmd && chance(rng, 0.22)) {
          kill(w, loserCmd, `slain in battle at ${front.name} by ${winner.id}`);
          ev(w, "death", `${pName(w, loserCmd)} falls at ${front.name}, sword in hand.`, { importance: 2, actors: [loserCmd.id], regionId: front.id });
        } else if (winCmd && chance(rng, 0.06)) {
          kill(w, winCmd, `mortally wounded in victory at ${front.name} by ${(attackerWins ? def : att).id}`);
          ev(w, "death", `${pName(w, winCmd)} wins the day at ${front.name} and dies of it before the moon turns.`, { importance: 2, actors: [winCmd.id], regionId: front.id });
        }
      }

      /* a war with no one left to fight it simply ends */
      if (!houseAlive(w, att.id) || !houseAlive(w, def.id)) {
        x.over = true;
        const gone = !houseAlive(w, att.id) ? att : def;
        ev(w, "peace", `The war between House ${att.name} and House ${def.name} ends for the bleakest of reasons: House ${gone.name} has no one left to fight it.`,
          { importance: 2, houses: [att.id, def.id] });
        setTruce(w, att.id, def.id, w.era + 2);
        continue;
      }

      /* does the war end? */
      const duration = w.era - x.startEra;
      const exhausted = att.warWeary >= 0.85 || def.warWeary >= 0.85 || duration >= 3;
      let result: "attacker" | "defender" | "white" | null = null;
      if (x.score >= (x.aim.kind === "raid" ? 1 : 2)) result = "attacker";
      else if (x.score <= -2) result = "defender";
      else if (exhausted) result = "white";
      if (!result) continue;
      x.over = true;

      if (result === "attacker") {
        switch (x.aim.kind) {
          case "raid": {
            const loot = Math.min(def.treasury.wealth, 3);
            def.treasury.wealth -= loot; att.treasury.wealth = clamp(att.treasury.wealth + loot + 1, -4, 30);
            ev(w, "peace", `House ${att.name} rides home from House ${def.name}'s lands heavy with plunder.`, { importance: 2, houses: [att.id, def.id] });
            addGrudge(w, def.id, att.id, 0.5, `the great raid of era ${w.era}`);
            break;
          }
          case "independence": {
            att.overlordId = null; att.loyalty = 1;
            ev(w, "liberation", `House ${att.name} throws off its chains and stands free of House ${def.name}.`,
              { importance: 3, houses: [att.id, def.id], motive: "freedom" });
            addGrudge(w, def.id, att.id, 0.5, `the defection of House ${att.name}`);
            break;
          }
          case "throne": {
            const claimant = w.people[x.aim.claimantId ?? ""] ?? commander(w, att.id);
            const old = w.people[w.crown.holderId ?? ""];
            if (claimant?.alive) {
              Object.assign(w.crown, { houseId: att.id, holderId: claimant.id, legitimacy: 0.42, stateFaithId: null, since: w.era });
              deed(w, claimant, `took the Crown by force of arms`, 0.2);
              ev(w, "usurpation", `The war is won: ${pName(w, claimant)} ${old?.alive ? `casts down ${old.name} and ` : ""}takes the Crown by right of conquest.`,
                { importance: 3, actors: [claimant.id], houses: [att.id, def.id], motive: "status" });
              addGrudge(w, def.id, att.id, 1, "the stolen Crown");
            }
            break;
          }
          case "coalition": {
            const freed = vassalsOf(w, def.id);
            for (const v of freed) { v.overlordId = null; v.loyalty = 1; }
            const spoils = regionsOf(w, def.id).filter((r) => r.id !== def.seatRegionId).slice(0, 2);
            for (const r of spoils) transferRegion(w, r, att.id);
            w.empireHouseId = null;
            ev(w, "peace", `The coalition prevails: the ${def.name} Empire is broken, its vassals freed, its marches stripped.`,
              { importance: 3, houses: [att.id, def.id] });
            const liberator = w.people[x.aim.claimantId ?? ""];
            if (liberator?.alive && w.crown.houseId === def.id) {
              Object.assign(w.crown, { houseId: liberator.houseId, holderId: liberator.id, legitimacy: 0.7, stateFaithId: null, since: w.era });
              deed(w, liberator, `cast down the ${def.name} Empire and took the Crown`, 0.25);
              ev(w, "coronation", `${pName(w, liberator)} takes the Crown from the wreck of the Empire — the word made flesh.`,
                { importance: 3, actors: [liberator.id], motive: "legacy" });
              if (w.chosen?.personId === liberator.id) { w.chosen.outcome = "fulfilled"; w.grace = clamp(w.grace + 0.4, 0, 1.5); }
            }
            addGrudge(w, def.id, att.id, 1, "the breaking of the Empire");
            break;
          }
          case "holy": {
            if (x.aim.regionId) {
              const r = regionOf(w, x.aim.regionId ?? null);
              const f = faithById(w, x.aim.faithId ?? null);
              if (r && f) {
                r.faithName = f.name; r.devotion = 0.6;
                f.vitality = clamp(f.vitality + 0.12, 0, 1);
                ev(w, "crusade", `The host of House ${att.name} takes ${r.name} for ${f.name}; rival altars are cast down.`,
                  { importance: 3, regionId: r.id, houses: [att.id, def.id], motive: "faith" });
              }
            }
            addGrudge(w, def.id, att.id, 0.8, "the holy war");
            break;
          }
          default: { // conquest / grudge
            const prizeR = regionOf(w, x.aim.regionId ?? null);
            const prize = prizeR && prizeR.ownerId === def.id ? prizeR : null;
            const taken = prize ?? frontRegion(w, att.id, def.id, null);
            const crippled = regionsOf(w, def.id).length <= 1 || realmMight(w, att.id) > realmMight(w, def.id) * 2;
            if (taken && regionsOf(w, def.id).length > 1) {
              transferRegion(w, taken, att.id);
              ev(w, "conquest", `House ${att.name} annexes ${taken.name} from House ${def.name}.`,
                { importance: 3, regionId: taken.id, houses: [att.id, def.id], motive: x.aim.kind });
              addGrudge(w, def.id, att.id, 0.8, `the taking of ${taken.name}`);
            }
            if (crippled && chance(rng, 0.7)) {
              const wrested = def.overlordId && def.overlordId !== att.id ? houseOf(w, def.overlordId) : null;
              if (att.overlordId === def.id) att.overlordId = null; // the chain inverts, never loops
              def.overlordId = att.id; def.loyalty = 0.5;
              ev(w, "vassalage", wrested
                ? `House ${def.name} is wrested from House ${wrested.name}'s grasp and bends the knee to House ${att.name}.`
                : `House ${def.name} bends the knee as vassal to House ${att.name}.`,
                { importance: 3, houses: [att.id, def.id] });
              if (wrested) {
                addGrudge(w, wrested.id, att.id, 0.6, `the theft of House ${def.name}'s fealty`);
                setTruce(w, wrested.id, def.id, w.era + 3); // the loser cannot immediately wrest them back
              }
            }
            if (w.crown.houseId === att.id) w.crown.legitimacy = clamp(w.crown.legitimacy + 0.08, 0, 1);
          }
        }
        att.prestige = clamp(att.prestige + 0.1, 0, 2);
      } else if (result === "defender") {
        ev(w, "peace", `House ${def.name} repels the assault; House ${att.name} falls back bloodied and poorer.`,
          { importance: 2, houses: [att.id, def.id] });
        if (x.aim.kind === "independence") { att.loyalty = 0.6; }
        if (x.aim.kind === "throne") w.crown.legitimacy = clamp(w.crown.legitimacy + 0.15, 0, 1);
        if (chance(rng, 0.3)) {
          const taken = frontRegion(w, def.id, att.id, null);
          if (taken && regionsOf(w, att.id).length > 1) {
            transferRegion(w, taken, def.id);
            ev(w, "conquest", `In answer, House ${def.name} seizes ${taken.name} from the aggressor.`, { importance: 2, regionId: taken.id, houses: [def.id, att.id] });
            addGrudge(w, att.id, def.id, 0.6, `the loss of ${taken.name}`);
          }
        }
        att.warWeary = clamp(att.warWeary + 0.3, 0, 1);
        def.prestige = clamp(def.prestige + 0.08, 0, 2);
        if (w.crown.houseId === att.id) w.crown.legitimacy = clamp(w.crown.legitimacy - 0.1, 0, 1);
      } else {
        ev(w, "peace", `Exhaustion ends the war between House ${att.name} and House ${def.name}; both sides bury their dead and call it honor.`,
          { importance: 2, houses: [att.id, def.id] });
      }
      setTruce(w, att.id, def.id, w.era + (x.aim.kind === "raid" ? 1 : 3)); // swords need time to be reforged
      w.grace = clamp(w.grace - 0.1, 0, 1.5); // war brings suffering to the land
    }

    /* prune long-dead wars from the ledger */
    if (w.wars.length > 40) w.wars = w.wars.filter((x) => !x.over || x.startEra > w.era - 6);
  },
};
