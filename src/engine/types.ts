/**
 * godsim — core data model for the DEEP rebuild.
 *
 * `Engine` / `EngineView` are the stable contract the UI + tests rely on; the
 * rebuild keeps them backward-compatible and EXTENDS them. Everything below is
 * the realized model for the dynamic, agent-driven simulation (see /CLAUDE.md
 * and /ARCHITECTURE.md).
 */

/* ─────────────────────────── stable engine contract ─────────────────────────── */

export interface Engine {
  /** Advance the world by one era (deterministic). */
  advance(): void;
  /** A JSON-serializable snapshot of the world for the UI and the chronicle. */
  view(): EngineView;
  /** Player (divine) interventions — the original levers, signatures unchanged. */
  nameChosen(personId: string): void;
  bestowSword(personId: string): void;
  bless(personId: string): void;
  reclaimSword(): void;
  listLiving(): PersonView[];
  /* extended divine surface (additive — see divine.ts) */
  [k: string]: unknown;
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

export interface HouseView { id: string; name: string; seat?: string; culture?: string; living: number; holdings: number; overlord: string | null; lord?: string | null; [k: string]: unknown; }
export interface FaithView { name: string; focus: string; posture: string; vitality: number; mem?: number; [k: string]: unknown; }
export interface CrownView { house: string; monarch?: string | null; legitimacy: number; stateFaith?: string | null; [k: string]: unknown; }
export interface ArtifactView { name: string; holder?: string | null; state: string; legend: number; attune?: string; [k: string]: unknown; }
export interface ChosenView { name?: string; alive?: boolean; outcome?: string; house?: string; [k: string]: unknown; }
export interface PersonView { id: string; name: string; house: string; houseId?: string; age: number; renown: number; holdsSword?: boolean; chosen?: boolean; [k: string]: unknown; }

/* ───────────────────────── realized model (deep rebuild) ───────────────────────── */

export type Drive = "security" | "status" | "wealth" | "faith" | "love" | "vengeance" | "legacy" | "knowledge" | "freedom";
export type Posture = "militant" | "evangelical" | "insular" | "syncretic" | "benevolent";
export type Terrain = "plain" | "hill" | "mountain" | "forest" | "marsh" | "desert" | "coast" | "steppe";
export type Resource = "food" | "wealth" | "manpower" | "ore" | "lore";
export type Trait =
  | "ambitious" | "content" | "cruel" | "just" | "pious" | "skeptic" | "cautious" | "bold"
  | "greedy" | "generous" | "vengeful" | "forgiving" | "scholarly" | "brutish" | "charming" | "paranoid";
export type BeliefView = "devout" | "fearful" | "doubtful" | "defiant";

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
  deathCause?: string;
  parents: string[];
  spouseId: string | null;
  claims: string[];
  // physical / heritable
  hair: string;
  // capability
  prowess: number;   // martial
  guile: number;     // intrigue
  acumen: number;    // stewardship / economy
  zeal: number;      // faith intensity
  // interiority — the engine of dynamism
  drives: Partial<Record<Drive, number>>; // weighted goals (sum ~1)
  wound: string | null;    // formative grievance/fear that biases choices
  woundVs?: string | null; // house id the wound points at (fuels vengeance)
  desire: string;          // overriding want, derived from drives + situation
  traits: Trait[];
  faithName?: string | null;
  // bookkeeping
  renownBase: number;
  chosen?: boolean;
  avatar?: boolean;        // the god incarnate — cannot die, only be humbled
  exiledFrom?: string | null;
  lastAction?: string;
  deeds: string[];         // short ledger of notable deeds (legibility)
  lod: "tracked" | "background";
}

/** Weighted social edge; updates from events and FEEDS BACK into decisions. */
export interface Relationship {
  from: string; to: string;
  affection: number;   // -1..1 love/hate
  trust: number;       // -1..1
  rivalry: number;     // 0..1 competition for the same prize
  debt: number;        // obligation owed (from -> to)
  why?: string;
}

export interface Culture {
  key: string;
  namePre: string[]; nameSuf: string[]; hair: string[];
  seatAdj: string[]; seatGeo: string[]; houseRoots: string[];
  values: Partial<Record<Drive, number>>;  // evolving — drift, borrow, clash
  customs: string[];
  tech: Record<string, number>;            // innovation key -> level (0/1)
  succession: "primogeniture" | "elective";
  parentKey?: string | null;               // set when a culture diverges
}

export interface Grudge { vs: string; weight: number; reason: string; era: number; }

/** A house / dynasty holding territory. */
export interface House {
  id: string; name: string; seatRegionId: string; seat: string; culture: string; hair: string;
  holdings: number;            // mirror of owned-region count (legacy compat)
  overlordId: string | null;
  loyalty: number;
  treasury: Record<"food" | "wealth" | "manpower", number>;
  prestige: number;
  grudges: Grudge[];
  foundedEra: number;
  fallenEra: number | null;
  color: string;               // deterministic UI color
  warWeary: number;            // 0..1 exhaustion pressure
}

export interface Region {
  id: string; name: string; terrain: Terrain;
  col: number; row: number;     // hex coordinates for the map
  neighbors: string[];
  ownerId: string | null;       // house id, or null = the wilds
  output: Partial<Record<Resource, number>>;
  population: number;           // thousands, the aggregated masses
  prosperity: number;           // 0..1 — drives ambition, migration, revolt
  devastation: number;          // 0..1 — war/plague scarring, heals slowly
  cultureKey: string;
  faithName: string | null;
  devotion: number;             // 0..1 strength of the dominant faith here
  sacredTo: string | null;      // faith name that holds this ground holy
  plague: number;               // eras of plague remaining (0 = none)
  famine: boolean;
  improvements: number;         // built works (granaries, walls) — raises output
}

export interface Artifact {
  id: string; name: string; kind: string;
  holderId: string | null; state: "lost" | "held" | "sealed" | "destroyed";
  lostInRegionId: string | null;
  legend: number;               // mythic weight; persists even when lost
  will: number;                 // 0..1 agency of its own
  wants: string;                // what it seeks
  attune: string;               // hair/bloodline feature it "knows"
  power: "war" | "crown" | "sight" | "plenty" | "dread" | "grace";
  custody: { holderId: string; era: number; how: string }[];
  forgedFrom?: string | null;   // artifact id it was reforged from
}

export interface Faith {
  id: string;
  name: string; focus: string; posture: Posture;
  vitality: number; memoryOfGod: number; zeal: number;
  doctrines: string[];
  sacredRegionIds: string[];
  parentId: string | null;      // schism lineage
  patronHouseId: string | null;
  founderId: string | null;
  foundedEra: number;
  dissolvedEra: number | null;
  creed: BeliefView;            // how this faith has come to see the god
  grace?: number;
}

export interface Office {
  id: string; title: string; scope: string; holderId: string | null; houseId?: string | null; hereditary?: boolean;
}

export interface Plot {
  id: string; plotterId: string; targetId: string;
  kind: "assassination" | "coup" | "usurp-house";
  progress: number; motive: Drive | string; bornEra: number; causedBy?: string[];
}

export interface WarAim {
  kind: "conquest" | "raid" | "independence" | "throne" | "holy" | "grudge" | "coalition";
  regionId?: string | null;
  claimantId?: string | null;
  faithId?: string | null;
  label: string;
}

export interface War {
  id: string;
  attackerId: string; defenderId: string;
  attackerAllies: string[]; defenderAllies: string[];
  aim: WarAim;
  startEra: number;
  exhaustionA: number; exhaustionD: number;
  score: number;            // + favors attacker, - defender
  over: boolean;
  causedBy?: string[];
}

export interface Prophecy {
  id: string;
  text: string;
  origin: "seer" | "artifact" | "divine" | "adversary";
  utteredEra: number;
  subjectSpec: { hair?: string; houseId?: string; personId?: string };
  predicate: { kind: "cast-down-house" | "take-crown" | "find-artifact" | "doom-of-faith"; targetId: string };
  status: "open" | "fulfilled" | "averted" | "twisted";
  resolvedEra?: number;
  subjectId?: string | null; // resolved person once identified
}

export interface ChronicleEvent {
  id: string;
  era: number; year: number;
  kind: string;                 // "war" | "schism" | "murder" | "coronation" | ...
  text: string;
  actors?: string[];            // person ids
  houses?: string[];            // house ids
  motive?: Drive | string;
  causedBy?: string[];          // ids of prior events — the causal trace
  importance: 1 | 2 | 3;        // 1 minor, 2 notable, 3 turning point
  regionId?: string | null;
  divine?: boolean;
}

export type VowKind = "no-blood" | "even-hand" | "one-miracle" | "silence" | "mercy" | "none";

export interface DivineMark {
  era: number; op: string; args: unknown[]; flavor: string; vowBroken: boolean;
}

/** Player deity + the self-imposed, breakable per-run constraint. */
export interface Deity {
  vow: { kind: VowKind; text: string; broken: boolean; brokenEra?: number } | null;
  incarnationId: string | null;
  incarnationBackstory?: string | null;
  adversary: "none" | "rival-deity" | "god-slayer";
  marks: DivineMark[];
  actsThisEra: number;
  lastActEra: number;
  humbled?: boolean;
}

export interface AdversaryState {
  name: string;
  kind: "none" | "rival-deity" | "god-slayer";
  championId: string | null;   // rival's champion, or the god-slayer person
  cultName: string | null;
  power: number;               // god-slayer tier / rival momentum
  defeated: boolean;
}

export interface BootOptions {
  adversary?: "none" | "rival-deity" | "god-slayer";
  vow?: VowKind;
}

export interface World {
  seed: number;
  options: BootOptions;
  era: number; year: number;
  deity: Deity;
  adversary: AdversaryState;
  cultures: Culture[];
  houses: House[];
  regions: Region[];
  people: Record<string, Person>;
  rels: Relationship[];
  standing: Record<string, number>;  // "hA|hB" -> -1..1 house standing
  truces: Record<string, number>;    // "hA|hB" -> era until which war is unthinkable
  artifacts: Artifact[];
  faiths: Faith[];
  offices: Record<string, Office>;
  plots: Plot[];
  wars: War[];
  prophecies: Prophecy[];
  crown: { houseId: string | null; holderId: string | null; legitimacy: number; stateFaithId: string | null; since: number };
  chosen: { personId: string; outcome: string | null } | null;
  empireHouseId: string | null;
  grace: number;
  mood: { label: string; since: number };
  chronicle: ChronicleEvent[];
  /** per-era intent scratchpad written by agents, consumed by systems, cleared each era */
  intents: {
    wars: { houseId: string; targetId: string; aim: WarAim; byId: string; causedBy?: string[] }[];
    proposals: { aId: string; bId: string; byId: string }[];
    quests: { personId: string; artifactId: string }[];
    conversions: { personId: string; faithId: string }[];
    prophets: { personId: string; focus: string }[];
    builds: { personId: string; regionId: string }[];
    endowments: { personId: string; faithId: string }[];
  };
  journal: { era: number; op: string; args: unknown[] }[];
  seq: Record<string, number>;
  perf: { lastEraMs: number };
}

/** A system is a pure, deterministic phase: world + rng in, mutated world out. */
import type { RNG } from "./rng";
export interface System {
  name: string;
  run(world: World, rng: RNG): void;
}
