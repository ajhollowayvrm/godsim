/**
 * THE HEART: the agent decision loop. Every tracked adult surveys their actual
 * situation, scores the actions open to them against their drives, wound and
 * traits, and commits to one. Big consequences (wars, marriages, conversions,
 * quests) are emitted as INTENTS that the owning system resolves this same era
 * — so every event downstream began as somebody wanting something.
 */
import type { RNG } from "../rng";
import { chance, clamp, jitter } from "../rng";
import type { Person, System, WarAim, World } from "../types";
import {
  adjStanding, adultsOf, ageOf, deriveDesire, ev, grudgeAgainst, houseLiving, houseLord,
  houseOf, inTruce, isLord, livingFaiths, livingPeople, monarch, realmMight, regionOf,
  regionsOf, relOf, renown, standing, deed, bumpRel,
} from "../world";

interface Option { kind: string; score: number; exec: () => void; }

const dv = (p: Person, d: string) => (p.drives as Record<string, number>)[d] ?? 0;
const has = (p: Person, t: string) => p.traits.includes(t as never);

export const agents: System = {
  name: "agents",
  run(w, rng) {
    w.intents.builds.length = 0; w.intents.endowments.length = 0; // bookkeeping channels, refreshed each era
    const m = monarch(w);
    const lostArtifacts = w.artifacts.filter((a) => a.state === "lost");
    const people = livingPeople(w).filter((p) => ageOf(p, w.era) >= 18 && !p.avatar);

    for (const p of people) {
      const house = houseOf(w, p.houseId); if (!house || house.fallenEra) continue;
      const lord = isLord(w, p);
      const caution = 0.3 + (has(p, "cautious") ? 0.35 : 0) + (has(p, "paranoid") ? 0.15 : 0) - (has(p, "bold") ? 0.25 : 0);
      const myMight = realmMight(w, p.houseId);
      const opts: Option[] = [];

      /* default: attend court — always possible, rarely thrilling */
      opts.push({
        kind: "court", score: 0.16 + dv(p, "status") * 0.1 + jitter(rng, 0.03),
        exec: () => {
          const liege = m && m.id !== p.id ? m : houseLord(w, p.houseId);
          if (liege && liege.id !== p.id) bumpRel(w, liege.id, p.id, { affection: 0.05, trust: 0.04 }, "service at court");
          p.lastAction = "court";
        },
      });

      /* WAGE WAR — lords only; needs an aim worth the blood */
      const atWar = w.wars.some((x) => !x.over && (x.attackerId === p.houseId || x.defenderId === p.houseId));
      if (lord && !atWar && house.warWeary < 0.6) {
        let best: { target: string; aim: WarAim; value: number } | null = null;
        const consider = (target: string, aim: WarAim, value: number) => {
          if (!best || value > best.value) best = { target, aim, value };
        };
        for (const t of w.houses) {
          if (t.id === p.houseId || t.fallenEra || !houseLiving(w, t.id).length) continue;
          if (t.overlordId === p.houseId) continue;           // one's own vassals are ruled, not invaded
          if (inTruce(w, p.houseId, t.id)) continue;          // the swords are sworn to rest
          if (w.wars.some((x) => !x.over && ((x.attackerId === p.houseId && x.defenderId === t.id) || (x.defenderId === p.houseId && x.attackerId === t.id)))) continue;
          const ratio = myMight / Math.max(realmMight(w, t.id), 0.1);
          const border = regionsOf(w, p.houseId).some((r) => r.neighbors.some((nid) => regionOf(w, nid)!.ownerId === t.id));
          if (!border && t.id !== house.overlordId) continue; // wars need a front
          const grudge = grudgeAgainst(w, p.houseId, t.id);
          const vassalPenalty = t.overlordId ? 0.55 : 1; // little glory in beating another lord's dog
          if (grudge > 0.45) {
            const worst = houseOf(w, p.houseId)!.grudges.filter((g) => g.vs === t.id).sort((a, b) => b.weight - a.weight)[0];
            consider(t.id, { kind: "grudge", label: worst ? `to repay ${worst.reason} in kind` : "to repay an old and heavy grudge" },
              (dv(p, "vengeance") * grudge * 1.1 + (ratio - 1) * 0.2) * vassalPenalty);
          }
          if (ratio > 1.25 && standing(w, p.houseId, t.id) < 0.2) {
            const prize = regionsOf(w, t.id).filter((r) => r.neighbors.some((nid) => regionOf(w, nid)!.ownerId === p.houseId))
              .sort((a, b) => b.prosperity - a.prosperity || (a.id < b.id ? -1 : 1))[0];
            if (prize) {
              const hungry = regionsOf(w, p.houseId).some((r) => r.famine);
              consider(t.id, { kind: "conquest", regionId: prize.id, label: `to take ${prize.name}` },
                (dv(p, "status") * 0.45 + dv(p, "wealth") * prize.prosperity * 0.5 + (hungry ? dv(p, "security") * 0.5 : 0) + (ratio - 1.25) * 0.25) * vassalPenalty);
            }
          }
        }
        if (house.overlordId && house.loyalty < 0.4) {
          const ratio = myMight / Math.max(realmMight(w, house.overlordId), 0.1);
          consider(house.overlordId, { kind: "independence", label: "to kneel no longer" },
            dv(p, "freedom") * 0.9 + dv(p, "status") * 0.3 + (ratio - 0.7) * 0.3);
        }
        if (best) {
          const b = best as { target: string; aim: WarAim; value: number };
          const risk = clamp(realmMight(w, b.target) / Math.max(myMight, 0.1) - 0.75, 0, 1.5);
          opts.push({
            kind: "war", score: b.value - risk * caution + jitter(rng, 0.06),
            exec: () => {
              w.intents.wars.push({ houseId: p.houseId, targetId: b.target, aim: b.aim, byId: p.id });
              p.lastAction = "war:" + b.aim.kind;
            },
          });
        }
      }

      /* SCHEME — guile in the dark */
      if (p.guile > 0.45) {
        let target: Person | null = null, motive = "";
        if (m && m.id !== p.id && (p.claims.includes(w.crown.houseId ?? "") || renown(w, p) > renown(w, m) * 1.05)) { target = m; motive = "status"; }
        if (p.woundVs && houseLord(w, p.woundVs)?.alive) { target = houseLord(w, p.woundVs); motive = "vengeance"; }
        const rival = w.rels.find((r) => r.from === p.id && r.rivalry > 0.5 && w.people[r.to]?.alive);
        if (!target && rival) { target = w.people[rival.to]; motive = "vengeance"; }
        if (target && target.id === p.id) target = null; // no one plots their own murder
        if (target) {
          const t = target;
          const score = (motive === "vengeance" ? dv(p, "vengeance") : dv(p, "status")) * 0.75
            + p.guile * 0.25 - 0.55 * caution + (has(p, "cruel") ? 0.1 : 0) - (has(p, "just") ? 0.3 : 0) + jitter(rng, 0.06);
          opts.push({
            kind: "scheme", score,
            exec: () => {
              let plot = w.plots.find((x) => x.plotterId === p.id && x.targetId === t.id);
              if (!plot) {
                plot = { id: "k" + (w.seq.plot = (w.seq.plot || 0) + 1), plotterId: p.id, targetId: t.id, kind: w.crown.holderId === t.id ? "coup" : "assassination", progress: 0, motive, bornEra: w.era };
                w.plots.push(plot);
              }
              plot.progress = clamp(plot.progress + 0.25 + p.guile * 0.25, 0, 1);
              p.lastAction = "scheme";
            },
          });
        }
      }

      /* MARRY — alliance, or love */
      if (!p.spouseId && ageOf(p, w.era) <= 55) {
        let bestMatch: Person | null = null, bestV = -1;
        for (const t of w.houses) {
          if (t.id === p.houseId || t.fallenEra || standing(w, p.houseId, t.id) < -0.3) continue;
          for (const c of adultsOf(w, t.id)) {
            if (c.spouseId || ageOf(c, w.era) > 55) continue;
            const aff = relOf(w, p.id, c.id)?.affection ?? 0;
            const v = standing(w, p.houseId, t.id) * 0.3 + realmMight(w, t.id) * 0.04 + aff * dv(p, "love") + rng() * 0.1;
            if (v > bestV) { bestV = v; bestMatch = c; }
          }
        }
        if (bestMatch) {
          const c = bestMatch;
          opts.push({
            kind: "marry", score: dv(p, "love") * 0.55 + dv(p, "security") * 0.3 + dv(p, "status") * 0.2 + jitter(rng, 0.05),
            exec: () => { w.intents.proposals.push({ aId: p.id, bId: c.id, byId: p.id }); p.lastAction = "marry"; },
          });
        }
      }

      /* BUILD — works that outlive a life */
      if ((lord || p.acumen > 0.6) && house.treasury.wealth >= 2) {
        const target = regionsOf(w, p.houseId).sort((a, b) => a.improvements - b.improvements || (a.id < b.id ? -1 : 1))[0];
        if (target && target.improvements < 4) {
          opts.push({
            kind: "build", score: dv(p, "wealth") * 0.4 + dv(p, "legacy") * 0.4 + dv(p, "security") * 0.2 + p.acumen * 0.2 + jitter(rng, 0.05),
            exec: () => {
              house.treasury.wealth -= 2; target.improvements++; target.prosperity = clamp(target.prosperity + 0.06, 0, 1);
              p.lastAction = "build";
              if (target.improvements >= 3)
                ev(w, "works", `${p.name} raises great works at ${target.name} — granaries, walls, a market cross.`, { importance: 1, actors: [p.id], regionId: target.id, motive: "legacy" });
              deed(w, p, `raised works at ${target.name}`, 0.03);
            },
          });
        }
      }

      /* ENDOW a faith */
      const faiths = livingFaiths(w);
      if (faiths.length && house.treasury.wealth >= 1.5 && (p.zeal > 0.4 || dv(p, "faith") > 0.2)) {
        const f = faiths.find((x) => x.name === p.faithName) ?? faiths.slice().sort((a, b) => b.vitality - a.vitality)[0];
        opts.push({
          kind: "endow", score: dv(p, "faith") * 0.7 + dv(p, "legacy") * 0.25 + p.zeal * 0.2 - 0.1 + jitter(rng, 0.05),
          exec: () => {
            house.treasury.wealth -= 1.5; f.vitality = clamp(f.vitality + 0.07, 0, 1);
            house.prestige = clamp(house.prestige + 0.04, 0, 2);
            p.faithName = f.name;
            if (w.crown.holderId === p.id) w.crown.legitimacy = clamp(w.crown.legitimacy + 0.06, 0, 1);
            p.lastAction = "endow";
            w.intents.endowments.push({ personId: p.id, faithId: f.id });
          },
        });
      }

      /* QUEST for a lost relic */
      if (lostArtifacts.length && (p.prowess > 0.55 || dv(p, "knowledge") > 0.3) && ageOf(p, w.era) < 55 && !lord) {
        const a = lostArtifacts.slice().sort((x, y) => y.legend - x.legend || (x.id < y.id ? -1 : 1))[0];
        opts.push({
          kind: "quest", score: dv(p, "status") * 0.35 + dv(p, "knowledge") * 0.35 + dv(p, "legacy") * 0.3 + a.legend * 0.015 - 0.25 * caution + jitter(rng, 0.07),
          exec: () => { w.intents.quests.push({ personId: p.id, artifactId: a.id }); p.lastAction = "quest"; },
        });
      }

      /* CONVERT — when another creed answers what yours cannot */
      if (faiths.length >= 2 && p.zeal > 0.3) {
        const home = regionsOf(w, p.houseId)[0];
        const localFaith = home?.faithName ? faiths.find((f) => f.name === home.faithName) : null;
        if (localFaith && localFaith.name !== p.faithName) {
          opts.push({
            kind: "convert", score: dv(p, "faith") * 0.5 + dv(p, "security") * 0.2 + localFaith.vitality * 0.2 - 0.25 + jitter(rng, 0.06),
            exec: () => { w.intents.conversions.push({ personId: p.id, faithId: localFaith.id }); p.lastAction = "convert"; },
          });
        }
      }

      /* PROPHESY — zeal boils over into a new creed */
      const godForgotten = faiths.length === 0 || faiths.every((f) => f.memoryOfGod < 0.3);
      const distress = regionsOf(w, p.houseId).filter((r) => r.famine || r.plague > 0).length;
      if (p.zeal > 0.75 && (godForgotten || distress >= 1 || faiths.length === 0) && faiths.length < 5 && !w.faiths.some((f) => f.founderId === p.id)) {
        opts.push({
          kind: "prophesy", score: dv(p, "faith") * 0.8 + dv(p, "legacy") * 0.3 + p.zeal * 0.25 - 0.5 + distress * 0.15 + jitter(rng, 0.08),
          exec: () => {
            w.intents.prophets.push({ personId: p.id, focus: godForgotten ? "god" : "salvation" });
            p.lastAction = "prophesy";
          },
        });
      }

      /* RECONCILE — the just bury grudges */
      if ((has(p, "just") || has(p, "forgiving")) && lord) {
        const g = house.grudges.slice().sort((a, b) => b.weight - a.weight)[0];
        if (g && houseOf(w, g.vs) && !houseOf(w, g.vs)!.fallenEra) {
          opts.push({
            kind: "reconcile", score: dv(p, "security") * 0.4 + dv(p, "love") * 0.3 + 0.1 + jitter(rng, 0.05),
            exec: () => {
              g.weight = clamp(g.weight - 0.5, 0, 2);
              if (g.weight <= 0.05) house.grudges.splice(house.grudges.indexOf(g), 1);
              const other = houseOf(w, g.vs)!;
              adjStanding(w, house.id, other.id, 0.3);
              ev(w, "peace", `${p.name} of House ${house.name} sends gifts and hostages to House ${other.name}; an old wound is allowed to close.`,
                { importance: 1, actors: [p.id], houses: [house.id, other.id], motive: "security" });
              p.lastAction = "reconcile";
            },
          });
        }
      }

      /* TUTOR an heir — legacy through blood */
      if (ageOf(p, w.era) > 45 && dv(p, "legacy") > 0.25) {
        const heir = houseLiving(w, p.houseId).filter((c) => c.parents.includes(p.id) && ageOf(c, w.era) < 18)
          .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
        if (heir) {
          opts.push({
            kind: "tutor", score: dv(p, "legacy") * 0.6 + dv(p, "knowledge") * 0.2 + jitter(rng, 0.04),
            exec: () => {
              heir.prowess = clamp(heir.prowess + p.prowess * 0.06, 0, 1);
              heir.guile = clamp(heir.guile + p.guile * 0.06, 0, 1);
              heir.acumen = clamp(heir.acumen + p.acumen * 0.06, 0, 1);
              bumpRel(w, heir.id, p.id, { affection: 0.15, trust: 0.15 }, "raised at the knee");
              p.lastAction = "tutor";
            },
          });
        }
      }

      /* commit to the best-scoring want */
      opts.sort((a, b) => b.score - a.score);
      if (opts[0].score > 0) opts[0].exec();
      if (w.era % 4 === 0) p.desire = deriveDesire(w, p); // wants resettle as life moves
    }
  },
};
