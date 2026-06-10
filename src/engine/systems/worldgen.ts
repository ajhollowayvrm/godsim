/**
 * Boot-time procedural generation: the hex map (regions + adjacency), cultures,
 * houses with founding families, and the artifact ecology. Runs once.
 */
import type { RNG } from "../rng";
import { chance, clamp, jitter, pick, pickN, rangeInt } from "../rng";
import { CULTURE_SEEDS, artifactName, houseName, regionName } from "../names";
import type { Artifact, Culture, House, Person, Region, Terrain, World } from "../types";
import { adjStanding, deed, ev, newPerson, wound } from "../world";

const COLS = 8, ROWS = 5;

/** odd-q offset hex neighbors (flat-top, odd columns shifted down). */
const ODDQ: [number, number][][] = [
  [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]],   // even col
  [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]],     // odd col
];

const OUTPUT: Record<Terrain, Partial<Record<"food" | "wealth" | "manpower" | "ore" | "lore", number>>> = {
  plain: { food: 3, wealth: 1, manpower: 1.2 },
  hill: { food: 1.5, ore: 1.5, manpower: 1, wealth: 0.8 },
  mountain: { ore: 2.5, lore: 0.8, food: 0.5, manpower: 0.5 },
  forest: { food: 1.5, wealth: 0.8, manpower: 0.8, lore: 0.5 },
  marsh: { food: 1, lore: 1, manpower: 0.6, wealth: 0.5 },
  desert: { wealth: 1.5, food: 0.6, lore: 0.8, manpower: 0.6 },
  coast: { food: 2, wealth: 2, manpower: 0.8, lore: 0.7 },
  steppe: { manpower: 2, food: 1.2, wealth: 0.6 },
};
const BASE_POP: Record<Terrain, number> = {
  plain: 12, coast: 10, hill: 7, forest: 6, steppe: 7, marsh: 4, desert: 4, mountain: 3,
};

const HOUSE_COLORS = [
  "#c9a24b", "#b24432", "#7fb0c9", "#7d9a5a", "#a06fb0", "#c97f4b",
  "#5a8d9a", "#b04f6f", "#8a8d4a", "#6f7db0", "#9a6a4a", "#4ba07f",
  "#b09a3a", "#7a5ab0", "#b0683a", "#3a8ab0",
];

const CULTURE_VALUES: Record<string, Partial<Record<string, number>>> = {
  Highland: { status: 0.5, vengeance: 0.45, security: 0.35, legacy: 0.3 },
  Riverland: { love: 0.45, wealth: 0.4, legacy: 0.4, knowledge: 0.25 },
  Sunland: { wealth: 0.5, knowledge: 0.45, status: 0.35, faith: 0.3 },
  Marshfolk: { security: 0.5, knowledge: 0.4, freedom: 0.45, faith: 0.25 },
};
const CULTURE_CUSTOMS: Record<string, string[]> = {
  Highland: ["blood-feud is law", "the eldest carries the name"],
  Riverland: ["guest-right is sacred", "songs settle quarrels"],
  Sunland: ["the learned sit above the strong", "water-debt binds for life"],
  Marshfolk: ["the dead are given to the fen", "no oath sworn under a roof"],
};

const FOUNDER_WOUNDS = [
  "a homeland drowned in the grandfathers' time",
  "a sibling lost on the crossing",
  "a name spat on in an older country",
  "a famine that emptied the first hall",
  "an oath broken by a sworn friend",
];

const ARTIFACT_WANTS = [
  "a worthy hand", "to be sung of in every hall", "to return to the god who loosed it",
  "ruin upon the proud", "the blood that first carried it", "the quiet of the deep earth",
];
const ARTIFACT_POWERS: Artifact["power"][] = ["war", "crown", "sight", "plenty", "dread", "grace"];

export function generateWorld(w: World, rng: RNG): void {
  /* cultures */
  w.cultures = CULTURE_SEEDS.map((seed, i) => ({
    ...seed,
    namePre: seed.namePre.slice(), nameSuf: seed.nameSuf.slice(), hair: seed.hair.slice(),
    seatAdj: seed.seatAdj.slice(), seatGeo: seed.seatGeo.slice(), houseRoots: seed.houseRoots.slice(),
    values: { ...(CULTURE_VALUES[seed.key] ?? {}) } as Culture["values"],
    customs: (CULTURE_CUSTOMS[seed.key] ?? []).slice(),
    tech: {},
    succession: i % 2 === 0 ? "primogeniture" : "elective",
    parentKey: null,
  }));

  /* the map: a continent ringed by sea */
  const anchors: [string, number, number][] = [
    ["Highland", 1, 0.5], ["Riverland", 6, 0.5], ["Sunland", 6, 3.5], ["Marshfolk", 1, 3.5],
  ];
  const usedNames = new Set<string>();
  const cells: Region[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const id = "r" + (col * ROWS + row);
      let bestKey = anchors[0][0], bestD = 1e9;
      for (const [key, ac, ar] of anchors) {
        const d = (col - ac) ** 2 + ((row - ar) * 1.6) ** 2;
        if (d < bestD) { bestD = d; bestKey = key; }
      }
      const cult = w.cultures.find((c) => c.key === bestKey)!;
      const edge = col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1;
      let terrain: Terrain;
      if (edge && chance(rng, 0.55)) terrain = "coast";
      else {
        const table: Terrain[] =
          bestKey === "Highland" ? ["hill", "hill", "mountain", "plain", "forest", "steppe"]
          : bestKey === "Riverland" ? ["plain", "plain", "forest", "plain", "hill", "forest"]
          : bestKey === "Sunland" ? ["desert", "steppe", "plain", "desert", "hill", "plain"]
          : ["marsh", "marsh", "forest", "plain", "marsh", "forest"];
        terrain = pick(rng, table);
      }
      cells.push({
        id, name: regionName(rng, cult, usedNames), terrain, col, row,
        neighbors: [], ownerId: null,
        output: { ...OUTPUT[terrain] },
        population: Math.max(2, Math.round(BASE_POP[terrain] * (0.8 + rng() * 0.4))),
        prosperity: clamp(0.45 + jitter(rng, 0.1), 0.2, 0.7),
        devastation: 0, cultureKey: bestKey,
        faithName: null, devotion: 0, sacredTo: null, plague: 0, famine: false,
        improvements: 0,
      });
    }
  }
  // adjacency
  const at = (c: number, r: number) => (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? cells[c * ROWS + r] : null;
  for (const cell of cells) {
    for (const [dc, dr] of ODDQ[cell.col & 1]) {
      const n = at(cell.col + dc, cell.row + dr);
      if (n) cell.neighbors.push(n.id);
    }
  }
  w.regions = cells;

  /* houses: spread seats by max-min-distance, claim seat + nearby regions */
  const N_HOUSES = 12;
  const usedHouse = new Set<string>();
  const seats: Region[] = [];
  const candidates = cells.filter((c) => c.terrain !== "mountain");
  for (let i = 0; i < N_HOUSES; i++) {
    let best: Region | null = null, bestScore = -1;
    for (const c of candidates) {
      if (seats.includes(c)) continue;
      const minD = seats.length
        ? Math.min(...seats.map((s) => (s.col - c.col) ** 2 + ((s.row - c.row) * 1.6) ** 2))
        : 50 + rng() * 10;
      const score = minD + rng() * 0.5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best) seats.push(best);
  }
  w.houses = seats.map((seat, i) => {
    const cult = w.cultures.find((c) => c.key === seat.cultureKey)!;
    const h: House = {
      id: "h" + i, name: houseName(rng, cult, usedHouse),
      seatRegionId: seat.id, seat: seat.name, culture: cult.key, hair: pick(rng, cult.hair),
      holdings: 1, overlordId: null, loyalty: 1,
      treasury: { food: 2, wealth: 3, manpower: 2 },
      prestige: 0.2, grudges: [], foundedEra: 0, fallenEra: null,
      color: HOUSE_COLORS[i % HOUSE_COLORS.length], warWeary: 0,
    };
    seat.ownerId = h.id;
    return h;
  });
  // each house claims 1-2 adjacent wild regions
  for (const h of w.houses) {
    const seat = cells.find((c) => c.id === h.seatRegionId)!;
    const free = seat.neighbors.map((id) => cells.find((c) => c.id === id)!).filter((c) => !c.ownerId);
    for (const r of free.slice(0, rangeInt(rng, 1, 2))) { r.ownerId = h.id; if (r.cultureKey !== h.culture && chance(rng, 0.5)) r.cultureKey = h.culture; }
    h.holdings = cells.filter((c) => c.ownerId === h.id).length;
  }

  /* founding families */
  for (const h of w.houses) {
    let lord: Person | null = null;
    const n = rangeInt(rng, 3, 4);
    for (let k = 0; k < n; k++) {
      const f = newPerson(w, rng, h.id, 0);
      if (chance(rng, 0.3)) wound(w, f, pick(rng, FOUNDER_WOUNDS), null);
      if (!lord || f.prowess > lord.prowess) lord = f;
    }
    w.offices["lord_" + h.id] = { id: "lord_" + h.id, title: `Lord of ${h.seat}`, scope: "domain", houseId: h.id, holderId: lord!.id, hereditary: true };
  }
  w.offices["captain"] = { id: "captain", title: "High Captain of the Realm", scope: "war", houseId: null, holderId: null, hereditary: false };

  /* initial standings: same culture leans warm, neighbors rub */
  for (let i = 0; i < w.houses.length; i++) {
    for (let j = i + 1; j < w.houses.length; j++) {
      const a = w.houses[i], b = w.houses[j];
      let v = jitter(rng, 0.2);
      if (a.culture === b.culture) v += 0.12;
      const aSeat = cells.find((c) => c.id === a.seatRegionId)!, bSeat = cells.find((c) => c.id === b.seatRegionId)!;
      const near = (aSeat.col - bSeat.col) ** 2 + (aSeat.row - bSeat.row) ** 2 < 6;
      if (near) v -= 0.1;
      adjStanding(w, a.id, b.id, v);
    }
  }

  /* the artifact ecology: 5 relics with wills and wants */
  const usedArt = new Set<string>();
  const powers = pickN(rng, ARTIFACT_POWERS, 5);
  const wilds = cells.filter((c) => !c.ownerId);
  for (let i = 0; i < 5; i++) {
    const cult = pick(rng, w.cultures);
    const { name, kind } = artifactName(rng, cult, usedArt);
    const a: Artifact = {
      id: "a" + i, name, kind,
      holderId: null, state: "lost",
      lostInRegionId: (wilds.length ? pick(rng, wilds) : pick(rng, cells)).id,
      legend: i === 0 ? 2 : rangeInt(rng, 0, 1),
      will: clamp(0.3 + rng() * 0.6, 0, 1),
      wants: pick(rng, ARTIFACT_WANTS),
      attune: pick(rng, w.houses.map((h) => h.hair)),
      power: powers[i], custody: [], cultName: null,
    };
    w.artifacts.push(a);
  }
  // one relic begins in mortal hands: the strongest founding lord bears it
  const firstLord = w.houses
    .map((h) => w.people[w.offices["lord_" + h.id].holderId!])
    .sort((a, b) => b.prowess - a.prowess || (a.id < b.id ? -1 : 1))[0];
  const held = w.artifacts[1];
  held.holderId = firstLord.id; held.state = "held"; held.lostInRegionId = null;
  held.custody.push({ holderId: firstLord.id, era: 0, how: "borne out of the founding" });
  deed(w, firstLord, `bore ${held.name} out of the founding`, 0.1);

  ev(w, "founding",
    `Twelve houses raise their halls across the land, from ${w.regions[0].name} to ${w.regions[w.regions.length - 1].name}. ` +
    `${firstLord.name} of House ${w.houses.find((h) => h.id === firstLord.houseId)!.name} bears ${held.name}; four other relics lie lost in the wild places, waiting.`,
    { importance: 3 });
}
