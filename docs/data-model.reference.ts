// ============================================================
//  GENERATIONAL GOD-SIM — DATA MODEL  (v0.4)
//  Principle: the ENGINE owns truth (typed, mechanical, traceable);
//  the AI owns voice (text fields, generated once and cached).
// ============================================================


// ─────────────────────────────────────────────
//  PRIMITIVES
// ─────────────────────────────────────────────
type Id = string;
type Era = number;                  // the world advances in eras (~25 yrs)

type BeliefView  = "devout" | "fearful" | "doubtful" | "defiant";
type Temperament = "ardent" | "cold" | "cunning" | "dutiful" | "wild" | "meek";
type Station     = "outcast" | "common" | "gentry" | "noble" | "exalted";


// ─────────────────────────────────────────────
//  THE GOD (you)
// ─────────────────────────────────────────────
interface Deity {
  vow: Vow;
  faith: number;                    // rough aggregate repute — DESCRIPTIVE ONLY; nothing ever spends it.
                                    // (the real texture lives in each Institution's creed below)
  incarnation: Incarnation | null;  // set when you descend
}

interface Vow {
  clause: string;                   // "I appear only to children"
  broken: boolean;                  // breakable — apostasy is part of the sim, never a power cost
  brokenInEra?: Era;
}

interface Incarnation {
  personId: Id;                     // the mortal identity you wear
  backstory: string;                // authored on descent (AI-assisted)
  // full divine memory; cannot die — only humbled, then returns
}


// ─────────────────────────────────────────────
//  BLOODLINES
// ─────────────────────────────────────────────
interface Bloodline {
  id: Id;
  name: string;                     // "House of the Vael Ridge"
  foundedEra: Era;
  endedEra?: Era;                   // extinct lines still matter as legend
  signatureFeatures: PhysicalFeature[];  // e.g. silver hair — what breeds true
  seat?: string;                    // domain / holding
}


// ─────────────────────────────────────────────
//  PERSON — the heart
//  Detail rides on `lod`: model EVERYONE cheaply, spend richness
//  only on those who step into the light.
// ─────────────────────────────────────────────
type Lod = "background" | "tracked";
// background = lineage + body only (cheap, no AI text)
// tracked    = full interior life + AI portrait/voice
//   auto-promoted when: touched by a DivineMark, holds an artifact,
//   inherits a seat, or is named in a prophecy.

interface Person {
  id: Id;
  lod: Lod;
  name: string;
  bloodlineId: Id;
  parents: [Id?, Id?];
  bornEra: Era;
  diedEra?: Era;
  status: "alive" | "dead" | "ascended";   // ascended = a god-slayer who won

  body: PhysicalAttributes;         // always present (cheap, heritable)
  temperament: Temperament;
  station: Station;                 // social rank — the engine raises/lowers this on its own

  // interior life — only meaningful on `tracked` people (AI-fleshed, then cached)
  drive?: string;                   // what they want
  wound?: string;                   // defining hurt or fear
  belief: { view: BeliefView; becameChallenger: boolean };

  // the artifact thread
  holds?: Id;                       // artifact id
  seeks?: Id;                       // artifact id they hunt (the god-slayer climbs this)

  // AI text — generated ONCE, cached, never regenerated (no drift over a long life)
  portrait?: string;
  voice?: string;
}


// ─────────────────────────────────────────────
//  PHYSICAL ATTRIBUTES (1:1 with Person)
//  Heritable features pass down bloodlines and feed prophecy
//  ("the silver-haired child who carries the Sword").
// ─────────────────────────────────────────────
interface PhysicalAttributes {
  features: PhysicalFeature[];      // heritable: hair, eyes, stature, bearing
  marks: string[];                  // scars; a divine sigil if you've touched them
  afflictions: string[];            // illness, a wound that won't heal
  vitality: number;                 // rough health; feeds aging / death rolls
}

interface PhysicalFeature {
  kind: string;                     // "hair" | "eyes" | "stature" | "bearing"
  value: string;                    // "silver" | "storm-grey" | "towering"
  heritable: boolean;               // does it breed true down the line?
}


// ─────────────────────────────────────────────
//  TRAITS  (catalog + join, so every trait is TRACEABLE to a cause)
// ─────────────────────────────────────────────
interface Trait {
  id: Id;
  name: string;                     // "Bloodlust" | "Sight" | "Unbreakable Will"
  effectHint: string;               // how the engine reads it
}

// JOIN: person ↔ trait, with provenance — answers "why does she have this?"
interface PersonTrait {
  personId: Id;
  traitId: Id;
  sinceEra: Era;
  source: "inherited" | "bloodline" | "artifact" | "divine" | "earned";
  sourceId?: Id;                    // artifact id / divine-mark id that caused it
}


// ─────────────────────────────────────────────
//  BONDS  (JOIN: person ↔ person — the relationship graph)
// ─────────────────────────────────────────────
interface Bond {
  fromId: Id;
  toId: Id;
  kind: "love" | "rivalry" | "fealty" | "debt" | "blood" | "hatred";
  intensity: number;
  sinceEra: Era;
}


// ─────────────────────────────────────────────
//  ARTIFACTS  (the persistent protagonists)
// ─────────────────────────────────────────────
interface Artifact {
  id: Id;
  name: string;                     // "Sword of Archaeleon"
  power?: Power;                    // undefined = grants nothing (just a fine blade)
  awakening: "always" | AwakenCondition;
  will: number;                     // 0 inert → high = a third agent
  wants?: string;                   // if willful: return-to-god | end-a-line | spread
  legend: number;                   // accrues from deeds; its reputation
  state: "held" | "lost" | "hidden" | "sealed" | "shattered" | "mythic";
  holderId?: Id;
}

interface Power { name: string; effectHint: string; }
interface AwakenCondition { trigger: string; }   // "true heir" | "blood moon" | "mortal wound"

// JOIN/EVENT: chain of custody — how an artifact moves and gathers legend
interface ArtifactCustody {
  artifactId: Id;
  holderId: Id;
  fromEra: Era;
  toEra?: Era;
  acquired: "bestowed" | "inherited" | "stolen" | "found" | "won-in-war";
  lost?: "died" | "stolen" | "reclaimed-by-god" | "lost" | "surrendered";
}


// ─────────────────────────────────────────────
//  PROPHECY  (first-class: it outlives the people it names)
// ─────────────────────────────────────────────
interface Prophecy {
  id: Id;
  utteredEra: Era;
  text: string;                     // AI-authored, cached
  origin: "mortal-seer" | "divine" | "artifact";  // mortals speak them, or YOU plant one
  deityStance: "undeclared" | "honored" | "denied"; // YOU decide whether it binds reality
  stanceEra?: Era;                  // when you chose to honor or deny it
  about?: Id;                       // optional artifact it concerns
  status: "open" | "fulfilled" | "averted" | "twisted";  // twisted = fulfilled wrongly
  resolvedEra?: Era;
}

// JOIN: prophecy ↔ people (a prophecy may name many; a person may be in many)
interface ProphecySubject {
  prophecyId: Id;
  personId: Id;
  role: "chosen" | "destroyer" | "betrayer" | "vessel" | "witness";
}


// ─────────────────────────────────────────────
//  INSTITUTIONS  (emergent — churches, cults, realms, orders, guilds)
//  NONE are seeded as permanent. They are FOUNDED, schism, and fall as the
//  world develops. Faith-bearing ones grow a creed about YOU from your deeds —
//  so "faith" is never one dial; it's many rival doctrines that disagree.
// ─────────────────────────────────────────────
interface Institution {
  id: Id;
  name: string;                     // "Church of the Sealed Mountain" | "Crown of Aerth"
  kind: "church" | "cult" | "realm" | "order" | "guild";
  foundedEra: Era;
  dissolvedEra?: Era;               // institutions die too
  seat?: string;
  parentId?: Id;                    // set if it schismed off another
  creed?: Creed;                    // faith-bearing institutions only
}

// A religion's organically-formed view of you — no two need agree
interface Creed {
  view: BeliefView;                 // devout | fearful | doubtful | defiant
  tenets: string[];                 // AI-authored doctrine, drawn from what you actually did
  reveres?: Id;                     // a saint (person) or relic (artifact) at its heart
}


// ─────────────────────────────────────────────
//  OFFICES  (singular seats — the engine fills them; people climb on their own)
//  A vacancy draws candidates ranked by drive, traits, legend, bonds, artifacts.
//  Ambition + opportunity = autonomous rise; the strong can also usurp.
//  Offices are CREATED and ABOLISHED as institutions rise and fall.
// ─────────────────────────────────────────────
interface Office {
  id: Id;
  title: string;                    // "Lord of the Vael Ridge" | "Holy Captain" | "High Seer"
  scope: "crown" | "domain" | "church" | "war" | "guild";
  institutionId?: Id;               // the body this seat belongs to (if any)
  hereditary: boolean;              // does a bloodline claim it by right?
  bloodlineId?: Id;                 // if hereditary
  holderId?: Id;                    // who sits it now (one, or none = vacant)
  foundedEra: Era;                  // born as the world develops
  dissolvedEra?: Era;               // abolished when its world passes
}

// JOIN/EVENT: who held a seat, when, and how they rose / fell — fully traceable
interface OfficeTenure {
  officeId: Id;
  personId: Id;
  fromEra: Era;
  toEra?: Era;
  rose: "inherited" | "appointed" | "elected" | "acclaimed" | "usurped";
  fell?: "died" | "deposed" | "abdicated" | "exiled" | "slain";
}


// ─────────────────────────────────────────────
//  DIVINE MARK  (JOIN: deity ↔ person — your fingerprints on a life)
//  Effects are MECHANICAL so cause → consequence is provable.
// ─────────────────────────────────────────────
interface DivineMark {
  id: Id;
  era: Era;
  personId: Id;
  act: "bestow" | "commune" | "reclaim" | "spare" | "manifest";
  artifactId?: Id;
  effects: Effect[];                // typed mutations the engine applies
  flavor: string;                   // the color: "sent a dream of the drowned city"
  vowBroken: boolean;               // did this honor or break your nature?
}

// Mechanical effects = a discriminated union the engine applies and can trace
type Effect =
  | { kind: "trait_add";     traitId: Id }
  | { kind: "trait_remove";  traitId: Id }
  | { kind: "drive_set";     drive: string }
  | { kind: "wound_set";     wound: string }
  | { kind: "belief_shift";  to: BeliefView }
  | { kind: "bond_add";      bond: Bond }
  | { kind: "feature_add";   feature: PhysicalFeature }   // e.g. a divine mark made flesh
  | { kind: "vitality_delta"; amount: number }
  | { kind: "mark_challenger" }                           // the crack → a god-slayer
  | { kind: "promote_lod" };                              // background → tracked


// ─────────────────────────────────────────────
//  CHRONICLE  (the ledger — and the causal trace)
// ─────────────────────────────────────────────
interface ChronicleEntry {
  id: Id;
  era: Era;
  text: string;                     // AI-narrated, cached
  personIds: Id[];
  artifactId?: Id;
  prophecyId?: Id;
  causedByMark?: Id;                // ← trace the line back to YOUR choice
}


// ─────────────────────────────────────────────
//  WORLD  (top-level run state — one serializable object)
// ─────────────────────────────────────────────
interface World {
  era: Era;
  rng: number;                      // seed — determinism = reproducible sagas
  deity: Deity;
  adversary: "none" | "rival-deity" | "mortal-challenger";  // set at run start

  // entities
  bloodlines: Record<Id, Bloodline>;
  people:     Record<Id, Person>;
  artifacts:  Record<Id, Artifact>;
  prophecies:   Record<Id, Prophecy>;
  institutions: Record<Id, Institution>;
  offices:      Record<Id, Office>;
  traits:       Record<Id, Trait>;    // shared catalog

  // join tables
  personTraits:     PersonTrait[];
  bonds:            Bond[];
  custody:          ArtifactCustody[];
  officeTenures:    OfficeTenure[];
  prophecySubjects: ProphecySubject[];
  divineMarks:      DivineMark[];

  chronicle: ChronicleEntry[];
}
