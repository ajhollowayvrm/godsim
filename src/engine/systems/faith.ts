/**
 * Faith: religions are born from zeal and distress, spread region to region,
 * harden into doctrine, fracture in schism, war for sacred ground, and form
 * their own creeds about the god — from what the god actually does.
 */
import type { RNG } from "../rng";
import { chance, clamp, pick, weightedPick } from "../rng";
import type { Faith, Posture, System, World } from "../types";
import { faithName, GOD_NAME } from "../names";
import {
  ageOf, deed, ev, houseLord, houseOf, housesAlive, livingFaiths, livingPeople,
  monarch, premierArtifact, regionOf, regionsOf, renown, standing,
} from "../world";

const TENETS = ["asceticism", "holy war", "charity", "mysticism", "ancestor-cult", "relic-veneration", "pilgrimage", "tolerance", "orthodoxy", "prophecy", "silence", "tithes"];
const FOCUS_CREED: Record<string, string> = {
  relic: "the relic itself", line: "the sacred bloodline", god: GOD_NAME,
  reforged: "a new relic raised in the old one's place", salvation: "deliverance from this world's hunger",
  ancestor: "the honored dead", doom: "the closing of the sky",
};

function rollPosture(rng: RNG, founder: { traits: string[] } | null): Posture {
  const opts: [Posture, number][] = [
    ["militant", 1 + (founder?.traits.includes("cruel") || founder?.traits.includes("bold") ? 2 : 0)],
    ["evangelical", 1 + (founder?.traits.includes("charming") ? 2 : 0)],
    ["insular", 1 + (founder?.traits.includes("cautious") ? 2 : 0)],
    ["syncretic", 1 + (founder?.traits.includes("scholarly") ? 2 : 0)],
    ["benevolent", 1 + (founder?.traits.includes("generous") || founder?.traits.includes("just") ? 2 : 0)],
  ];
  return weightedPick(rng, opts, ([, v]) => v)[0];
}

export function foundFaith(
  w: World, rng: RNG, focus: string, founderId: string | null,
  opts: { parentId?: string | null; vitality?: number; posture?: Posture; homeRegionId?: string | null; causedBy?: string[] } = {},
): Faith {
  const founder = founderId ? w.people[founderId] : null;
  const used = new Set(w.faiths.map((f) => f.name));
  const relic = premierArtifact(w);
  const f: Faith = {
    id: "f" + (w.seq.faith = (w.seq.faith || 0) + 1),
    name: faithName(rng, focus, relic?.name ?? null, used),
    focus, posture: opts.posture ?? rollPosture(rng, founder),
    vitality: opts.vitality ?? 0.4,
    memoryOfGod: focus === "god" ? 0.9 : 0.6,
    zeal: 0.4 + rng() * 0.3,
    doctrines: [],
    sacredRegionIds: [],
    parentId: opts.parentId ?? null,
    patronHouseId: null,
    founderId, foundedEra: w.era, dissolvedEra: null,
    creed: "devout",
  };
  // doctrine flows from focus and founder
  const pool = TENETS.slice();
  const want: string[] = [];
  if (focus === "relic" || focus === "reforged") want.push("relic-veneration");
  if (focus === "salvation") want.push("charity");
  if (focus === "ancestor") want.push("ancestor-cult");
  if (focus === "god") want.push("orthodoxy");
  if (founder?.traits.includes("scholarly")) want.push("mysticism");
  if (founder?.traits.includes("generous")) want.push("charity");
  while (f.doctrines.length < 3) {
    const t = want.length ? want.shift()! : pick(rng, pool);
    if (!f.doctrines.includes(t)) f.doctrines.push(t);
  }
  // a home becomes holy ground
  const home = opts.homeRegionId
    ? regionOf(w, opts.homeRegionId)
    : founder ? regionOf(w, houseOf(w, founder.houseId)?.seatRegionId ?? null) : null;
  if (home) {
    f.sacredRegionIds.push(home.id);
    home.sacredTo = f.name;
    home.faithName = f.name; home.devotion = 0.55;
  }
  if (founder) founder.faithName = f.name;
  w.faiths.push(f);
  return f;
}

export const faith: System = {
  name: "faith",
  run(w, rng) {
    const relic = premierArtifact(w);

    /* genesis: the first faith crystallizes around the great relic */
    if (!w.faiths.length && relic && relic.legend >= 6 && livingPeople(w).length) {
      const f = foundFaith(w, rng, "relic", null, { homeRegionId: relic.lostInRegionId ?? w.regions.find((r) => r.ownerId && w.people[relic.holderId ?? ""]?.houseId === r.ownerId)?.id ?? null });
      ev(w, "founding-faith", `An Order rises around ${relic.name}, naming ${GOD_NAME} as the power that loosed it. ${f.name} is founded.`,
        { importance: 3, motive: "faith" });
    }

    /* prophets: zeal made flesh founds new creeds */
    for (const intent of w.intents.prophets) {
      const p = w.people[intent.personId];
      if (!p?.alive || livingFaiths(w).length >= 5) continue;
      const f = foundFaith(w, rng, intent.focus, p.id);
      deed(w, p, `heard a voice in the wilderness and founded ${f.name}`, 0.2);
      ev(w, "founding-faith", `${p.name} of House ${houseOf(w, p.houseId)?.name} comes out of the wilderness preaching ${FOCUS_CREED[intent.focus] ?? "a new way"} — ${f.name} is born.`,
        { importance: 3, actors: [p.id], motive: "faith" });
    }

    /* conversions of the great */
    for (const c of w.intents.conversions) {
      const p = w.people[c.personId]; const f = w.faiths.find((x) => x.id === c.faithId && !x.dissolvedEra);
      if (!p?.alive || !f) continue;
      const old = p.faithName;
      p.faithName = f.name;
      f.vitality = clamp(f.vitality + 0.04, 0, 1);
      if (w.crown.holderId === p.id && w.crown.stateFaithId && w.crown.stateFaithId !== f.id && p.zeal > 0.6) {
        const oldF = w.faiths.find((x) => x.id === w.crown.stateFaithId);
        w.crown.stateFaithId = f.id;
        w.crown.legitimacy = clamp(w.crown.legitimacy - 0.1, 0, 1);
        ev(w, "conversion", `${p.name} the sovereign forsakes ${oldF?.name ?? "the old rite"} for ${f.name}; the realm's altars are remade, and the pious mutter.`,
          { importance: 3, actors: [p.id], motive: "faith" });
      } else if (renown(w, p) > 0.8) {
        ev(w, "conversion", `${p.name} of House ${houseOf(w, p.houseId)?.name} ${old ? `turns from ${old}` : "kneels"} to ${f.name}.`,
          { importance: 1, actors: [p.id], motive: "faith" });
      }
    }

    const lf = livingFaiths(w);
    if (!lf.length) return;

    /* spatial spread: pressure region by region */
    for (const r of w.regions) {
      const current = lf.find((f) => f.name === r.faithName) ?? null;
      let best: Faith | null = null, bestP = 0;
      for (const f of lf) {
        if (f.name === r.faithName) continue;
        let p = 0;
        const nShare = r.neighbors.filter((nid) => regionOf(w, nid)!.faithName === f.name).length / Math.max(r.neighbors.length, 1);
        p += nShare * (0.35 + f.zeal * 0.3) * (f.posture === "evangelical" ? 1.5 : 1);
        const owner = r.ownerId ? houseOf(w, r.ownerId) : null;
        if (owner && (f.patronHouseId === owner.id || (w.crown.stateFaithId === f.id && (owner.id === w.crown.houseId || owner.overlordId === w.crown.houseId)))) p += 0.18;
        if ((r.famine || r.plague > 0) && (f.doctrines.includes("charity") || f.focus === "salvation")) p += 0.2;
        if (r.neighbors.some((nid) => f.sacredRegionIds.includes(nid)) || f.sacredRegionIds.includes(r.id)) p += 0.15;
        if (current?.doctrines.includes("tolerance")) p *= 0.75;
        if (p > bestP) { bestP = p; best = f; }
      }
      if (!current) {
        if (best && bestP > 0.18) { r.faithName = best.name; r.devotion = clamp(0.25 + bestP, 0, 1); }
      } else if (best && bestP > r.devotion) {
        r.faithName = best.name; r.devotion = 0.3;
      } else {
        r.devotion = clamp(r.devotion + 0.05, 0, 1);
      }
    }

    /* vitality follows the map; memory of the god fades unless kept */
    const total = w.regions.length;
    for (const f of lf) {
      const share = w.regions.filter((r) => r.faithName === f.name).length / total;
      const target = clamp(0.15 + share * 2.2, 0.05, 1);
      f.vitality = clamp(f.vitality + (target - f.vitality) * 0.3 + (rng() - 0.5) * 0.04, 0.05, 1);
      const writing = w.cultures.some((c) => c.tech.writing && w.regions.some((r) => r.cultureKey === c.key && r.faithName === f.name));
      f.memoryOfGod = clamp(f.memoryOfGod + (f.focus === "god" ? 0.04 : writing ? -0.05 : -0.12), 0, 1);
      // keeper of the faith
      const oid = "keeper_" + f.id;
      if (!w.offices[oid]) w.offices[oid] = { id: oid, title: `High Keeper of ${f.name}`, scope: "church", holderId: null };
      const kh = w.people[w.offices[oid].holderId ?? ""];
      if (!kh?.alive) {
        const devout = livingPeople(w).filter((p) => ageOf(p, w.era) >= 20 && (p.faithName === f.name || !p.faithName))
          .sort((a, b) => (b.zeal + renown(w, b) * 0.5) - (a.zeal + renown(w, a) * 0.5) || (a.id < b.id ? -1 : 1));
        if (devout.length) { w.offices[oid].holderId = devout[0].id; devout[0].faithName = f.name; }
      }
      // pilgrim roads feed holy ground
      if (f.doctrines.includes("pilgrimage")) {
        for (const rid of f.sacredRegionIds) {
          const r = regionOf(w, rid);
          if (r) r.prosperity = clamp(r.prosperity + 0.02, 0, 1);
        }
      }
    }

    /* patronage: a faith wins a house's swords */
    for (const f of lf) {
      if (f.patronHouseId && houseOf(w, f.patronHouseId)?.fallenEra) f.patronHouseId = null;
      if (!f.patronHouseId && chance(rng, 0.4)) {
        const taken = new Set(lf.map((x) => x.patronHouseId).filter(Boolean));
        const cand = housesAlive(w).filter((h) => !taken.has(h.id) &&
          (houseLord(w, h.id)?.faithName === f.name || regionsOf(w, h.id).some((r) => r.faithName === f.name)))
          .sort((a, b) => b.prestige - a.prestige || (a.id < b.id ? -1 : 1));
        if (cand.length) {
          f.patronHouseId = cand[0].id;
          ev(w, "patronage", `House ${cand[0].name} takes up the cause of ${f.name}.`, { importance: 1, houses: [cand[0].id], motive: "faith" });
        }
      }
    }

    /* doctrine drifts; schisms tear along the deepest strain */
    for (const f of lf) {
      const myRegions = w.regions.filter((r) => r.faithName === f.name);
      const cultures = new Set(myRegions.map((r) => r.cultureKey));
      const writing = w.cultures.some((c) => c.tech.writing && myRegions.some((r) => r.cultureKey === c.key));
      if (chance(rng, writing ? 0.05 : 0.12)) {
        const out = pick(rng, f.doctrines);
        const cand = TENETS.filter((t) => !f.doctrines.includes(t));
        if (cand.length) {
          const inn = pick(rng, cand);
          f.doctrines[f.doctrines.indexOf(out)] = inn;
          if (f.vitality > 0.5)
            ev(w, "doctrine", `${f.name} sets aside ${out} and preaches ${inn}; the old believers grumble.`, { importance: 1, motive: "faith" });
        }
      }
      const strain =
        (f.focus === "relic" && relic && relic.state !== "held" ? 0.3 : 0)
        + (f.focus === "god" && f.memoryOfGod < 0.25 ? 0.25 : 0)
        + (cultures.size >= 3 ? 0.2 : 0)
        + (f.vitality > 0.7 && f.doctrines.includes("asceticism") ? 0.18 : 0)
        + 0.06;
      if (f.vitality > 0.55 && lf.length < 5 && chance(rng, strain)) {
        const newFocus = f.focus === "relic" ? pick(rng, ["line", "reforged", "god"])
          : f.focus === "god" ? pick(rng, ["reforged", "salvation"])
          : f.focus === "salvation" ? pick(rng, ["god", "doom"])
          : pick(rng, ["god", "salvation", "ancestor"]);
        // the periphery walks away: regions of minority culture
        const minority = myRegions.filter((r) => r.cultureKey !== (myRegions[0]?.cultureKey ?? ""));
        const cradle = minority[0] ?? myRegions[myRegions.length - 1] ?? null;
        const child = foundFaith(w, rng, newFocus, null, { parentId: f.id, vitality: 0.4, homeRegionId: cradle?.id ?? null });
        for (const r of minority.slice(0, 3)) { r.faithName = child.name; r.devotion = 0.45; }
        f.vitality = clamp(f.vitality - 0.2, 0.05, 1);
        f.zeal = clamp(f.zeal + 0.2, 0, 1); child.zeal = clamp(child.zeal + 0.2, 0, 1);
        ev(w, "schism", `${f.name} is torn in schism: a breakaway raises ${child.name}, holding that true devotion belongs to ${FOCUS_CREED[newFocus] ?? newFocus}, not ${FOCUS_CREED[f.focus] ?? f.focus}.`,
          { importance: 3, motive: "faith" });
      }
    }

    /* what each faith DOES, by posture — nothing is scripted */
    for (const f of lf) {
      if (f.dissolvedEra) continue;
      const rivals = livingFaiths(w).filter((x) => x !== f);
      if (f.posture === "militant" && f.patronHouseId && f.zeal > 0.45 && chance(rng, 0.25 + f.zeal * 0.2)) {
        // crusade: retake holy ground, or break the heretic's patron
        const lostHoly = f.sacredRegionIds.map((id) => regionOf(w, id)!)
          .find((r) => r.ownerId && r.faithName !== f.name);
        const target = lostHoly?.ownerId ?? rivals.find((x) => x.patronHouseId)?.patronHouseId ?? null;
        const patron = houseOf(w, f.patronHouseId);
        if (target && patron && target !== patron.id && !patron.fallenEra) {
          const eid = ev(w, "crusade", `${f.name} proclaims a CRUSADE — ${lostHoly ? `to win back the holy ground of ${lostHoly.name}` : `to cleanse the heretics`}; the host of House ${patron.name} takes the cross.`,
            { importance: 3, houses: [patron.id, target], motive: "faith" });
          w.intents.wars.push({
            houseId: patron.id, targetId: target, byId: houseLord(w, patron.id)?.id ?? "",
            aim: { kind: "holy", regionId: lostHoly?.id ?? null, faithId: f.id, label: lostHoly ? `to win back ${lostHoly.name} for ${f.name}` : `to cleanse the heretics of ${f.name}'s god` },
            causedBy: [eid],
          });
          w.grace = clamp(w.grace - 0.1, 0, 1.5);
        }
      } else if (f.posture === "evangelical" && rivals.length && chance(rng, 0.35)) {
        const rival = rivals.slice().sort((a, b) => b.vitality - a.vitality)[0];
        const take = Math.min(0.12, rival.vitality * 0.25);
        rival.vitality = clamp(rival.vitality - take, 0.05, 1); f.vitality = clamp(f.vitality + take, 0, 1);
        ev(w, "conversion", `${f.name} wins converts from ${rival.name}, swelling its flock.`, { importance: 1, motive: "faith" });
      } else if (f.posture === "syncretic" && rivals.length && chance(rng, 0.25)) {
        const rival = rivals.find((x) => x.zeal < 0.5 && x.vitality < f.vitality);
        if (rival) {
          f.vitality = clamp(f.vitality + rival.vitality * 0.5, 0, 1);
          rival.dissolvedEra = w.era;
          for (const r of w.regions) if (r.faithName === rival.name) { r.faithName = f.name; r.devotion = clamp(r.devotion, 0.2, 1); }
          ev(w, "communion", `${f.name} and ${rival.name} enter communion and become one faith.`, { importance: 2, motive: "faith" });
        }
      } else if (f.posture === "benevolent" && chance(rng, 0.4)) {
        const distress = w.regions.some((r) => r.famine || r.plague > 0);
        w.grace = clamp(w.grace + (distress ? 0.4 : 0.2), 0, 1.5);
        f.vitality = clamp(f.vitality + 0.04, 0, 1);
        const hot = livingFaiths(w).filter((x) => x !== f).sort((a, b) => b.zeal - a.zeal)[0];
        if (distress) {
          let line = pick(rng, [
            `${f.name} opens its doors in hard times — the sick are tended, the hungry fed.`,
            `Where the carts of the dead pass, the keepers of ${f.name} walk behind, sleeves rolled.`,
            `${f.name} empties its tithe-barns into the famine roads.`,
          ]);
          if (hot && hot.zeal > 0.65) { hot.zeal = clamp(hot.zeal - 0.25, 0, 1); line += ` It brokers peace, and ${hot.name} lowers its banners.`; }
          ev(w, "grace", line, { importance: 1, motive: "faith" });
        } else if (hot && hot.zeal > 0.65 && chance(rng, 0.5)) {
          hot.zeal = clamp(hot.zeal - 0.25, 0, 1);
          ev(w, "grace", `${f.name} sits between angry parties until the shouting stops; ${hot.name} lowers its banners.`, { importance: 1, motive: "faith" });
        }
      }
    }

    /* the crown and the altar */
    const m = monarch(w);
    if (m) {
      if (w.crown.stateFaithId && !livingFaiths(w).find((f) => f.id === w.crown.stateFaithId)) {
        w.crown.stateFaithId = null;
        w.crown.legitimacy = clamp(w.crown.legitimacy - 0.1, 0, 1);
        ev(w, "sanction", `The faith of the realm has fallen; the Crown stands without sanction, and men murmur.`, { importance: 2 });
      }
      const lf2 = livingFaiths(w);
      if (!w.crown.stateFaithId && lf2.length && chance(rng, 0.5)) {
        const sf = lf2.find((f) => f.name === m.faithName) ?? lf2.find((f) => f.patronHouseId === w.crown.houseId) ?? lf2.slice().sort((a, b) => b.vitality - a.vitality)[0];
        w.crown.stateFaithId = sf.id;
        sf.vitality = clamp(sf.vitality + 0.12, 0, 1);
        w.crown.legitimacy = clamp(w.crown.legitimacy + 0.12, 0, 1);
        ev(w, "sanction", `The Crown elevates ${sf.name} as the faith of the realm; throne and altar bind together.`, { importance: 2, motive: "faith" });
      }
      const sf = lf2.find((f) => f.id === w.crown.stateFaithId);
      if (sf?.posture === "benevolent") w.grace = clamp(w.grace + 0.15, 0, 1.5);
      for (const f of lf2) {
        if (f.id === w.crown.stateFaithId) continue;
        const hostile = f.posture === "militant"
          || (f.patronHouseId && standing(w, f.patronHouseId, w.crown.houseId!) < -0.2)
          || (sf && f.focus !== sf.focus && f.zeal > 0.65);
        if (hostile && chance(rng, 0.25)) {
          w.crown.legitimacy = clamp(w.crown.legitimacy - 0.12, 0, 1);
          f.zeal = clamp(f.zeal + 0.1, 0, 1);
          const eid = ev(w, "denounce", `${f.name} denounces the Crown as unworthy; ${m.name}'s legitimacy frays.`, { importance: 2, motive: "faith" });
          if (chance(rng, 0.5)) {
            f.vitality = clamp(f.vitality - 0.35, 0.05, 1);
            f.zeal = clamp(f.zeal + 0.15, 0, 1);
            w.crown.legitimacy = clamp(w.crown.legitimacy - 0.06, 0, 1);
            ev(w, "persecution", `The Crown moves to suppress ${f.name} — its faithful are scattered, but martyrs stir unrest.`,
              { importance: 2, causedBy: [eid], motive: "security" });
          }
        }
      }
    }

    /* collapse */
    for (const f of livingFaiths(w)) {
      if (f.vitality < 0.12) {
        f.dissolvedEra = w.era;
        for (const r of w.regions) if (r.faithName === f.name) { if (r.devotion < 0.3) r.faithName = null; r.devotion = clamp(r.devotion - 0.2, 0, 1); }
        ev(w, "collapse", `${f.name} withers and is no more; its shrines fall silent.`, { importance: 2, motive: "faith" });
      }
    }
  },
};
