/**
 * godsim — core data model for the DEEP rebuild.
 *
 * `Engine` / `EngineView` are the stable contract the UI + tests rely on; keep
 * them backward-compatible as you rebuild. Everything below them is the target
 * model for a dynamic, agent-driven simulation (see /CLAUDE.md and
 * /docs/data-model.reference.ts for the fuller sketch). Grow it as systems land.
 */

/* ─────────────────────────── stable engine contract ─────────────────────────── */

export interface Engine {
  /** Advance the world by one era (deterministic). */
  advance(): void;
  /** A JSON-serializable snapshot of the world for the UI and the chronicle. */
  view(): EngineView;
  /** Player (divine) interventions. */
  nameChosen(personId: string): void;
  bestowSword(personId: string): void;
  bless(personId: string): void;
  reclaimSword(): void;
  listLiving(): PersonView[];
}

export interface EngineView {
  era: number;
  year: number;
  log: string[];
  houses: HouseView[];
  faiths: FaithView[];
  crown: CrownView | null;
  sword: ArtifactView | null;
  empire: string | null;
  chosen: ChosenView | null;
  grace: number;
  [k: string]: unknown;
}

export interface HouseView { id: string; name: string; seat?: string; culture?: string; living: number; holdings: number; overlord: string | null; lord?: string | null; }
export interface FaithView { name: string; focus: string; posture: string; vitality: number; mem?: number; }
export interface CrownView { house: string; monarch?: string | null; legitimacy: number; stateFaith?: string | null; }
export interface ArtifactView { name: string; holder?: string | null; state: string; legend: number; attune?: string; }
export interface ChosenView { name?: string; alive?: boolean; outcome?: string; house?: string; }
export interface PersonView { id: string; name: string; house: string; houseId?: string; age: number; renown: number; holdsSword?: boolean; chosen?: boolean; }

/* ───────────────────────── target model (deep rebuild) ───────────────────────── */

export type Drive = "security" | "status" | "wealth" | "faith" | "love" | "vengeance" | "legacy" | "knowledge" | "freedom";
export type Posture = "militant" | "evangelical" | "insular" | "syncretic" | "benevolent";
export type Terrain = "plain" | "hill" | "mountain" | "forest" | "marsh" | "desert" | "coast" | "steppe";
export type Resource = "food" | "wealth" | "manpower" | "ore" | "lore";

/** A tracked individual with interiority that DRIVES behavior. */
export interface Person {
  id: string;
  name: string;
  baseName: string;
  namedAfter: string | null;
  houseId: string;
  bornEra: number;
  diedEra: number | null;
  alive: boolean;
  parents: string[];
  spouseId: string | null;
  claims: string[];
  // physical / heritable
  hair: string;
  // capability
  prowess: number;   // martial
  guile: number;     // intrigue
  acumen?: number;   // stewardship / economy
  zeal?: number;     // faith intensity
  // interiority — the engine of dynamism
  drives?: Partial<Record<Drive, number>>; // weighted goals
  wound?: string;    // formative grievance/fear that biases choices
  desire?: string;   // overriding want
  traits?: string[]; // temperament (e.g. "ambitious", "cruel", "pious", "cautious")
  // bookkeeping
  renown?: number;
  chosen?: boolean;
  // level-of-detail: notable persons are fully simulated; others may be aggregated
  lod?: "tracked" | "background";
}

/** Weighted social edge; updates from events and FEEDS BACK into decisions. */
export interface Relationship {
  from: string; to: string;
  affection: number;   // -1..1 love/hate
  trust: number;       // -1..1
  debt: number;        // obligation owed
  rivalry: number;     // 0..1 competition for the same prize
  kind?: "kin" | "spouse" | "liege" | "vassal" | "friend" | "rival" | "enemy";
}

export interface Culture {
  key: string;
  // naming + look
  namePre: string[]; nameSuf: string[]; hair: string[];
  seatAdj: string[]; seatGeo: string[]; houseRoots: string[];
  // evolving values (drift, borrow, clash over centuries)
  values?: Partial<Record<Drive, number>>;
  customs?: string[];
  tech?: Record<string, number>; // known innovations -> level
}

/** A house / dynasty holding territory. */
export interface Bloodline {
  id: string; name: string; seat: string; culture: string; hair: string;
  holdings: number;            // legacy scalar; geography model uses regionIds
  regionIds?: string[];
  overlordId: string | null;
  loyalty: number;
  treasury?: Partial<Record<Resource, number>>;
  prestige?: number;
}

export interface Region {
  id: string; name: string; terrain: Terrain;
  neighbors: string[];          // adjacency graph -> distance, fronts, diffusion
  ownerHouseId: string | null;
  output: Partial<Record<Resource, number>>;
  population: number;
  prosperity: number;           // drives ambition, migration, revolt
  cultureKey?: string;
  faithName?: string;
}

export interface Artifact {
  id: string; name: string;
  holderId: string | null; state: "lost" | "held" | "sealed" | "destroyed";
  legend: number;               // mythic weight; persists even when lost
  will: number;                 // 0..1 agency of its own
  wants?: string;               // what it seeks (a bearer, a bloodline, ruin...)
  attune?: string;              // bloodline/feature it "knows"
  power?: string;               // mechanical effect tag
}

export interface Faith {
  name: string; focus: string; posture: Posture;
  vitality: number; memory: number; grace: number;
  doctrines?: string[]; sacredRegionIds?: string[];
  parentFaith?: string | null;  // schism lineage
}

export interface Office {
  id: string; title: string; scope: string; holderId: string | null;
}

export interface ChronicleEvent {
  era: number; year: number;
  kind: string;                 // "war" | "schism" | "murder" | "coronation" | ...
  text: string;
  // causal trace — lets the chronicle (and you) explain WHY it happened
  actors?: string[];
  motive?: Drive | string;
  causedBy?: string[];          // ids of prior events/conditions
}

/** Player deity + the self-imposed, breakable per-run constraint. */
export interface Deity {
  vow?: { text: string; broken: boolean };
  incarnationId?: string | null;
  adversary?: "none" | "rival-deity" | "mortal-challenger";
}

export interface World {
  seed: number;
  era: number; year: number;
  rngState?: number;
  deity: Deity;
  cultures: Culture[];
  houses: Bloodline[];
  regions: Region[];
  people: Record<string, Person>;
  relationships: Relationship[];
  artifacts: Artifact[];
  faiths: Faith[];
  offices: Record<string, Office>;
  chronicle: ChronicleEvent[];
}

/** A system is a pure, deterministic phase: world + rng in, mutated world out. */
import type { RNG } from "./rng";
export interface System {
  name: string;
  run(world: World, rng: RNG): void;
}
